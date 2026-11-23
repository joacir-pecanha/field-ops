package com.fieldops.modules.sync.service;

import com.fieldops.modules.inspection.domain.AuditLog;
import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.repository.AuditLogRepository;
import com.fieldops.modules.inspection.repository.InspectionItemSnapshotRepository;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.EvidenceFileStatus;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.domain.NonConformityStatus;
import com.fieldops.modules.sync.domain.ProcessedOperation;
import com.fieldops.modules.sync.domain.SyncOperationType;
import com.fieldops.modules.sync.dto.SyncBatchRequest;
import com.fieldops.modules.sync.dto.SyncBatchResponse;
import com.fieldops.modules.sync.exception.SyncOperationException;
import com.fieldops.modules.sync.repository.EvidenceFileRepository;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.modules.sync.repository.NonConformityRepository;
import com.fieldops.modules.sync.repository.ProcessedOperationRepository;
import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Despachante central de sincronização em lote com idempotência atômica (RF-01..RF-06, RT-01, RT-02, EX-01).
 *
 * Cada mutação é verificada quanto à idempotência e executada em sua própria transação isolada
 * ({@code PROPAGATION_REQUIRES_NEW}), garantindo que a falha de uma operação por regra de negócio ou
 * conflito não reverta as demais operações válidas do mesmo lote.
 */
@Service
public class SyncBatchProcessor {

    private static final Logger log = LoggerFactory.getLogger(SyncBatchProcessor.class);

    private final ProcessedOperationRepository processedOperationRepository;
    private final InspectionRepository inspectionRepository;
    private final InspectionItemSnapshotRepository snapshotRepository;
    private final InspectionResponseRepository inspectionResponseRepository;
    private final NonConformityRepository nonConformityRepository;
    private final EvidenceFileRepository evidenceFileRepository;
    private final AuditLogRepository auditLogRepository;
    private final TransactionTemplate requiresNewTransactionTemplate;
    private final ObjectMapper objectMapper;

    public SyncBatchProcessor(
            ProcessedOperationRepository processedOperationRepository,
            InspectionRepository inspectionRepository,
            InspectionItemSnapshotRepository snapshotRepository,
            InspectionResponseRepository inspectionResponseRepository,
            NonConformityRepository nonConformityRepository,
            EvidenceFileRepository evidenceFileRepository,
            AuditLogRepository auditLogRepository,
            PlatformTransactionManager transactionManager
    ) {
        this.processedOperationRepository = processedOperationRepository;
        this.inspectionRepository = inspectionRepository;
        this.snapshotRepository = snapshotRepository;
        this.inspectionResponseRepository = inspectionResponseRepository;
        this.nonConformityRepository = nonConformityRepository;
        this.evidenceFileRepository = evidenceFileRepository;
        this.auditLogRepository = auditLogRepository;
        this.requiresNewTransactionTemplate = new TransactionTemplate(transactionManager);
        this.requiresNewTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.objectMapper = JsonMapper.builder().build();
    }

    /**
     * Processa um lote de operações respeitando dependências causais e idempotência por {@code operation_id}.
     */
    public SyncBatchResponse processBatch(
            SyncBatchRequest request,
            String headerBatchId,
            AuthenticatedUser actor
    ) {
        Instant batchServerTimestamp = Instant.now();
        String batchId = resolveBatchId(request, headerBatchId);
        List<SyncBatchRequest.OperationItem> rawOperations =
                request != null && request.getOperations() != null ? request.getOperations() : List.of();

        List<SyncBatchRequest.OperationItem> orderedOperations = orderOperationsByDependencies(rawOperations);
        List<SyncBatchResponse.ProcessedItem> results = new ArrayList<>(orderedOperations.size());

        int succeededCount = 0;
        int failedCount = 0;

        for (SyncBatchRequest.OperationItem item : orderedOperations) {
            SyncBatchResponse.ProcessedItem processedItem = processSingleOperation(item, batchId, actor);
            results.add(processedItem);
            if (processedItem.success()) {
                succeededCount++;
            } else {
                failedCount++;
            }
        }

        String batchStatus;
        if (failedCount == 0) {
            batchStatus = "SUCCESS";
        } else if (succeededCount > 0) {
            batchStatus = "PARTIAL_SUCCESS";
        } else {
            batchStatus = "FAILED";
        }

        return new SyncBatchResponse(
                batchId,
                batchStatus,
                orderedOperations.size(),
                succeededCount,
                failedCount,
                batchServerTimestamp,
                results
        );
    }

    private SyncBatchResponse.ProcessedItem processSingleOperation(
            SyncBatchRequest.OperationItem item,
            String batchId,
            AuthenticatedUser actor
    ) {
        Instant serverTimestamp = Instant.now();
        String rawOpId = item != null ? trimToNull(item.getOperationId()) : null;
        String rawOpType = item != null ? trimToNull(item.getOperationType()) : null;
        Instant clientTimestamp = parseInstantOrNull(item != null ? item.getClientTimestamp() : null);

        UUID operationId = parseUuidOrNull(rawOpId);
        if (operationId == null) {
            return new SyncBatchResponse.ProcessedItem(
                    rawOpId,
                    rawOpType,
                    item != null ? trimToNull(item.getGlobalId()) : null,
                    false,
                    "FAILED",
                    "INVALID_OPERATION_ID",
                    "Cada operação deve possuir um UUID válido em operation_id.",
                    clientTimestamp,
                    serverTimestamp
            );
        }

        // Passo 3: Verificação de idempotência ANTES da execução da mutação (RF-03, RT-01)
        Optional<ProcessedOperation> alreadyProcessed = processedOperationRepository.findById(operationId);
        if (alreadyProcessed.isPresent()) {
            return buildAlreadyProcessedResult(alreadyProcessed.get(), clientTimestamp);
        }

        SyncOperationType operationType = SyncOperationType.fromValue(rawOpType);
        if (operationType == null) {
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    rawOpType,
                    trimToNull(item.getGlobalId()),
                    false,
                    "FAILED",
                    "UNSUPPORTED_OPERATION_TYPE",
                    "Tipo de operação desconhecido ou não suportado: '" + rawOpType + "'.",
                    clientTimestamp,
                    serverTimestamp
            );
        }

        Map<String, Object> payload;
        String payloadJson;
        try {
            payload = parsePayloadMap(item.getPayload());
            payloadJson = payload.isEmpty() ? null : objectMapper.writeValueAsString(payload);
        } catch (IllegalArgumentException ex) {
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    "FAILED",
                    "INVALID_PAYLOAD",
                    ex.getMessage(),
                    clientTimestamp,
                    serverTimestamp
            );
        } catch (Exception ex) {
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    "FAILED",
                    "INVALID_PAYLOAD",
                    "Falha ao interpretar o payload JSON da operação.",
                    clientTimestamp,
                    serverTimestamp
            );
        }

        try {
            return requiresNewTransactionTemplate.execute(status -> {
                // Re-verifica dentro da transação para mitigar corrida entre threads
                Optional<ProcessedOperation> insideTx = processedOperationRepository.findById(operationId);
                if (insideTx.isPresent()) {
                    return buildAlreadyProcessedResult(insideTx.get(), clientTimestamp);
                }

                OperationOutcome outcome = dispatchOperation(
                        operationId,
                        operationType,
                        item,
                        payload,
                        clientTimestamp,
                        serverTimestamp,
                        actor
                );

                ProcessedOperation record = new ProcessedOperation();
                record.setOperationId(operationId);
                record.setBatchId(batchId);
                record.setOperationType(operationType.name());
                record.setEntityType(resolveEntityType(item.getEntityType(), operationType));
                record.setEntityId(outcome.entityId());
                record.setInspectionId(outcome.inspectionId());
                record.setActorId(actor != null ? actor.getId() : null);
                record.setStatus("SUCCESS");
                record.setResultCode("PROCESSED");
                record.setResultMessage(outcome.message());
                record.setPayloadJson(payloadJson);
                record.setClientTimestamp(clientTimestamp != null ? clientTimestamp : outcome.effectiveClientTimestamp());
                record.setServerTimestamp(serverTimestamp);
                processedOperationRepository.saveAndFlush(record);

                return new SyncBatchResponse.ProcessedItem(
                        operationId.toString(),
                        operationType.name(),
                        outcome.entityId() != null ? outcome.entityId().toString() : null,
                        true,
                        "SUCCESS",
                        null,
                        outcome.message(),
                        record.getClientTimestamp(),
                        serverTimestamp
                );
            });
        } catch (DataIntegrityViolationException ex) {
            // Se outra requisição concorrente gravou o mesmo operation_id no banco, devolve ALREADY_PROCESSED
            Optional<ProcessedOperation> concurrent = processedOperationRepository.findById(operationId);
            if (concurrent.isPresent()) {
                return buildAlreadyProcessedResult(concurrent.get(), clientTimestamp);
            }
            log.warn("Violação de integridade ao processar operação {} ({}): {}", operationId, operationType, ex.getClass().getSimpleName());
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    "CONFLICT",
                    "DATA_INTEGRITY_CONFLICT",
                    "Operação rejeitada por conflito de integridade no banco de dados.",
                    clientTimestamp,
                    serverTimestamp
            );
        } catch (ObjectOptimisticLockingFailureException ex) {
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    "CONFLICT",
                    "CONFLICT",
                    "Conflito de concorrência detectado: a inspeção foi alterada por outro usuário.",
                    clientTimestamp,
                    serverTimestamp
            );
        } catch (SyncOperationException ex) {
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    ex.getResultStatus(),
                    ex.getCode(),
                    ex.getMessage(),
                    clientTimestamp,
                    serverTimestamp
            );
        } catch (Exception ex) {
            log.warn("Erro inesperado ao processar operação {} ({}): {}", operationId, operationType, ex.getMessage());
            return new SyncBatchResponse.ProcessedItem(
                    operationId.toString(),
                    operationType.name(),
                    trimToNull(item.getGlobalId()),
                    false,
                    "FAILED",
                    "OPERATION_PROCESSING_ERROR",
                    "Falha ao processar a operação: " + ex.getMessage(),
                    clientTimestamp,
                    serverTimestamp
            );
        }
    }

    private OperationOutcome dispatchOperation(
            UUID operationId,
            SyncOperationType operationType,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        return switch (operationType) {
            case START_INSPECTION -> handleStartInspection(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case SAVE_RESPONSE -> handleSaveResponse(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case UPLOAD_EVIDENCE -> handleUploadEvidenceMetadata(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case CREATE_NON_CONFORMITY -> handleCreateNonConformity(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case UPDATE_NON_CONFORMITY -> handleUpdateNonConformity(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case CANCEL_NON_CONFORMITY -> handleCancelNonConformity(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
            case COMPLETE_INSPECTION -> handleCompleteInspection(operationId, item, payload, clientTimestamp, serverTimestamp, actor);
        };
    }

    private OperationOutcome handleStartInspection(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        Inspection inspection = loadAndAuthorizeInspection(item, payload, actor, true);
        validateOptimisticVersion(inspection, item, payload);

        if (inspection.getStatus() == InspectionStatus.ENVIADA
                || inspection.getStatus() == InspectionStatus.EM_REVISÃO) {
            throw SyncOperationException.conflict(
                    "A inspeção já foi concluída/enviada no servidor (" + inspection.getStatus() + ")."
            );
        }

        Instant deviceStartedAt = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "startedAt", "started_at", "startedAtDevice")),
                clientTimestamp,
                serverTimestamp
        );

        String previousStatus = inspection.getStatus().name();
        if (inspection.getStatus() == InspectionStatus.ATRIBUÍDA
                || inspection.getStatus() == InspectionStatus.RASCUNHO
                || inspection.getStatus() == InspectionStatus.REPROVADA) {
            inspection.setStatus(InspectionStatus.EM_ANDAMENTO);
        }
        if (inspection.getStartedAtDevice() == null) {
            inspection.setStartedAtDevice(deviceStartedAt);
        }
        if (inspection.getStartedAtServer() == null) {
            inspection.setStartedAtServer(serverTimestamp);
        }

        LocationCoordinates coords = extractLocation(payload);
        if (coords != null) {
            inspection.setStartLatitude(coords.latitude());
            inspection.setStartLongitude(coords.longitude());
            inspection.setStartAccuracy(coords.accuracy());
        }

        Inspection saved = inspectionRepository.saveAndFlush(inspection);

        recordAuditEvent(
                saved.getId(),
                actor,
                "INSPECTION_STARTED",
                "INSPECTION",
                saved.getId(),
                previousStatus,
                saved.getStatus().name(),
                "{\"status\":\"" + previousStatus + "\"}",
                "{\"status\":\"" + saved.getStatus().name() + "\",\"startedAtDevice\":\"" + saved.getStartedAtDevice() + "\"}",
                operationId.toString(),
                deviceStartedAt,
                serverTimestamp,
                "Inspeção iniciada via sincronização offline."
        );

        return new OperationOutcome(
                saved.getId(),
                saved.getId(),
                deviceStartedAt,
                "Inspeção iniciada e sincronizada com sucesso."
        );
    }

    private OperationOutcome handleSaveResponse(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        Inspection inspection = loadAndAuthorizeInspection(item, payload, actor, true);
        validateOptimisticVersion(inspection, item, payload);

        if (inspection.getStatus() == InspectionStatus.ENVIADA
                || inspection.getStatus() == InspectionStatus.EM_REVISÃO) {
            throw SyncOperationException.conflict(
                    "Inspeção no estado " + inspection.getStatus() + " não aceita alteração de respostas."
            );
        }

        UUID itemId = resolveUuid(payload, null, "itemId", "item_id", "inspectionItemId", "inspection_item_id");
        if (itemId == null) {
            throw SyncOperationException.failed(
                    "INSPECTION_ITEM_REQUIRED",
                    "O identificador do item do snapshot (itemId) é obrigatório para salvar a resposta."
            );
        }

        InspectionItemSnapshot snapshot = snapshotRepository.findById(itemId)
                .orElseThrow(() -> SyncOperationException.failed(
                        "SNAPSHOT_ITEM_NOT_FOUND",
                        "Item de snapshot não encontrado: " + itemId + "."
                ));

        if (!snapshot.getInspection().getId().equals(inspection.getId())) {
            throw SyncOperationException.failed(
                    "SNAPSHOT_ITEM_MISMATCH",
                    "O item " + itemId + " não pertence à inspeção " + inspection.getId() + "."
            );
        }

        Instant answeredAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "respondedAt", "responded_at", "answeredAtDevice", "answered_at_device")),
                clientTimestamp,
                serverTimestamp
        );

        // Garante transição automática para EM_ANDAMENTO caso o mobile tenha salvo resposta antes de START explícito
        if (inspection.getStatus() == InspectionStatus.ATRIBUÍDA
                || inspection.getStatus() == InspectionStatus.RASCUNHO
                || inspection.getStatus() == InspectionStatus.REPROVADA) {
            InspectionStatus previousStatus = inspection.getStatus();
            inspection.setStatus(InspectionStatus.EM_ANDAMENTO);
            if (inspection.getStartedAtDevice() == null) {
                inspection.setStartedAtDevice(answeredAtDevice);
            }
            if (inspection.getStartedAtServer() == null) {
                inspection.setStartedAtServer(serverTimestamp);
            }
            inspectionRepository.saveAndFlush(inspection);
            if (previousStatus == InspectionStatus.REPROVADA) {
                recordAuditEvent(
                        inspection.getId(),
                        actor,
                        "INSPECTION_REOPENED",
                        "INSPECTION",
                        inspection.getId(),
                        previousStatus.name(),
                        InspectionStatus.EM_ANDAMENTO.name(),
                        "{\"status\":\"REPROVADA\"}",
                        "{\"status\":\"EM_ANDAMENTO\"}",
                        operationId.toString(),
                        answeredAtDevice,
                        serverTimestamp,
                        "Inspeção reprovada reaberta automaticamente para correção pelo técnico."
                );
            }
        }

        Object rawValueObj = payload.get("value");
        String rawValue = rawValueObj != null ? String.valueOf(rawValueObj) : null;
        if (rawValue != null) {
            rawValue = rawValue.trim();
        }

        Optional<InspectionResponse> existingResponseOpt =
                inspectionResponseRepository.findByInspectionItemId(snapshot.getId());
        boolean isUpdate = existingResponseOpt.isPresent();
        String previousValueJson = isUpdate
                ? buildResponseAuditJson(snapshot.getId(), existingResponseOpt.get())
                : null;

        UUID requestedResponseId = resolveUuid(
                payload,
                item.getGlobalId(),
                "id",
                "responseId",
                "response_id"
        );
        InspectionResponse response = existingResponseOpt.orElseGet(() -> {
            InspectionResponse created = new InspectionResponse();
            created.setId(requestedResponseId != null ? requestedResponseId : UUID.randomUUID());
            created.setInspectionId(inspection.getId());
            created.setInspectionItemId(snapshot.getId());
            return created;
        });

        applyTypedResponseValue(snapshot, response, rawValue, rawValueObj);

        String observation = trimToNull(getString(payload, "observation", "comment"));
        Boolean explicitNonConformity = getBoolean(payload, "isNonConformity", "is_non_conformity");
        String ncDescription = trimToNull(getString(payload, "nonConformityDescription", "non_conformity_description"));

        if (Boolean.TRUE.equals(explicitNonConformity) || "NON_CONFORMING".equals(response.getConformity())) {
            response.setNonConformity(true);
            if (response.getConformity() == null && snapshot.getResponseType() == ResponseType.CONFORMITY) {
                response.setConformity("NON_CONFORMING");
            }
        } else if (explicitNonConformity != null) {
            response.setNonConformity(false);
        } else {
            response.setNonConformity("NON_CONFORMING".equals(response.getConformity()));
        }

        response.setObservation(observation);
        response.setNonConformityDescription(response.isNonConformity() ? ncDescription : null);

        BigDecimal lat = getBigDecimal(payload, "latitude");
        BigDecimal lng = getBigDecimal(payload, "longitude");
        BigDecimal acc = getBigDecimal(payload, "accuracy");
        if (lat != null) {
            response.setLatitude(lat);
        }
        if (lng != null) {
            response.setLongitude(lng);
        }
        if (acc != null) {
            response.setAccuracy(acc);
        }

        response.setAnsweredBy(actor != null ? actor.getId() : inspection.getTechnician().getId());
        response.setAnsweredAtDevice(answeredAtDevice);
        response.setServerReceivedAt(serverTimestamp);

        InspectionResponse saved = inspectionResponseRepository.saveAndFlush(response);

        // Vincula evidências fotográficas previamente enviadas para este item (CA-04)
        List<EvidenceFile> itemEvidences = evidenceFileRepository.findByInspectionIdAndInspectionItemId(
                inspection.getId(),
                snapshot.getId()
        );
        for (EvidenceFile evidence : itemEvidences) {
            if (evidence.getResponseId() == null) {
                evidence.setResponseId(saved.getId());
                evidenceFileRepository.save(evidence);
            }
        }

        recordAuditEvent(
                inspection.getId(),
                actor,
                isUpdate ? "RESPONSE_UPDATED" : "RESPONSE_CREATED",
                "INSPECTION_RESPONSE",
                saved.getId(),
                null,
                null,
                previousValueJson,
                buildResponseAuditJson(snapshot.getId(), saved),
                operationId.toString(),
                answeredAtDevice,
                serverTimestamp,
                "Resposta do item '" + snapshot.getItemTitle() + "' sincronizada."
        );

        return new OperationOutcome(
                saved.getId(),
                inspection.getId(),
                answeredAtDevice,
                "Resposta salva com sucesso."
        );
    }

    private OperationOutcome handleUploadEvidenceMetadata(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        Inspection inspection = loadAndAuthorizeInspection(item, payload, actor, true);
        validateOptimisticVersion(inspection, item, payload);

        UUID evidenceId = resolveUuid(payload, item.getGlobalId(), "evidenceId", "evidence_id", "id");
        if (evidenceId == null) {
            throw SyncOperationException.failed(
                    "EVIDENCE_ID_REQUIRED",
                    "O identificador da evidência (evidenceId) é obrigatório."
            );
        }

        UUID itemId = resolveUuid(payload, null, "itemId", "item_id", "inspectionItemId", "inspection_item_id");
        UUID nonConformityId = resolveUuid(payload, null, "nonConformityId", "non_conformity_id");
        UUID responseId = resolveUuid(payload, null, "responseId", "response_id");

        if (itemId != null) {
            InspectionItemSnapshot snapshot = snapshotRepository.findById(itemId)
                    .orElseThrow(() -> SyncOperationException.failed(
                            "SNAPSHOT_ITEM_NOT_FOUND",
                            "Item de snapshot não encontrado: " + itemId + "."
                    ));
            if (!snapshot.getInspection().getId().equals(inspection.getId())) {
                throw SyncOperationException.failed(
                        "SNAPSHOT_ITEM_MISMATCH",
                        "O item " + itemId + " não pertence à inspeção " + inspection.getId() + "."
                );
            }
            if (responseId == null) {
                responseId = inspectionResponseRepository
                        .findByInspectionIdAndInspectionItemId(inspection.getId(), itemId)
                        .map(InspectionResponse::getId)
                        .orElse(null);
            }
        }

        Instant capturedAt = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "createdAt", "capturedAt", "captured_at_device")),
                clientTimestamp,
                serverTimestamp
        );

        UUID finalResponseId = responseId;
        EvidenceFile evidence = evidenceFileRepository.findById(evidenceId).orElseGet(() -> {
            EvidenceFile created = new EvidenceFile();
            created.setId(evidenceId);
            created.setInspectionId(inspection.getId());
            created.setType("PHOTO");
            String fileName = trimToNull(getString(payload, "fileName", "file_name"));
            created.setFileName(fileName != null ? fileName : evidenceId + ".jpg");
            created.setOriginalFileName(fileName);
            created.setStorageKey("pending/" + inspection.getId() + "/" + created.getFileName());
            String mimeType = trimToNull(getString(payload, "mimeType", "mime_type"));
            created.setMimeType(mimeType != null ? mimeType : "image/jpeg");
            Long fileSize = getLong(payload, "fileSize", "file_size", "sizeBytes", "size_bytes");
            created.setSizeBytes(fileSize != null && fileSize >= 0 ? fileSize : 0L);
            created.setChecksumSha256("PENDING");
            created.setStatus(EvidenceFileStatus.PENDING);
            created.setCreatedBy(actor != null ? actor.getId() : inspection.getTechnician().getId());
            return created;
        });

        if (!evidence.getInspectionId().equals(inspection.getId())) {
            throw SyncOperationException.conflict("Evidência pertence a outra inspeção.");
        }

        if (itemId != null && evidence.getInspectionItemId() == null) {
            evidence.setInspectionItemId(itemId);
        }
        if (finalResponseId != null && evidence.getResponseId() == null) {
            evidence.setResponseId(finalResponseId);
        }
        if (nonConformityId != null && evidence.getNonConformityId() == null) {
            evidence.setNonConformityId(nonConformityId);
        }
        if (evidence.getCapturedAtDevice() == null) {
            evidence.setCapturedAtDevice(capturedAt);
        }
        evidence.setServerReceivedAt(serverTimestamp);

        EvidenceFile saved = evidenceFileRepository.saveAndFlush(evidence);

        return new OperationOutcome(
                saved.getId(),
                inspection.getId(),
                capturedAt,
                "Metadados da evidência registrados para rastreamento."
        );
    }

    private OperationOutcome handleCreateNonConformity(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        Inspection inspection = loadAndAuthorizeInspection(item, payload, actor, true);
        validateOptimisticVersion(inspection, item, payload);

        if (inspection.getStatus() == InspectionStatus.ENVIADA
                || inspection.getStatus() == InspectionStatus.EM_REVISÃO) {
            throw SyncOperationException.conflict(
                    "Inspeção no estado " + inspection.getStatus() + " não aceita registro de novas não conformidades."
            );
        }

        UUID ncId = resolveUuid(payload, item.getGlobalId(), "id", "nonConformityId", "non_conformity_id");
        if (ncId == null) {
            ncId = UUID.randomUUID();
        }

        String title = trimToNull(getString(payload, "title"));
        if (title == null) {
            throw SyncOperationException.failed(
                    "NON_CONFORMITY_TITLE_REQUIRED",
                    "O título da não conformidade é obrigatório."
            );
        }
        if (title.length() > 250) {
            title = title.substring(0, 250);
        }

        NonConformitySeverity severity;
        try {
            severity = NonConformitySeverity.fromValue(getString(payload, "severity"));
        } catch (IllegalArgumentException ex) {
            throw SyncOperationException.failed("INVALID_SEVERITY", ex.getMessage());
        }
        if (severity == null) {
            throw SyncOperationException.failed(
                    "NON_CONFORMITY_SEVERITY_REQUIRED",
                    "A criticidade da não conformidade é obrigatória."
            );
        }

        String description = getString(payload, "description");
        if (description == null) {
            description = "";
        }
        description = description.trim();
        if ((severity == NonConformitySeverity.CRITICA || severity == NonConformitySeverity.ALTA)
                && description.isBlank()) {
            throw SyncOperationException.failed(
                    "CRITICAL_DESCRIPTION_REQUIRED",
                    "Não conformidades de severidade ALTA ou CRITICA exigem descrição detalhada."
            );
        }

        UUID itemId = resolveUuid(payload, null, "itemId", "item_id", "inspectionItemId", "inspection_item_id");
        UUID responseId = resolveUuid(payload, null, "responseId", "response_id");
        String itemTitle = trimToNull(getString(payload, "itemTitle", "item_title"));

        if (itemId != null) {
            InspectionItemSnapshot snapshot = snapshotRepository.findById(itemId)
                    .orElseThrow(() -> SyncOperationException.failed(
                            "SNAPSHOT_ITEM_NOT_FOUND",
                            "Item de snapshot não encontrado: " + itemId + "."
                    ));
            if (!snapshot.getInspection().getId().equals(inspection.getId())) {
                throw SyncOperationException.failed(
                        "SNAPSHOT_ITEM_MISMATCH",
                        "O item " + itemId + " não pertence à inspeção " + inspection.getId() + "."
                );
            }
            if (itemTitle == null) {
                itemTitle = snapshot.getItemTitle();
            }
            if (responseId == null) {
                responseId = inspectionResponseRepository
                        .findByInspectionIdAndInspectionItemId(inspection.getId(), itemId)
                        .map(InspectionResponse::getId)
                        .orElse(null);
            }
        }

        Instant createdAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "createdAtDevice", "created_at_device", "createdAt")),
                clientTimestamp,
                serverTimestamp
        );

        UUID finalNcId = ncId;
        NonConformity nc = nonConformityRepository.findById(finalNcId).orElseGet(() -> {
            NonConformity created = new NonConformity();
            created.setId(finalNcId);
            return created;
        });

        nc.setInspectionId(inspection.getId());
        nc.setInspectionItemId(itemId);
        nc.setResponseId(responseId);
        nc.setItemTitle(itemTitle);
        nc.setTitle(title);
        nc.setDescription(description);
        nc.setSeverity(severity);
        nc.setStatus(NonConformityStatus.fromValue(getString(payload, "status")));
        nc.setCreatedBy(resolveUuid(payload, null, "createdBy", "created_by") != null
                ? resolveUuid(payload, null, "createdBy", "created_by")
                : (actor != null ? actor.getId() : inspection.getTechnician().getId()));
        nc.setCreatedAtDevice(createdAtDevice);
        nc.setServerReceivedAt(serverTimestamp);

        NonConformity saved = nonConformityRepository.saveAndFlush(nc);

        linkEvidenceIdsToNonConformity(payload, saved.getId(), inspection.getId(), itemId, responseId);

        recordAuditEvent(
                inspection.getId(),
                actor,
                "NON_CONFORMITY_CREATED",
                "NON_CONFORMITY",
                saved.getId(),
                null,
                saved.getStatus().name(),
                null,
                "{\"title\":\"" + escapeJson(saved.getTitle()) + "\",\"severity\":\"" + saved.getSeverity().name() + "\"}",
                operationId.toString(),
                createdAtDevice,
                serverTimestamp,
                "Não conformidade registrada (" + saved.getSeverity().name() + "): " + saved.getTitle()
        );

        return new OperationOutcome(
                saved.getId(),
                inspection.getId(),
                createdAtDevice,
                "Não conformidade registrada com sucesso."
        );
    }

    private OperationOutcome handleUpdateNonConformity(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        UUID ncId = resolveUuid(payload, item.getGlobalId(), "id", "nonConformityId", "non_conformity_id");
        if (ncId == null) {
            throw SyncOperationException.failed("NON_CONFORMITY_ID_REQUIRED", "Identificador da não conformidade obrigatório.");
        }

        NonConformity nc = nonConformityRepository.findById(ncId)
                .orElseThrow(() -> SyncOperationException.failed("NON_CONFORMITY_NOT_FOUND", "Não conformidade não encontrada: " + ncId));

        Inspection inspection = inspectionRepository.findDetailedById(nc.getInspectionId())
                .orElseThrow(() -> SyncOperationException.failed("INSPECTION_NOT_FOUND", "Inspeção associada não encontrada."));

        validateActorAccess(inspection, actor);
        validateMutableInspectionState(inspection);
        validateOptimisticVersion(inspection, item, payload);

        if (inspection.getStatus() == InspectionStatus.ENVIADA
                || inspection.getStatus() == InspectionStatus.EM_REVISÃO) {
            throw SyncOperationException.conflict(
                    "Inspeção no estado " + inspection.getStatus() + " não aceita edição de não conformidades."
            );
        }

        String title = trimToNull(getString(payload, "title"));
        if (title != null) {
            nc.setTitle(title.length() > 250 ? title.substring(0, 250) : title);
        }
        String description = getString(payload, "description");
        if (description != null) {
            nc.setDescription(description.trim());
        }
        String rawSeverity = getString(payload, "severity");
        if (rawSeverity != null) {
            try {
                NonConformitySeverity severity = NonConformitySeverity.fromValue(rawSeverity);
                if (severity != null) {
                    nc.setSeverity(severity);
                }
            } catch (IllegalArgumentException ex) {
                throw SyncOperationException.failed("INVALID_SEVERITY", ex.getMessage());
            }
        }
        String rawStatus = getString(payload, "status");
        if (rawStatus != null) {
            nc.setStatus(NonConformityStatus.fromValue(rawStatus));
        }

        NonConformity saved = nonConformityRepository.saveAndFlush(nc);
        linkEvidenceIdsToNonConformity(payload, saved.getId(), inspection.getId(), saved.getInspectionItemId(), saved.getResponseId());

        Instant updatedAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "updatedAtDevice", "updated_at_device")),
                clientTimestamp,
                serverTimestamp
        );

        recordAuditEvent(
                inspection.getId(),
                actor,
                "NON_CONFORMITY_UPDATED",
                "NON_CONFORMITY",
                saved.getId(),
                null,
                saved.getStatus().name(),
                null,
                "{\"title\":\"" + escapeJson(saved.getTitle()) + "\",\"severity\":\"" + saved.getSeverity().name() + "\"}",
                operationId.toString(),
                updatedAtDevice,
                serverTimestamp,
                "Não conformidade atualizada: " + saved.getTitle()
        );

        return new OperationOutcome(
                saved.getId(),
                inspection.getId(),
                updatedAtDevice,
                "Não conformidade atualizada com sucesso."
        );
    }

    private OperationOutcome handleCancelNonConformity(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        UUID ncId = resolveUuid(payload, item.getGlobalId(), "id", "nonConformityId", "non_conformity_id");
        if (ncId == null) {
            throw SyncOperationException.failed("NON_CONFORMITY_ID_REQUIRED", "Identificador da não conformidade obrigatório.");
        }

        NonConformity nc = nonConformityRepository.findById(ncId)
                .orElseThrow(() -> SyncOperationException.failed("NON_CONFORMITY_NOT_FOUND", "Não conformidade não encontrada: " + ncId));

        Inspection inspection = inspectionRepository.findDetailedById(nc.getInspectionId())
                .orElseThrow(() -> SyncOperationException.failed("INSPECTION_NOT_FOUND", "Inspeção associada não encontrada."));

        validateActorAccess(inspection, actor);
        validateMutableInspectionState(inspection);
        validateOptimisticVersion(inspection, item, payload);

        String previousStatus = nc.getStatus().name();
        nc.setStatus(NonConformityStatus.CANCELED);
        nc.setCanceledReason(trimToNull(getString(payload, "reason", "canceledReason")));
        NonConformity saved = nonConformityRepository.saveAndFlush(nc);

        Instant canceledAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "canceledAtDevice", "canceled_at_device")),
                clientTimestamp,
                serverTimestamp
        );

        recordAuditEvent(
                inspection.getId(),
                actor,
                "NON_CONFORMITY_CANCELED",
                "NON_CONFORMITY",
                saved.getId(),
                previousStatus,
                saved.getStatus().name(),
                "{\"status\":\"" + previousStatus + "\"}",
                "{\"status\":\"CANCELED\"}",
                operationId.toString(),
                canceledAtDevice,
                serverTimestamp,
                "Não conformidade cancelada via sincronização."
        );

        return new OperationOutcome(
                saved.getId(),
                inspection.getId(),
                canceledAtDevice,
                "Não conformidade cancelada com auditoria."
        );
    }

    private OperationOutcome handleCompleteInspection(
            UUID operationId,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            Instant clientTimestamp,
            Instant serverTimestamp,
            AuthenticatedUser actor
    ) {
        Inspection inspection = loadAndAuthorizeInspection(item, payload, actor, true);
        validateOptimisticVersion(inspection, item, payload);

        if (inspection.getStatus() == InspectionStatus.ENVIADA
                || inspection.getStatus() == InspectionStatus.EM_REVISÃO) {
            throw SyncOperationException.conflict(
                    "A inspeção já se encontra no estado " + inspection.getStatus() + "."
            );
        }

        // RN-037: Valida que todos os itens obrigatórios do snapshot foram respondidos (ou possuem foto)
        List<InspectionItemSnapshot> snapshots = snapshotRepository
                .findByInspectionIdOrderBySectionOrderAscItemOrderAsc(inspection.getId());
        List<InspectionResponse> responses = inspectionResponseRepository
                .findByInspectionIdOrderByCreatedAtAsc(inspection.getId());
        List<EvidenceFile> evidences = evidenceFileRepository
                .findByInspectionIdOrderByCreatedAtAsc(inspection.getId());

        Set<UUID> answeredItemIds = new HashSet<>();
        for (InspectionResponse response : responses) {
            if (response.getValueRaw() != null && !response.getValueRaw().isBlank()) {
                answeredItemIds.add(response.getInspectionItemId());
            }
        }
        Set<UUID> itemIdsWithEvidence = new HashSet<>();
        for (EvidenceFile evidence : evidences) {
            if (evidence.getInspectionItemId() != null && evidence.getStatus() != EvidenceFileStatus.DELETED) {
                itemIdsWithEvidence.add(evidence.getInspectionItemId());
            }
        }

        List<String> missingTitles = new ArrayList<>();
        for (InspectionItemSnapshot snap : snapshots) {
            if (!snap.isRequired()) {
                continue;
            }
            boolean hasResponse = answeredItemIds.contains(snap.getId());
            boolean isPhotoSatisfied = snap.getResponseType() == ResponseType.PHOTO
                    && itemIdsWithEvidence.contains(snap.getId());
            if (!hasResponse && !isPhotoSatisfied) {
                missingTitles.add(snap.getItemTitle());
            }
        }
        if (!missingTitles.isEmpty()) {
            throw SyncOperationException.failed(
                    "REQUIRED_ITEMS_PENDING",
                    "Existem itens obrigatórios pendentes antes de concluir a inspeção: "
                            + String.join(", ", missingTitles)
            );
        }

        Instant completedAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "completedAt", "completed_at", "completedAtDevice")),
                clientTimestamp,
                serverTimestamp
        );
        Instant startedAtDevice = firstNonNullInstant(
                parseInstantOrNull(getString(payload, "startedAt", "started_at", "startedAtDevice")),
                inspection.getStartedAtDevice(),
                completedAtDevice
        );

        String previousStatus = inspection.getStatus().name();
        if (inspection.getStartedAtDevice() == null) {
            inspection.setStartedAtDevice(startedAtDevice);
        }
        if (inspection.getStartedAtServer() == null) {
            inspection.setStartedAtServer(serverTimestamp);
        }
        inspection.setStatus(InspectionStatus.ENVIADA);
        inspection.setCompletedAtDevice(completedAtDevice);
        inspection.setSubmittedAtServer(serverTimestamp);

        LocationCoordinates coords = extractLocation(payload);
        if (coords != null) {
            inspection.setCompleteLatitude(coords.latitude());
            inspection.setCompleteLongitude(coords.longitude());
            inspection.setCompleteAccuracy(coords.accuracy());
        }

        Inspection saved = inspectionRepository.saveAndFlush(inspection);

        recordAuditEvent(
                saved.getId(),
                actor,
                "INSPECTION_COMPLETED",
                "INSPECTION",
                saved.getId(),
                previousStatus,
                saved.getStatus().name(),
                "{\"status\":\"" + previousStatus + "\"}",
                "{\"status\":\"ENVIADA\",\"completedAtDevice\":\"" + completedAtDevice + "\"}",
                operationId.toString(),
                completedAtDevice,
                serverTimestamp,
                "Inspeção concluída no dispositivo e enviada via sincronização em lote."
        );

        return new OperationOutcome(
                saved.getId(),
                saved.getId(),
                completedAtDevice,
                "Inspeção concluída e enviada com sucesso."
        );
    }

    private Inspection loadAndAuthorizeInspection(
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload,
            AuthenticatedUser actor,
            boolean fallbackToGlobalId
    ) {
        UUID inspectionId = resolveUuid(
                payload,
                fallbackToGlobalId ? item.getGlobalId() : null,
                "remoteId",
                "remote_id",
                "remoteInspectionId",
                "remote_inspection_id",
                "inspectionId",
                "inspection_id"
        );
        if (inspectionId == null) {
            throw SyncOperationException.failed(
                    "INSPECTION_ID_REQUIRED",
                    "Identificador da inspeção (inspectionId) é obrigatório."
            );
        }

        Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                .orElseThrow(() -> SyncOperationException.failed(
                        "INSPECTION_NOT_FOUND",
                        "Inspeção não encontrada: " + inspectionId + "."
                ));

        validateActorAccess(inspection, actor);
        validateMutableInspectionState(inspection);
        return inspection;
    }

    private void validateActorAccess(Inspection inspection, AuthenticatedUser actor) {
        if (actor != null && (actor.getRole() == UserRole.SUPERVISOR || actor.getRole() == UserRole.ADMIN)) {
            throw SyncOperationException.failed(
                    "SILENT_RESPONSE_EDIT_FORBIDDEN",
                    "Supervisores e administradores não podem alterar respostas do técnico pelo fluxo de sincronização; utilize ajuste administrativo auditado."
            );
        }
        if (actor != null && actor.getRole() == UserRole.TECHNICIAN
                && !inspection.getTechnician().getId().equals(actor.getId())) {
            throw SyncOperationException.failed(
                    "FORBIDDEN_TECHNICIAN",
                    "Permissão negada: inspeção atribuída a outro técnico."
            );
        }
    }

    private String buildResponseAuditJson(UUID itemId, InspectionResponse response) {
        return "{"
                + "\"itemId\":\"" + itemId + "\","
                + "\"valueRaw\":" + (response.getValueRaw() != null ? "\"" + escapeJson(response.getValueRaw()) + "\"" : "null") + ","
                + "\"observation\":" + (response.getObservation() != null ? "\"" + escapeJson(response.getObservation()) + "\"" : "null") + ","
                + "\"conformity\":" + (response.getConformity() != null ? "\"" + escapeJson(response.getConformity()) + "\"" : "null")
                + "}";
    }

    private void validateMutableInspectionState(Inspection inspection) {
        if (inspection.getStatus() == InspectionStatus.APROVADA) {
            throw SyncOperationException.conflict(
                    "Inspeção já aprovada pelo supervisor não aceita alterações tardias."
            );
        }
        if (inspection.getStatus() == InspectionStatus.CANCELADA) {
            throw SyncOperationException.conflict(
                    "Inspeção já cancelada no servidor não aceita alterações tardias."
            );
        }
    }

    private void validateOptimisticVersion(
            Inspection inspection,
            SyncBatchRequest.OperationItem item,
            Map<String, Object> payload
    ) {
        Integer baseVersion = item.getBaseVersion();
        if (baseVersion == null) {
            baseVersion = getInteger(payload, "baseVersion", "base_version");
        }
        if (baseVersion != null && inspection.getVersion() != null && !baseVersion.equals(inspection.getVersion())) {
            throw SyncOperationException.conflict(
                    "Conflito de versão na inspeção: esperada " + baseVersion
                            + ", atual no servidor " + inspection.getVersion() + "."
            );
        }
    }

    private void applyTypedResponseValue(
            InspectionItemSnapshot snapshot,
            InspectionResponse response,
            String rawValue,
            Object rawValueObj
    ) {
        response.setValueRaw(rawValue);
        response.setValueText(null);
        response.setValueNumber(null);
        response.setValueBoolean(null);
        response.setValueDate(null);
        response.setValueJson(null);
        response.setConformity(null);

        if (rawValue == null || rawValue.isBlank()) {
            return;
        }

        ResponseType type = snapshot.getResponseType();
        switch (type) {
            case NUMBER -> {
                String normalized = rawValue.replace(",", ".");
                try {
                    response.setValueNumber(new BigDecimal(normalized));
                } catch (NumberFormatException ex) {
                    throw SyncOperationException.failed(
                            "INVALID_RESPONSE_VALUE",
                            "Valor numérico inválido para o item '" + snapshot.getItemTitle() + "': '" + rawValue + "'."
                    );
                }
            }
            case BOOLEAN -> {
                String normalized = rawValue.toLowerCase(Locale.ROOT);
                switch (normalized) {
                    case "true", "1", "sim", "yes" -> response.setValueBoolean(Boolean.TRUE);
                    case "false", "0", "nao", "não", "no" -> response.setValueBoolean(Boolean.FALSE);
                    default -> throw SyncOperationException.failed(
                            "INVALID_RESPONSE_VALUE",
                            "Valor booleano inválido para o item '" + snapshot.getItemTitle() + "': '" + rawValue + "'."
                    );
                }
            }
            case DATE -> {
                try {
                    String datePart = rawValue.length() >= 10 && rawValue.charAt(4) == '-' && rawValue.charAt(7) == '-'
                            ? rawValue.substring(0, 10)
                            : rawValue;
                    response.setValueDate(LocalDate.parse(datePart));
                } catch (DateTimeParseException ex) {
                    throw SyncOperationException.failed(
                            "INVALID_RESPONSE_VALUE",
                            "Formato de data inválido para o item '" + snapshot.getItemTitle() + "': '" + rawValue + "'."
                    );
                }
            }
            case CONFORMITY -> {
                String normalized = rawValue.toUpperCase(Locale.ROOT);
                switch (normalized) {
                    case "CONFORMING", "CONFORME" -> response.setConformity("CONFORMING");
                    case "NON_CONFORMING", "NAO_CONFORME", "NÃO_CONFORME", "NAO CONFORME", "NÃO CONFORME" ->
                            response.setConformity("NON_CONFORMING");
                    case "NOT_APPLICABLE", "NA", "N_A", "N/A", "NAO_APLICAVEL", "NÃO APLICÁVEL" ->
                            response.setConformity("NOT_APPLICABLE");
                    default -> throw SyncOperationException.failed(
                            "INVALID_RESPONSE_VALUE",
                            "Valor de conformidade inválido para o item '" + snapshot.getItemTitle() + "': '" + rawValue + "'."
                    );
                }
            }
            case SINGLE_CHOICE -> {
                List<String> allowed = snapshot.getOptions();
                if (allowed != null && !allowed.isEmpty()) {
                    boolean matches = allowed.stream().anyMatch(opt -> opt.equalsIgnoreCase(rawValue));
                    if (!matches) {
                        throw SyncOperationException.failed(
                                "INVALID_RESPONSE_VALUE",
                                "Opção '" + rawValue + "' não pertence às alternativas válidas do item '" + snapshot.getItemTitle() + "'."
                        );
                    }
                }
                response.setValueText(rawValue);
            }
            case TEXT_SHORT, TEXT_LONG, PHOTO -> response.setValueText(rawValue);
        }

        if (rawValueObj instanceof Map<?, ?> || rawValueObj instanceof List<?>) {
            try {
                response.setValueJson(objectMapper.writeValueAsString(rawValueObj));
            } catch (Exception ignored) {
            }
        }
    }

    private void linkEvidenceIdsToNonConformity(
            Map<String, Object> payload,
            UUID ncId,
            UUID inspectionId,
            UUID itemId,
            UUID responseId
    ) {
        Object rawList = payload.get("evidenceIds");
        if (rawList == null) {
            rawList = payload.get("evidence_ids");
        }
        if (!(rawList instanceof List<?> list) || list.isEmpty()) {
            return;
        }
        for (Object entry : list) {
            UUID evId = parseUuidOrNull(entry != null ? String.valueOf(entry) : null);
            if (evId == null) {
                continue;
            }
            evidenceFileRepository.findById(evId).ifPresent(ev -> {
                if (ev.getInspectionId().equals(inspectionId)) {
                    ev.setNonConformityId(ncId);
                    if (ev.getInspectionItemId() == null && itemId != null) {
                        ev.setInspectionItemId(itemId);
                    }
                    if (ev.getResponseId() == null && responseId != null) {
                        ev.setResponseId(responseId);
                    }
                    evidenceFileRepository.save(ev);
                }
            });
        }
    }

    private SyncBatchResponse.ProcessedItem buildAlreadyProcessedResult(
            ProcessedOperation existing,
            Instant fallbackClientTimestamp
    ) {
        return new SyncBatchResponse.ProcessedItem(
                existing.getOperationId().toString(),
                existing.getOperationType(),
                existing.getEntityId() != null ? existing.getEntityId().toString() : null,
                true,
                "ALREADY_PROCESSED",
                "ALREADY_PROCESSED",
                "Operação já processada anteriormente (idempotência).",
                existing.getClientTimestamp() != null ? existing.getClientTimestamp() : fallbackClientTimestamp,
                existing.getServerTimestamp()
        );
    }

    /**
     * Ordena operações respeitando a precedência causal (RF-04) e dependências declaradas (RN-069).
     */
    private List<SyncBatchRequest.OperationItem> orderOperationsByDependencies(
            List<SyncBatchRequest.OperationItem> operations
    ) {
        if (operations.size() <= 1) {
            return operations;
        }

        List<IndexedOp> nodes = new ArrayList<>(operations.size());
        Set<String> batchOpIds = new HashSet<>();
        for (int i = 0; i < operations.size(); i++) {
            SyncBatchRequest.OperationItem item = operations.get(i);
            String opId = item != null ? trimToNull(item.getOperationId()) : null;
            if (opId != null) {
                batchOpIds.add(opId.toLowerCase(Locale.ROOT));
            }
            SyncOperationType type = item != null ? SyncOperationType.fromValue(item.getOperationType()) : null;
            int order = type != null ? type.getDependencyOrder() : 50;
            Set<String> deps = new HashSet<>();
            if (item != null && item.getDependencies() != null) {
                for (String dep : item.getDependencies()) {
                    String trimmed = trimToNull(dep);
                    if (trimmed != null) {
                        deps.add(trimmed.toLowerCase(Locale.ROOT));
                    }
                }
            }
            nodes.add(new IndexedOp(i, opId != null ? opId.toLowerCase(Locale.ROOT) : null, order, deps, item));
        }

        List<SyncBatchRequest.OperationItem> ordered = new ArrayList<>(operations.size());
        Set<String> scheduledIds = new HashSet<>();
        boolean[] used = new boolean[nodes.size()];

        while (ordered.size() < nodes.size()) {
            IndexedOp bestReady = null;
            for (IndexedOp candidate : nodes) {
                if (used[candidate.index()]) {
                    continue;
                }
                boolean ready = true;
                for (String dep : candidate.dependencies()) {
                    if (batchOpIds.contains(dep) && !scheduledIds.contains(dep)) {
                        ready = false;
                        break;
                    }
                }
                if (ready && (bestReady == null || compareOps(candidate, bestReady) < 0)) {
                    bestReady = candidate;
                }
            }

            if (bestReady == null) {
                // Fallback determinístico em caso de ciclo declarado nas dependências
                for (IndexedOp candidate : nodes) {
                    if (!used[candidate.index()] && (bestReady == null || compareOps(candidate, bestReady) < 0)) {
                        bestReady = candidate;
                    }
                }
            }

            used[bestReady.index()] = true;
            if (bestReady.normalizedOpId() != null) {
                scheduledIds.add(bestReady.normalizedOpId());
            }
            ordered.add(bestReady.item());
        }

        return ordered;
    }

    private int compareOps(IndexedOp a, IndexedOp b) {
        int orderCmp = Integer.compare(a.dependencyOrder(), b.dependencyOrder());
        return orderCmp != 0 ? orderCmp : Integer.compare(a.index(), b.index());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePayloadMap(Object rawPayload) {
        if (rawPayload == null) {
            return Collections.emptyMap();
        }
        if (rawPayload instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() != null) {
                    copy.put(String.valueOf(entry.getKey()), entry.getValue());
                }
            }
            return copy;
        }
        if (rawPayload instanceof String str) {
            String trimmed = str.trim();
            if (trimmed.isEmpty()) {
                return Collections.emptyMap();
            }
            try {
                Object parsed = objectMapper.readValue(trimmed, Object.class);
                if (parsed instanceof Map<?, ?> map) {
                    Map<String, Object> copy = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> entry : map.entrySet()) {
                        if (entry.getKey() != null) {
                            copy.put(String.valueOf(entry.getKey()), entry.getValue());
                        }
                    }
                    return copy;
                }
                throw new IllegalArgumentException("O payload JSON deve representar um objeto JSON.");
            } catch (IllegalArgumentException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new IllegalArgumentException("Payload JSON malformado: " + ex.getMessage(), ex);
            }
        }
        try {
            return objectMapper.convertValue(rawPayload, Map.class);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Formato de payload incompatível.", ex);
        }
    }

    private void recordAuditEvent(
            UUID inspectionId,
            AuthenticatedUser actor,
            String action,
            String entityType,
            UUID entityId,
            String previousStatus,
            String newStatus,
            String previousValueJson,
            String newValueJson,
            String requestId,
            Instant deviceOccurredAt,
            Instant occurredAt,
            String details
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
        auditLog.setRequestId(requestId);
        auditLog.setDeviceOccurredAt(deviceOccurredAt);
        auditLog.setOccurredAt(occurredAt);
        auditLog.setDetails(details);
        auditLogRepository.save(auditLog);
    }

    private LocationCoordinates extractLocation(Map<String, Object> payload) {
        Object locObj = payload.get("location");
        if (locObj instanceof Map<?, ?> rawMap) {
            Map<String, Object> locMap = new HashMap<>();
            rawMap.forEach((k, v) -> {
                if (k != null) {
                    locMap.put(String.valueOf(k), v);
                }
            });
            BigDecimal lat = getBigDecimal(locMap, "latitude");
            BigDecimal lng = getBigDecimal(locMap, "longitude");
            BigDecimal acc = getBigDecimal(locMap, "accuracy");
            if (lat != null && lng != null) {
                return new LocationCoordinates(lat, lng, acc);
            }
        }
        BigDecimal lat = getBigDecimal(payload, "latitude");
        BigDecimal lng = getBigDecimal(payload, "longitude");
        BigDecimal acc = getBigDecimal(payload, "accuracy");
        if (lat != null && lng != null) {
            return new LocationCoordinates(lat, lng, acc);
        }
        return null;
    }

    private String resolveBatchId(SyncBatchRequest request, String headerBatchId) {
        if (request != null && trimToNull(request.getBatchId()) != null) {
            return request.getBatchId().trim();
        }
        if (trimToNull(headerBatchId) != null) {
            return headerBatchId.trim();
        }
        return UUID.randomUUID().toString();
    }

    private String resolveEntityType(String rawEntityType, SyncOperationType opType) {
        String trimmed = trimToNull(rawEntityType);
        if (trimmed != null) {
            return trimmed;
        }
        return switch (opType) {
            case START_INSPECTION, COMPLETE_INSPECTION -> "INSPECTION";
            case SAVE_RESPONSE -> "CHECKLIST_RESPONSE";
            case UPLOAD_EVIDENCE -> "EVIDENCE";
            case CREATE_NON_CONFORMITY, UPDATE_NON_CONFORMITY, CANCEL_NON_CONFORMITY -> "NON_CONFORMITY";
        };
    }

    private UUID resolveUuid(Map<String, Object> payload, String fallback, String... keys) {
        for (String key : keys) {
            String value = getString(payload, key);
            UUID parsed = parseUuidOrNull(value);
            if (parsed != null) {
                return parsed;
            }
        }
        return parseUuidOrNull(fallback);
    }

    private UUID parseUuidOrNull(String raw) {
        String trimmed = trimToNull(raw);
        if (trimmed == null) {
            return null;
        }
        try {
            return UUID.fromString(trimmed);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String getString(Map<String, Object> map, String... keys) {
        if (map == null || map.isEmpty()) {
            return null;
        }
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null) {
                String str = String.valueOf(val);
                if (!str.isBlank() && !"null".equalsIgnoreCase(str.trim())) {
                    return str;
                }
            }
        }
        return null;
    }

    private Boolean getBoolean(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof Boolean bool) {
                return bool;
            }
            if (val instanceof Number num) {
                return num.intValue() != 0;
            }
            if (val != null) {
                String s = String.valueOf(val).trim().toLowerCase(Locale.ROOT);
                if ("true".equals(s) || "1".equals(s)) {
                    return Boolean.TRUE;
                }
                if ("false".equals(s) || "0".equals(s)) {
                    return Boolean.FALSE;
                }
            }
        }
        return null;
    }

    private Integer getInteger(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof Number num) {
                return num.intValue();
            }
            if (val != null) {
                try {
                    return Integer.parseInt(String.valueOf(val).trim());
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }

    private Long getLong(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof Number num) {
                return num.longValue();
            }
            if (val != null) {
                try {
                    return Long.parseLong(String.valueOf(val).trim());
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }

    private BigDecimal getBigDecimal(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val instanceof BigDecimal bd) {
                return bd;
            }
            if (val instanceof Number num) {
                return BigDecimal.valueOf(num.doubleValue());
            }
            if (val != null) {
                try {
                    return new BigDecimal(String.valueOf(val).trim());
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return null;
    }

    private Instant parseInstantOrNull(String raw) {
        String trimmed = trimToNull(raw);
        if (trimmed == null) {
            return null;
        }
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(trimmed).toInstant();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(trimmed).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
        }
        return null;
    }

    private Instant firstNonNullInstant(Instant... values) {
        for (Instant value : values) {
            if (value != null) {
                return value;
            }
        }
        return Instant.now();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private record IndexedOp(
            int index,
            String normalizedOpId,
            int dependencyOrder,
            Set<String> dependencies,
            SyncBatchRequest.OperationItem item
    ) {
    }

    private record OperationOutcome(
            UUID entityId,
            UUID inspectionId,
            Instant effectiveClientTimestamp,
            String message
    ) {
    }

    private record LocationCoordinates(
            BigDecimal latitude,
            BigDecimal longitude,
            BigDecimal accuracy
    ) {
    }
}
