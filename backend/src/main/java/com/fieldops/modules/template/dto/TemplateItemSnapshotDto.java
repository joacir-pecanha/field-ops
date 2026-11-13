package com.fieldops.modules.template.dto;

import com.fieldops.modules.template.domain.ResponseType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Item desnormalizado gerado a partir de uma versão publicada de template para consumo pelo módulo de agendamento (Passo 5).
 */
@Schema(description = "Item desnormalizado do snapshot de checklist")
public record TemplateItemSnapshotDto(
        UUID sourceTemplateId,
        UUID sourceTemplateVersionId,
        Integer templateVersionNumber,
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
}

