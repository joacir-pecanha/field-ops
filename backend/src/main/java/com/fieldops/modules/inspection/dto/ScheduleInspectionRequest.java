package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.inspection.domain.InspectionPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Payload de entrada para agendamento e atribuição de inspeção com geração imediata de snapshot
 * (RF-01..RF-06, TASK-011).
 */
@Schema(description = "Requisição para agendar e atribuir uma inspeção a um técnico ativo")
public record ScheduleInspectionRequest(
        @Schema(description = "ID do modelo de inspeção (usa a versão publicada ativa caso templateVersionId não seja informado)")
        UUID templateId,

        @Schema(description = "ID específico da versão publicada do modelo de inspeção")
        UUID templateVersionId,

        @Schema(description = "Número da versão publicada do modelo (opcional quando templateId for informado)")
        Integer templateVersionNumber,

        @Schema(description = "ID do cliente proprietário do local", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "O cliente (clientId) é obrigatório.")
        UUID clientId,

        @Schema(description = "ID do local pertencente ao cliente", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "O local de inspeção (siteId) é obrigatório.")
        UUID siteId,

        @Schema(description = "ID do equipamento pertencente ao local (opcional quando a inspeção for do ambiente/local)")
        UUID equipmentId,

        @Schema(description = "ID do técnico ativo responsável pela execução (MVP: técnico único)", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "O técnico responsável (technicianId) é obrigatório.")
        UUID technicianId,

        @Schema(description = "ID do supervisor responsável (assume o usuário autenticado se omitido)")
        UUID supervisorId,

        @Schema(description = "Data e hora prevista em ISO-8601 (ex.: 2026-11-20T14:00:00Z ou 2026-11-20)", example = "2026-11-20T14:00:00Z")
        String scheduledFor,

        @Schema(description = "Alias opcional para data prevista (scheduledFor)", hidden = true)
        String dueDate,

        @Schema(description = "Título personalizado da inspeção (gerado automaticamente se omitido)", example = "Inspeção Preventiva - Gerador GD-001")
        @Size(max = 250, message = "O título deve ter no máximo 250 caracteres.")
        String title,

        @Schema(description = "Instruções ou observações adicionais para o técnico")
        @Size(max = 2000, message = "As instruções devem ter no máximo 2000 caracteres.")
        String instructions,

        @Schema(description = "Prioridade operacional (BAIXA, MEDIA, ALTA, URGENTE, CRITICA)", example = "ALTA")
        InspectionPriority priority
) {
    public String effectiveScheduledFor() {
        if (scheduledFor != null && !scheduledFor.isBlank()) {
            return scheduledFor.trim();
        }
        if (dueDate != null && !dueDate.isBlank()) {
            return dueDate.trim();
        }
        return null;
    }
}
