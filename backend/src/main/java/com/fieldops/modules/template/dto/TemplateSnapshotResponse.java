package com.fieldops.modules.template.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Snapshot completo e desnormalizado de uma versão publicada de modelo de inspeção (Passo 5).
 */
@Schema(description = "Snapshot completo de checklist gerado a partir de versão publicada")
public record TemplateSnapshotResponse(
        UUID templateId,
        String templateCode,
        UUID templateVersionId,
        Integer version,
        Integer versionNumber,
        String titleSnapshot,
        String descriptionSnapshot,
        String categorySnapshot,
        Instant publishedAt,
        int totalSections,
        int totalItems,
        List<TemplateItemSnapshotDto> items
) {
}

