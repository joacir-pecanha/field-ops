package com.fieldops.modules.inspection.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Payload de entrada para ajuste administrativo diferenciado e auditado sobre resposta de campo (RF-07, RN-084, RN-085).
 */
@Schema(description = "Requisição para registro de ajuste administrativo auditado sem alterar a resposta original do técnico")
public record AdminResponseAdjustmentRequest(
        @Schema(description = "Valor ajustado administrativamente pelo supervisor/administrador", example = "1255.0")
        @Size(max = 2000, message = "O valor ajustado deve ter no máximo 2000 caracteres.")
        String adjustedValue,

        @JsonProperty("adjusted_value")
        @Schema(description = "Alias snake_case para valor ajustado", hidden = true)
        @Size(max = 2000, message = "O valor ajustado deve ter no máximo 2000 caracteres.")
        String adjustedValueSnake,

        @Schema(description = "Justificativa obrigatória do ajuste administrativo", example = "Correção de erro de digitação confirmado com o técnico em campo.")
        @Size(max = 1000, message = "A justificativa do ajuste administrativo deve ter no máximo 1000 caracteres.")
        String reason,

        @Schema(description = "Alias opcional para justificativa", hidden = true)
        @Size(max = 1000, message = "A justificativa do ajuste administrativo deve ter no máximo 1000 caracteres.")
        String justification,

        @JsonProperty("adjustment_reason")
        @Schema(description = "Alias snake_case para justificativa do ajuste", hidden = true)
        @Size(max = 1000, message = "A justificativa do ajuste administrativo deve ter no máximo 1000 caracteres.")
        String adjustmentReasonSnake
) {
    public String effectiveAdjustedValue() {
        for (String candidate : new String[]{adjustedValue, adjustedValueSnake}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }

    public String effectiveReason() {
        for (String candidate : new String[]{reason, justification, adjustmentReasonSnake}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }
}
