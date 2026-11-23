package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Serviço assíncrono de auditoria responsável por montar e despachar registros de trilha
 * em {@code audit_logs} via {@code auditTaskExecutor} (TASK-019 Passo 5, RT-02, RN-086).
 */
@Service
public class InspectionAuditService {

    private static final Logger log = LoggerFactory.getLogger(InspectionAuditService.class);
    private static final long ASYNC_FLUSH_TIMEOUT_SECONDS = 3L;

    private final AsyncAuditLogWriter asyncAuditLogWriter;
    private final AuditLogRepository auditLogRepository;

    public InspectionAuditService(
            AsyncAuditLogWriter asyncAuditLogWriter,
            AuditLogRepository auditLogRepository
    ) {
        this.asyncAuditLogWriter = asyncAuditLogWriter;
        this.auditLogRepository = auditLogRepository;
    }

    public CompletableFuture<AuditLog> persistAuditLogAsync(AuditLog auditLog) {
        if (auditLog.getId() == null) {
            auditLog.setId(UUID.randomUUID());
        }
        if (auditLog.getOccurredAt() == null) {
            auditLog.setOccurredAt(Instant.now());
        }
        try {
            return asyncAuditLogWriter.writeAsync(auditLog);
        } catch (TaskRejectedException ex) {
            log.warn("Fila assíncrona de auditoria saturada; persistindo evento {} de forma síncrona.", auditLog.getAction());
            return CompletableFuture.completedFuture(auditLogRepository.saveAndFlush(auditLog));
        }
    }

    public AuditLog recordStateTransition(
            UUID inspectionId,
            AuthenticatedUser actor,
            String action,
            String entityType,
            UUID entityId,
            String previousStatus,
            String newStatus,
            String previousValueJson,
            String newValueJson,
            String metadataJson,
            String details,
            Instant occurredAt
    ) {
        AuditLog auditLog = buildAuditLog(
                inspectionId,
                actor,
                action,
                entityType,
                entityId,
                previousStatus,
                newStatus,
                previousValueJson,
                newValueJson,
                metadataJson,
                details,
                occurredAt
        );
        return dispatchAndSynchronize(auditLog);
    }

    public AuditLog recordAdminAdjustment(
            UUID inspectionId,
            AuthenticatedUser actor,
            UUID responseId,
            String inspectionStatus,
            String previousValueJson,
            String newValueJson,
            String metadataJson,
            String details,
            Instant occurredAt
    ) {
        AuditLog auditLog = buildAuditLog(
                inspectionId,
                actor,
                "ADMIN_RESPONSE_ADJUSTED",
                "INSPECTION_RESPONSE",
                responseId,
                inspectionStatus,
                inspectionStatus,
                previousValueJson,
                newValueJson,
                metadataJson,
                details,
                occurredAt
        );
        return dispatchAndSynchronize(auditLog);
    }

    private AuditLog buildAuditLog(
            UUID inspectionId,
            AuthenticatedUser actor,
            String action,
            String entityType,
            UUID entityId,
            String previousStatus,
            String newStatus,
            String previousValueJson,
            String newValueJson,
            String metadataJson,
            String details,
            Instant occurredAt
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setId(UUID.randomUUID());
        auditLog.setInspectionId(inspectionId);
        auditLog.setActorId(actor != null ? actor.getId() : null);
        auditLog.setActorEmail(actor != null ? actor.getEmail() : null);
        auditLog.setAction(action);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setPreviousStatus(previousStatus);
        auditLog.setNewStatus(newStatus);
        auditLog.setPreviousValueJson(previousValueJson);
        auditLog.setNewValueJson(newValueJson);
        auditLog.setMetadataJson(metadataJson);
        auditLog.setDetails(details != null && details.length() > 1000 ? details.substring(0, 1000) : details);
        auditLog.setOccurredAt(occurredAt != null ? occurredAt : Instant.now());
        return auditLog;
    }

    private AuditLog dispatchAndSynchronize(AuditLog auditLog) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            // Se chamado dentro de uma transação ativa, agenda o despacho após commit para evitar lock/deadlock de FK
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    persistAuditLogAsync(auditLog);
                }
            });
            return auditLog;
        }

        try {
            return persistAuditLogAsync(auditLog).get(ASYNC_FLUSH_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Thread interrompida aguardando auditoria assíncrona ({}); aplicando fallback síncrono.", auditLog.getAction());
            return auditLogRepository.saveAndFlush(auditLog);
        } catch (Exception ex) {
            log.warn("Falha ao aguardar auditoria assíncrona ({}): {}; aplicando fallback síncrono.",
                    auditLog.getAction(), ex.getMessage());
            return auditLogRepository.saveAndFlush(auditLog);
        }
    }
}
