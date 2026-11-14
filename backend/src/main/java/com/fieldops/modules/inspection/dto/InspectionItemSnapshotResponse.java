package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.inspection.domain.InspectionItemSnapshot;
import com.fieldops.modules.template.domain.ResponseType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Representação imutável de um item do checklist congelado no snapshot da inspeção.
 */
@Schema(description = "Item imutável do snapshot de checklist da inspeção")
public record InspectionItemSnapshotResponse(
        UUID id,
        UUID inspectionId,
        UUID sourceTemplateItemId,
        String sectionTitle,
        String sectionDescription,
        Integer sectionOrder,
        String itemCode,
        String itemTitle,
        String itemDescription,
        ResponseType responseType,
        boolean required,
        boolean observationRequiredOnFailure,
        boolean evidenceRequiredOnFailure,
        String rulesJson,
        List<String> options,
        String optionsJson,
        Integer itemOrder,
        Instant createdAt
) {
    public static InspectionItemSnapshotResponse fromEntity(InspectionItemSnapshot entity) {
        List<String> safeOptions = entity.getOptions() != null
                ? List.copyOf(entity.getOptions())
                : List.of();
        return new InspectionItemSnapshotResponse(
                entity.getId(),
                entity.getInspection() != null ? entity.getInspection().getId() : null,
                entity.getSourceTemplateItemId(),
                entity.getSectionTitle(),
                entity.getSectionDescription(),
                entity.getSectionOrder(),
                entity.getItemCode(),
                entity.getItemTitle(),
                entity.getItemDescription(),
                entity.getResponseType(),
                entity.isRequired(),
                entity.isObservationRequiredOnFailure(),
                entity.isEvidenceRequiredOnFailure(),
                entity.getRulesJson(),
                safeOptions,
                entity.getOptionsJson(),
                entity.getItemOrder(),
                entity.getCreatedAt()
        );
    }
}
