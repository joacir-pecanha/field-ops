package com.fieldops.modules.sync.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fieldops.modules.sync.domain.EvidenceFile;
import com.fieldops.modules.sync.domain.EvidenceFileStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de resposta do upload multipart de evidência fotográfica (RF-07, RT-03).
 */
@Schema(description = "Metadados e status de rastreamento do arquivo de evidência enviado")
public record EvidenceUploadResponse(
        @JsonProperty("evidence_id")
        UUID evidenceId,

        @JsonProperty("operation_id")
        UUID operationId,

        @JsonProperty("inspection_id")
        UUID inspectionId,

        @JsonProperty("inspection_item_id")
        UUID inspectionItemId,

        @JsonProperty("response_id")
        UUID responseId,

        @JsonProperty("non_conformity_id")
        UUID nonConformityId,

        @JsonProperty("file_name")
        String fileName,

        @JsonProperty("original_file_name")
        String originalFileName,

        @JsonProperty("storage_key")
        String storageKey,

        @JsonProperty("mime_type")
        String mimeType,

        @JsonProperty("size_bytes")
        Long sizeBytes,

        @JsonProperty("checksum_sha256")
        String checksumSha256,

        EvidenceFileStatus status,

        @JsonProperty("already_processed")
        boolean alreadyProcessed,

        @JsonProperty("client_timestamp")
        Instant clientTimestamp,

        @JsonProperty("server_timestamp")
        Instant serverTimestamp,

        @JsonProperty("uploaded_at")
        Instant uploadedAt
) {
    public static EvidenceUploadResponse fromEntity(
            EvidenceFile entity,
            UUID operationId,
            boolean alreadyProcessed
    ) {
        return new EvidenceUploadResponse(
                entity.getId(),
                operationId,
                entity.getInspectionId(),
                entity.getInspectionItemId(),
                entity.getResponseId(),
                entity.getNonConformityId(),
                entity.getFileName(),
                entity.getOriginalFileName(),
                entity.getStorageKey(),
                entity.getMimeType(),
                entity.getSizeBytes(),
                entity.getChecksumSha256(),
                entity.getStatus(),
                alreadyProcessed,
                entity.getCapturedAtDevice(),
                entity.getServerReceivedAt(),
                entity.getUploadedAt()
        );
    }
}
