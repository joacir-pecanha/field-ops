package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.sync.domain.NonConformity;
import com.fieldops.modules.sync.domain.NonConformitySeverity;
import com.fieldops.modules.sync.domain.NonConformityStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de consulta das não conformidades vinculadas à inspeção para revisão administrativa.
 */
@Schema(description = "Não conformidade registrada durante a execução em campo")
public record InspectionNonConformityDto(
        UUID id,
        UUID inspectionId,
        UUID inspectionItemId,
        UUID responseId,
        String itemTitle,
        String title,
        String description,
        NonConformitySeverity severity,
        NonConformityStatus status,
        String canceledReason,
        UUID createdBy,
        Instant createdAtDevice,
        Instant serverReceivedAt,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static InspectionNonConformityDto fromEntity(NonConformity entity) {
        return new InspectionNonConformityDto(
                entity.getId(),
                entity.getInspectionId(),
                entity.getInspectionItemId(),
                entity.getResponseId(),
                entity.getItemTitle(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getSeverity(),
                entity.getStatus(),
                entity.getCanceledReason(),
                entity.getCreatedBy(),
                entity.getCreatedAtDevice(),
                entity.getServerReceivedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }
}
