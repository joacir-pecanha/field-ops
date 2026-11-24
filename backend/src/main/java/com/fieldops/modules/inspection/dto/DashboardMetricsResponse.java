package com.fieldops.modules.inspection.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * DTO consolidado de métricas operacionais para o Dashboard Web (TASK-021 RT-01).
 */
@Schema(description = "Indicadores consolidados de monitoramento operacional de inspeções e não conformidades")
public record DashboardMetricsResponse(
        @Schema(description = "Total de inspeções operacionais (excluindo rascunhos)")
        long totalInspections,

        @Schema(description = "Quantidade de inspeções em andamento (EM_ANDAMENTO)")
        long inProgressCount,

        @Schema(description = "Quantidade de inspeções aguardando revisão (ENVIADA + EM_REVISÃO)")
        long awaitingReviewCount,

        @Schema(description = "Quantidade de inspeções em atraso (data prevista expirada em estado pendente)")
        long overdueCount,

        @Schema(description = "Quantidade de inspeções atribuídas (ATRIBUÍDA)")
        long assignedCount,

        @Schema(description = "Quantidade de inspeções enviadas (ENVIADA)")
        long submittedCount,

        @Schema(description = "Quantidade de inspeções em revisão (EM_REVISÃO)")
        long underReviewCount,

        @Schema(description = "Quantidade de inspeções aprovadas (APROVADA)")
        long approvedCount,

        @Schema(description = "Quantidade de inspeções reprovadas (REPROVADA)")
        long rejectedCount,

        @Schema(description = "Quantidade de inspeções canceladas (CANCELADA)")
        long canceledCount,

        @Schema(description = "Mapa de contagem de inspeções agrupadas por estado operacional")
        Map<String, Long> inspectionsByStatus,

        @Schema(description = "Total de não conformidades ativas registradas")
        long totalNonConformities,

        @Schema(description = "Contagem de não conformidades ativas agrupadas por severidade (BAIXA, MEDIA, ALTA, CRITICA)")
        Map<String, Long> nonConformitiesBySeverity,

        @Schema(description = "Lista resumida das inspeções com movimentação mais recente")
        List<InspectionDetailsResponse> recentInspections,

        @Schema(description = "Instante de geração do agregado no servidor")
        Instant generatedAt
) {
}
