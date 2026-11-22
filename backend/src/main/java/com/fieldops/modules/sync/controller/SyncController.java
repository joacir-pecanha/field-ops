package com.fieldops.modules.sync.controller;

import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.dto.EvidenceUploadResponse;
import com.fieldops.modules.sync.dto.SyncBatchRequest;
import com.fieldops.modules.sync.dto.SyncBatchResponse;
import com.fieldops.modules.sync.exception.InvalidEvidenceFileException;
import com.fieldops.modules.sync.service.EvidenceStorageService;
import com.fieldops.modules.sync.service.SyncBatchProcessor;
import com.fieldops.security.jwt.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Controller REST de sincronização offline-first em lote e upload multipart de evidências (TASK-018).
 */
@RestController
@RequestMapping("/api/v1/sync")
@Tag(
    name = "Sincronização e Evidências",
    description = "Processamento idempotente em lote da Outbox móvel e upload multipart de fotografias"
)
public class SyncController {

    private final SyncBatchProcessor syncBatchProcessor;
    private final EvidenceStorageService evidenceStorageService;

    public SyncController(
            SyncBatchProcessor syncBatchProcessor,
            EvidenceStorageService evidenceStorageService
    ) {
        this.syncBatchProcessor = syncBatchProcessor;
        this.evidenceStorageService = evidenceStorageService;
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(
        summary = "Processar lote de mutações offline de forma idempotente",
        description = "Recebe operações da Outbox ordenando por dependência causal (START_INSPECTION -> SAVE_RESPONSE -> CREATE_NON_CONFORMITY -> COMPLETE_INSPECTION), garante idempotência por operation_id e isola falhas individuais sem descartar operações válidas."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Lote processado com status consolidado e resultado individual por operation_id"),
        @ApiResponse(responseCode = "400", description = "Corpo da requisição inválido ou malformado"),
        @ApiResponse(responseCode = "401", description = "Sessão não autenticada")
    })
    public ResponseEntity<SyncBatchResponse> syncBatch(
            @RequestBody SyncBatchRequest request,
            @Parameter(description = "Identificador idempotente do lote")
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Parameter(description = "Identificador alternativo do lote")
            @RequestHeader(value = "X-Batch-Id", required = false) String batchIdHeader
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        String effectiveHeaderBatchId = batchIdHeader != null && !batchIdHeader.isBlank()
                ? batchIdHeader
                : idempotencyKeyHeader;
        SyncBatchResponse response = syncBatchProcessor.processBatch(request, effectiveHeaderBatchId, actor);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(
        summary = "Upload multipart de fotografia de evidência",
        description = "Valida formato JPEG/PNG e integridade dos bytes, calcula hash SHA-256, armazena o arquivo com nome baseado no UUID e vincula à inspeção/resposta/não conformidade."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Evidência armazenada e vinculada com sucesso"),
        @ApiResponse(responseCode = "200", description = "Operação/arquivo já enviado anteriormente (replay idempotente)"),
        @ApiResponse(responseCode = "404", description = "Inspeção, item, resposta ou não conformidade não encontrada"),
        @ApiResponse(responseCode = "409", description = "Inspeção já aprovada ou cancelada não aceita novas evidências"),
        @ApiResponse(responseCode = "413", description = "Arquivo excede o limite de tamanho permitido"),
        @ApiResponse(responseCode = "415", description = "Formato inválido ou imagem corrompida (EX-02)")
    })
    public ResponseEntity<EvidenceUploadResponse> uploadEvidence(
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "inspectionId", required = false) UUID inspectionId,
            @RequestParam(value = "inspection_id", required = false) UUID inspectionIdSnake,
            @RequestParam(value = "evidenceId", required = false) UUID evidenceId,
            @RequestParam(value = "evidence_id", required = false) UUID evidenceIdSnake,
            @RequestParam(value = "operationId", required = false) UUID operationId,
            @RequestParam(value = "operation_id", required = false) UUID operationIdSnake,
            @RequestParam(value = "itemId", required = false) UUID itemId,
            @RequestParam(value = "item_id", required = false) UUID itemIdSnake,
            @RequestParam(value = "inspectionItemId", required = false) UUID inspectionItemId,
            @RequestParam(value = "inspection_item_id", required = false) UUID inspectionItemIdSnake,
            @RequestParam(value = "responseId", required = false) UUID responseId,
            @RequestParam(value = "response_id", required = false) UUID responseIdSnake,
            @RequestParam(value = "nonConformityId", required = false) UUID nonConformityId,
            @RequestParam(value = "non_conformity_id", required = false) UUID nonConformityIdSnake,
            @RequestParam(value = "clientTimestamp", required = false) String clientTimestamp,
            @RequestParam(value = "client_timestamp", required = false) String clientTimestampSnake,
            @RequestParam(value = "capturedAt", required = false) String capturedAt,
            @RequestParam(value = "checksum", required = false) String checksum,
            @RequestParam(value = "checksumSha256", required = false) String checksumSha256,
            @RequestParam(value = "checksum_sha256", required = false) String checksumSha256Snake,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "latitude", required = false) BigDecimal latitude,
            @RequestParam(value = "longitude", required = false) BigDecimal longitude,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyHeader
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();

        UUID resolvedInspectionId = firstNonNull(inspectionId, inspectionIdSnake);
        UUID resolvedEvidenceId = firstNonNull(evidenceId, evidenceIdSnake);
        UUID resolvedOperationId = firstNonNull(operationId, operationIdSnake, parseUuidOrNull(idempotencyHeader));
        UUID resolvedItemId = firstNonNull(itemId, itemIdSnake, inspectionItemId, inspectionItemIdSnake);
        UUID resolvedResponseId = firstNonNull(responseId, responseIdSnake);
        UUID resolvedNonConformityId = firstNonNull(nonConformityId, nonConformityIdSnake);
        String resolvedClientTimestamp = firstNonBlank(clientTimestamp, clientTimestampSnake, capturedAt);
        String resolvedChecksum = firstNonBlank(checksumSha256, checksumSha256Snake, checksum);

        if (file == null) {
            throw InvalidEvidenceFileException.unsupportedMediaType(
                    "EMPTY_OR_MISSING_IMAGE",
                    "O arquivo de imagem (campo 'file') é obrigatório para upload.",
                    resolvedEvidenceId,
                    null,
                    null
            );
        }

        EvidenceUploadResponse response = evidenceStorageService.storeEvidence(
                file,
                resolvedInspectionId,
                resolvedEvidenceId,
                resolvedOperationId,
                resolvedItemId,
                resolvedResponseId,
                resolvedNonConformityId,
                resolvedClientTimestamp,
                resolvedChecksum,
                description,
                latitude,
                longitude,
                actor
        );

        HttpStatus status = response.alreadyProcessed() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(response);
    }

    @GetMapping("/evidences/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(summary = "Consultar metadados e status individual de uma evidência enviada")
    public ResponseEntity<EvidenceUploadResponse> getEvidenceMetadata(@PathVariable("id") UUID id) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        EvidenceFile evidence = evidenceStorageService.getEvidenceMetadata(id, actor);
        return ResponseEntity.ok(EvidenceUploadResponse.fromEntity(evidence, null, false));
    }

    @GetMapping("/evidences/{id}/content")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(summary = "Baixar conteúdo binário da fotografia de evidência")
    public ResponseEntity<byte[]> getEvidenceContent(@PathVariable("id") UUID id) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        EvidenceFile evidence = evidenceStorageService.getEvidenceMetadata(id, actor);
        byte[] content = evidenceStorageService.loadEvidenceContent(evidence);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.getMimeType()))
                .contentLength(content.length)
                .cacheControl(CacheControl.noCache())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + evidence.getFileName() + "\"")
                .body(content);
    }

    private AuthenticatedUser extractAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser;
        }
        return null;
    }

    @SafeVarargs
    private <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private UUID parseUuidOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
