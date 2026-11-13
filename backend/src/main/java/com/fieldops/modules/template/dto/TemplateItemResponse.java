package com.fieldops.modules.template.dto;

import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.domain.TemplateItem;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO de saída de item de checklist de modelo de inspeção.
 */
@Schema(description = "Dados de resposta de um item de checklist")
public record TemplateItemResponse(
        UUID id,
        UUID sectionId,
        String code,
        String title,
        String description,
        ResponseType responseType,
        boolean required,
        boolean observationRequiredOnFailure,
        boolean requireObservationOnFail,
        boolean evidenceRequiredOnFailure,
        boolean requireEvidenceOnFail,
        List<String> options,
        String optionsJson,
        Integer orderIndex,
        Instant createdAt
) {
    public static TemplateItemResponse fromEntity(TemplateItem item) {
        List<String> safeOptions = item.getOptions() != null ? List.copyOf(item.getOptions()) : List.of();
        return new TemplateItemResponse(
                item.getId(),
                item.getSection().getId(),
                item.getCode(),
                item.getTitle(),
                item.getDescription(),
                item.getResponseType(),
                item.isRequired(),
                item.isObservationRequiredOnFailure(),
                item.isObservationRequiredOnFailure(),
                item.isEvidenceRequiredOnFailure(),
                item.isEvidenceRequiredOnFailure(),
                safeOptions,
                item.getOptionsJson(),
                item.getOrderIndex(),
                item.getCreatedAt()
        );
    }
}

