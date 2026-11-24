package com.fieldops.modules.inspection.controller;

import com.fieldops.modules.inspection.dto.DashboardMetricsResponse;
import com.fieldops.modules.inspection.service.DashboardMetricsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller REST agregador de indicadores operacionais do Dashboard Web (TASK-021 RT-01).
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(
    name = "Dashboard Operacional",
    description = "Indicadores agregados de inspeções, atrasos, revisões pendentes, não conformidades e atividades recentes"
)
public class DashboardController {

    private final DashboardMetricsService dashboardMetricsService;

    public DashboardController(DashboardMetricsService dashboardMetricsService) {
        this.dashboardMetricsService = dashboardMetricsService;
    }

    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Consultar métricas consolidadas do Dashboard operacional",
        description = "Retorna em uma única chamada agregada os contadores por estado, inspeções em atraso, aguardando revisão, distribuição de não conformidades por criticidade e inspeções recentes."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Métricas consolidadas retornadas com sucesso"),
        @ApiResponse(responseCode = "401", description = "Sessão ausente ou inválida"),
        @ApiResponse(responseCode = "403", description = "Acesso restrito a perfis ADMIN e SUPERVISOR")
    })
    public ResponseEntity<DashboardMetricsResponse> getMetrics(
            @Parameter(description = "Quantidade máxima de inspeções recentes retornadas (1 a 25)")
            @RequestParam(name = "recentLimit", required = false, defaultValue = "8") int recentLimit
    ) {
        return ResponseEntity.ok(dashboardMetricsService.getMetrics(recentLimit));
    }
}
