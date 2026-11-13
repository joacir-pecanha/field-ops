package com.fieldops.modules.template.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fieldops.modules.template.domain.ResponseType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Payload de entrada para item de checklist em modelo de inspeção (RF-02, RF-03, RT-01, RT-02).
 */
@Schema(description = "Dados de entrada de um item de checklist")
public record TemplateItemRequest(
        @Schema(description = "Código legível opcional do item", example = "EXT-001")
        @Size(max = 60, message = "O código do item deve ter no máximo 60 caracteres.")
        String code,

        @Schema(description = "Pergunta ou instrução do item", example = "O lacre está intacto?")
        @NotBlank(message = "O título do item é obrigatório.")
        @Size(max = 300, message = "O título do item deve ter no máximo 300 caracteres.")
        String title,

        @Schema(description = "Texto de ajuda ou orientação adicional ao técnico")
        @Size(max = 1000, message = "A descrição do item deve ter no máximo 1000 caracteres.")
        String description,

        @Schema(description = "Tipo de resposta aceito no MVP", example = "CONFORMITY")
        ResponseType responseType,

        @Schema(description = "Indica se a resposta ao item é obrigatória", example = "true")
        Boolean required,

        @Schema(description = "Exige observação quando marcado como não conforme", example = "true")
        @JsonAlias({"requireObservationOnFail", "require_observation_on_fail", "observation_required_on_failure"})
        Boolean observationRequiredOnFailure,

        @Schema(description = "Exige evidência fotográfica quando marcado como não conforme", example = "false")
        @JsonAlias({"requireEvidenceOnFail", "require_evidence_on_fail", "evidence_required_on_failure"})
        Boolean evidenceRequiredOnFailure,

        @Schema(description = "Lista estruturada de opções para itens do tipo SINGLE_CHOICE")
        List<String> options,

        @Schema(description = "Representação JSON alternativa das opções de SINGLE_CHOICE")
        String optionsJson,

        @Schema(description = "Ordem explícita de exibição do item dentro da seção", example = "0")
        @JsonAlias({"displayOrder", "order_index"})
        Integer orderIndex
) {
}

