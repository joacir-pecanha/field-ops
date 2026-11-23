package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.sync.domain.InspectionResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de exibição de resposta de campo preservando dados do técnico e eventuais ajustes administrativos (RF-07, RN-084).
 */
@Schema(description = "Resposta do item de checklist com separação explícita entre dado de campo e ajuste administrativo")
public record InspectionResponseReviewDto(
        UUID id,
        UUID inspectionId,
        UUID inspectionItemId,
        String valueRaw,
        String valueText,
        BigDecimal valueNumber,
        Boolean valueBoolean,
        LocalDate valueDate,
        String valueJson,
        String observation,
        String conformity,
        boolean nonConformity,
        String nonConformityDescription,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracy,
        UUID answeredBy,
        Instant answeredAtDevice,
        Instant serverReceivedAt,
        boolean adminAdjusted,
        String adminAdjustedValue,
        String adminAdjustmentReason,
        UUID adminAdjustedBy,
        String adminAdjustedByName,
        Instant adminAdjustedAt,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static InspectionResponseReviewDto fromEntity(
            InspectionResponse entity,
            Map<UUID, String> userNamesById
    ) {
        String adjustedByName = entity.getAdminAdjustedBy() != null && userNamesById != null
                ? userNamesById.get(entity.getAdminAdjustedBy())
                : null;
        return new InspectionResponseReviewDto(
                entity.getId(),
                entity.getInspectionId(),
                entity.getInspectionItemId(),
                entity.getValueRaw(),
                entity.getValueText(),
                entity.getValueNumber(),
                entity.getValueBoolean(),
                entity.getValueDate(),
                entity.getValueJson(),
                entity.getObservation(),
                entity.getConformity(),
                entity.isNonConformity(),
                entity.getNonConformityDescription(),
                entity.getLatitude(),
                entity.getLongitude(),
                entity.getAccuracy(),
                entity.getAnsweredBy(),
                entity.getAnsweredAtDevice(),
                entity.getServerReceivedAt(),
                entity.isAdminAdjusted(),
                entity.getAdminAdjustedValue(),
                entity.getAdminAdjustmentReason(),
                entity.getAdminAdjustedBy(),
                adjustedByName,
                entity.getAdminAdjustedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }
}
