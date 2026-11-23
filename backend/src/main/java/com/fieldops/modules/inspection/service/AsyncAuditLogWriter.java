package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.CompletableFuture;

/**
 * Executor Spring {@code @Async} dedicado à gravação isolada de eventos de auditoria
 * em transação independente ({@code REQUIRES_NEW}).
 */
@Component
public class AsyncAuditLogWriter {

    private final AuditLogRepository auditLogRepository;

    public AsyncAuditLogWriter(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Async("auditTaskExecutor")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CompletableFuture<AuditLog> writeAsync(AuditLog auditLog) {
        AuditLog saved = auditLogRepository.saveAndFlush(auditLog);
        return CompletableFuture.completedFuture(saved);
    }
}
