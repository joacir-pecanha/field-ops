package com.fieldops.modules.template.dto;

import com.fieldops.modules.template.domain.TemplateVersion;
import com.fieldops.modules.template.domain.TemplateVersionStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO de saída de versão (rascunho ou publicada imutável) de um modelo de inspeção.
 */
@Schema(description = "Dados de resposta de uma versão de modelo de inspeção")
public record TemplateVersionResponse(
        UUID id,
        UUID templateId,
        Integer version,
        Integer versionNumber,
        TemplateVersionStatus status,
        String titleSnapshot,
        String descriptionSnapshot,
        String categorySnapshot,
        UUID publishedBy,
        Instant publishedAt,
        boolean activeForNewInspections,
        int totalSections,
        int totalItems,
        List<TemplateSectionResponse> sections,
        Instant createdAt,
        Instant updatedAt
) {
    public static TemplateVersionResponse fromEntity(TemplateVersion versionEntity) {
        List<TemplateSectionResponse> sectionResponses = versionEntity.getSections().stream()
                .map(TemplateSectionResponse::fromEntity)
                .toList();
        int totalItems = sectionResponses.stream()
                .mapToInt(section -> section.items().size())
                .sum();
        return new TemplateVersionResponse(
                versionEntity.getId(),
                versionEntity.getTemplate().getId(),
                versionEntity.getVersionNumber(),
                versionEntity.getVersionNumber(),
                versionEntity.getStatus(),
                versionEntity.getTitleSnapshot(),
                versionEntity.getDescriptionSnapshot(),
                versionEntity.getCategorySnapshot(),
                versionEntity.getPublishedBy(),
                versionEntity.getPublishedAt(),
                versionEntity.isActiveForNewInspections(),
                sectionResponses.size(),
                totalItems,
                sectionResponses,
                versionEntity.getCreatedAt(),
                versionEntity.getUpdatedAt()
        );
    }
}

