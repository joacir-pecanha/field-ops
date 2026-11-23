package com.fieldops.modules.inspection.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Payload de entrada opcional para aprovação de inspeção pelo supervisor (RF-03, RN-081).
 */
@Schema(description = "Requisição para aprovação de inspeção com comentários técnicos opcionais")
public record ApproveInspectionRequest(
        @Schema(description = "Comentários ou parecer técnico opcional da aprovação", example = "Checklist validado integralmente; conformidade confirmada.")
        @Size(max = 2000, message = "Os comentários da aprovação devem ter no máximo 2000 caracteres.")
        String comments,

        @Schema(description = "Alias opcional para comentário", hidden = true)
        @Size(max = 2000, message = "Os comentários da aprovação devem ter no máximo 2000 caracteres.")
        String comment,

        @Schema(description = "Alias opcional para comentários da revisão", hidden = true)
        @Size(max = 2000, message = "Os comentários da aprovação devem ter no máximo 2000 caracteres.")
        String reviewComments,

        @JsonProperty("review_comments")
        @Schema(description = "Alias snake_case opcional para comentários da revisão", hidden = true)
        @Size(max = 2000, message = "Os comentários da aprovação devem ter no máximo 2000 caracteres.")
        String reviewCommentsSnake,

        @Schema(description = "Alias opcional para notas", hidden = true)
        @Size(max = 2000, message = "Os comentários da aprovação devem ter no máximo 2000 caracteres.")
        String notes
) {
    public String effectiveComments() {
        for (String candidate : new String[]{comments, comment, reviewComments, reviewCommentsSnake, notes}) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim();
            }
        }
        return null;
    }
}
