package com.fieldops.modules.template.dto;

import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.domain.TemplateVersion;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO de saída para modelo de inspeção e sua árvore atual de seções e itens.
 */
@Schema(description = "Dados de resposta de um modelo de inspeção")
public record TemplateResponse(
        UUID id,
        String code,
        String title,
        String description,
        String category,
        TemplateStatus status,
        boolean active,
        Integer version,
        Integer currentVersion,
        UUID activeVersionId,
        int totalSections,
        int totalItems,
        List<TemplateSectionResponse> sections,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt
) {
    public static TemplateResponse fromEntity(InspectionTemplate template, TemplateVersion workingVersion) {
        List<TemplateSectionResponse> sectionResponses = workingVersion != null
                ? workingVersion.getSections().stream().map(TemplateSectionResponse::fromEntity).toList()
                : List.of();
        int totalItems = sectionResponses.stream()
                .mapToInt(section -> section.items().size())
                .sum();
        return new TemplateResponse(
                template.getId(),
                template.getCode(),
                template.getTitle(),
                template.getDescription(),
                template.getCategory(),
                template.getStatus(),
                template.isActive(),
                template.getVersion(),
                template.getCurrentVersion(),
                workingVersion != null ? workingVersion.getId() : null,
                sectionResponses.size(),
                totalItems,
                sectionResponses,
                template.getCreatedBy(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }

    public static TemplateResponse summaryFromEntity(InspectionTemplate template, TemplateVersion workingVersion) {
        int totalSections = workingVersion != null ? workingVersion.getSections().size() : 0;
        int totalItems = workingVersion != null
                ? workingVersion.getSections().stream().mapToInt(s -> s.getItems().size()).sum()
                : 0;
        return new TemplateResponse(
                template.getId(),
                template.getCode(),
                template.getTitle(),
                template.getDescription(),
                template.getCategory(),
                template.getStatus(),
                template.isActive(),
                template.getVersion(),
                template.getCurrentVersion(),
                workingVersion != null ? workingVersion.getId() : null,
                totalSections,
                totalItems,
                List.of(),
                template.getCreatedBy(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }
}

