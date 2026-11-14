package com.fieldops.modules.inspection.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Payload de entrada para cancelamento administrativo de inspeção (RF-07, EX-02).
 * A obrigatoriedade da justificativa é validada no serviço para retornar HTTP 422 (EX-02).
 */
@Schema(description = "Requisição para cancelamento de inspeção com justificativa obrigatória")
public record CancelInspectionRequest(
        @Schema(description = "Justificativa do cancelamento (obrigatória)", example = "Equipamento parado para manutenção corretiva externa.")
        @Size(max = 1000, message = "A justificativa deve ter no máximo 1000 caracteres.")
        String reason,

        @Schema(description = "Alias opcional para justificativa", hidden = true)
        @Size(max = 1000, message = "A justificativa deve ter no máximo 1000 caracteres.")
        String justification,

        @Schema(description = "Alias opcional para justificativa", hidden = true)
        @Size(max = 1000, message = "A justificativa deve ter no máximo 1000 caracteres.")
        String canceledReason
) {
    public String effectiveReason() {
        for (String candidate : new String[]{reason, justification, canceledReason}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }
}
