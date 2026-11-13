package com.fieldops.modules.template.dto;

import com.fieldops.modules.template.domain.TemplateSection;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO de saída de seção de checklist de modelo de inspeção.
 */
@Schema(description = "Dados de resposta de uma seção de checklist")
public record TemplateSectionResponse(
        UUID id,
        UUID templateVersionId,
        String title,
        String description,
        Integer orderIndex,
        List<TemplateItemResponse> items,
        Instant createdAt
) {
    public static TemplateSectionResponse fromEntity(TemplateSection section) {
        List<TemplateItemResponse> itemResponses = section.getItems().stream()
                .map(TemplateItemResponse::fromEntity)
                .toList();
        return new TemplateSectionResponse(
                section.getId(),
                section.getTemplateVersion().getId(),
                section.getTitle(),
                section.getDescription(),
                section.getOrderIndex(),
                itemResponses,
                section.getCreatedAt()
        );
    }
}

