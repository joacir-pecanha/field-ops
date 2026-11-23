package com.fieldops.modules.inspection.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Payload de entrada para reprovação de inspeção com motivo obrigatório (RF-05, RN-080, EX-01).
 * A obrigatoriedade é validada no serviço para garantir HTTP 400 com a mensagem exata exigida.
 */
@Schema(description = "Requisição para reprovação de inspeção com motivo explicativo obrigatório")
public record RejectInspectionRequest(
        @JsonProperty("rejection_reason")
        @Schema(description = "Motivo obrigatório da reprovação para correção pelo técnico", example = "Foto do painel está ilegível e falta medição do horímetro.")
        @Size(max = 2000, message = "O motivo da reprovação deve ter no máximo 2000 caracteres.")
        String rejectionReasonSnake,

        @Schema(description = "Alias camelCase para motivo da reprovação", hidden = true)
        @Size(max = 2000, message = "O motivo da reprovação deve ter no máximo 2000 caracteres.")
        String rejectionReason,

        @Schema(description = "Alias para motivo da reprovação", hidden = true)
        @Size(max = 2000, message = "O motivo da reprovação deve ter no máximo 2000 caracteres.")
        String reason,

        @Schema(description = "Alias para justificativa da reprovação", hidden = true)
        @Size(max = 2000, message = "O motivo da reprovação deve ter no máximo 2000 caracteres.")
        String justification,

        @Schema(description = "Comentários adicionais opcionais do supervisor")
        @Size(max = 2000, message = "Os comentários devem ter no máximo 2000 caracteres.")
        String comments,

        @Schema(description = "Alias opcional para comentário", hidden = true)
        @Size(max = 2000, message = "Os comentários devem ter no máximo 2000 caracteres.")
        String comment
) {
    public String effectiveRejectionReason() {
        for (String candidate : new String[]{rejectionReasonSnake, rejectionReason, reason, justification}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }

    public String effectiveComments() {
        for (String candidate : new String[]{comments, comment}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }
}
