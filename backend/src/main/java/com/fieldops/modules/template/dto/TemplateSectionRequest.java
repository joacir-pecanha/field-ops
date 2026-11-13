package com.fieldops.modules.template.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Payload de entrada para seção de checklist de um modelo de inspeção (RF-03).
 */
@Schema(description = "Dados de entrada de uma seção de checklist")
public record TemplateSectionRequest(
        @Schema(description = "Título da seção", example = "Condições físicas")
        @NotBlank(message = "O título da seção é obrigatório.")
        @Size(max = 200, message = "O título da seção deve ter no máximo 200 caracteres.")
        String title,

        @Schema(description = "Descrição opcional da seção")
        @Size(max = 500, message = "A descrição da seção deve ter no máximo 500 caracteres.")
        String description,

        @Schema(description = "Ordem explícita de exibição da seção", example = "0")
        @JsonAlias({"displayOrder", "order_index"})
        Integer orderIndex,

        @Schema(description = "Itens pertencentes à seção")
        List<@Valid TemplateItemRequest> items
) {
}

