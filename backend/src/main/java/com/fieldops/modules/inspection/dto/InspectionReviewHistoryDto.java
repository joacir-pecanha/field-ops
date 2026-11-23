package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.inspection.domain.InspectionReview;
import com.fieldops.modules.inspection.domain.InspectionReviewDecision;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de histórico de ciclos de revisão técnica de uma inspeção (10.11.1, RN-083).
 */
@Schema(description = "Registro de um ciclo de revisão técnica da inspeção")
public record InspectionReviewHistoryDto(
        UUID id,
        UUID inspectionId,
        UUID reviewerId,
        String reviewerName,
        InspectionReviewDecision decision,
        String reason,
        String comments,
        Instant reviewedAt,
        Integer reviewCycle,
        Instant createdAt
) {
    public static InspectionReviewHistoryDto fromEntity(
            InspectionReview entity,
            Map<UUID, String> userNamesById
    ) {
        String reviewerName = userNamesById != null ? userNamesById.get(entity.getReviewerId()) : null;
        return new InspectionReviewHistoryDto(
                entity.getId(),
                entity.getInspectionId(),
                entity.getReviewerId(),
                reviewerName,
                entity.getDecision(),
                entity.getReason(),
                entity.getComments(),
                entity.getReviewedAt(),
                entity.getReviewCycle(),
                entity.getCreatedAt()
        );
    }
}
