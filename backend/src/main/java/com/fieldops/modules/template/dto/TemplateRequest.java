package com.fieldops.modules.template.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Payload de entrada para criação e edição de rascunho de modelo de inspeção (RF-01, RN-015, RN-018).
 */
@Schema(description = "Dados de entrada para criação ou edição de modelo de inspeção")
public record TemplateRequest(
        @Schema(description = "Código identificador único opcional do modelo", example = "TPL-EXT-01")
        @Size(max = 60, message = "O código do modelo deve ter no máximo 60 caracteres.")
        @Pattern(
                regexp = "^$|^[A-Za-z0-9_-]+$",
                message = "O código do modelo deve conter apenas letras, números, hífen ou underscore."
        )
        String code,

        @Schema(description = "Título do modelo de inspeção", example = "Checklist de Inspeção de Extintores")
        @NotBlank(message = "O título do modelo é obrigatório.")
        @Size(max = 200, message = "O título do modelo deve ter no máximo 200 caracteres.")
        String title,

        @Schema(description = "Descrição detalhada do escopo do modelo")
        @Size(max = 1000, message = "A descrição do modelo deve ter no máximo 1000 caracteres.")
        String description,

        @Schema(description = "Categoria operacional do modelo", example = "SEGURANCA")
        @NotBlank(message = "A categoria do modelo é obrigatória.")
        @Size(max = 100, message = "A categoria do modelo deve ter no máximo 100 caracteres.")
        String category,

        @Schema(description = "Lista de seções e itens do checklist")
        List<@Valid TemplateSectionRequest> sections
) {
}

