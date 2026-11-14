package com.fieldops.modules.inspection.controller;

import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.AuditLogResponse;
import com.fieldops.modules.inspection.dto.CancelInspectionRequest;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.InspectionItemSnapshotResponse;
import com.fieldops.modules.inspection.dto.ScheduleInspectionRequest;
import com.fieldops.modules.inspection.service.InspectionSchedulingService;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.security.jwt.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.beans.PropertyEditorSupport;
import java.util.List;
import java.util.UUID;

/**
 * Controller REST para Agendamento, Snapshot de Checklist, Consulta de Atribuições
 * e Cancelamento de Inspeções (TASK-011 Passos 4 e 5).
 */
@RestController
@RequestMapping("/api/v1/inspections")
@Tag(
    name = "Agendamento e Inspeções",
    description = "Agendamento com snapshot imutável de checklist, atribuição para sincronização e cancelamento administrativo"
)
public class InspectionSchedulingController {

    private final InspectionSchedulingService schedulingService;

    public InspectionSchedulingController(InspectionSchedulingService schedulingService) {
        this.schedulingService = schedulingService;
    }

    @InitBinder
    void initBinder(WebDataBinder binder) {
        binder.registerCustomEditor(InspectionStatus.class, new PropertyEditorSupport() {
            @Override
            public void setAsText(String text) {
                setValue(InspectionStatus.fromValue(text));
            }
        });
        binder.registerCustomEditor(InspectionPriority.class, new PropertyEditorSupport() {
            @Override
            public void setAsText(String text) {
                setValue(InspectionPriority.fromValue(text));
            }
        });
    }

    @PostMapping({"/schedule", ""})
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Agendar e atribuir nova inspeção com geração imediata de snapshot",
        description = "Valida modelo publicado, compatibilidade cliente -> local -> equipamento e técnico ativo, congelando os itens do checklist em inspection_item_snapshots."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Inspeção agendada no estado ATRIBUÍDA com snapshot gerado"),
        @ApiResponse(responseCode = "400", description = "Dados inválidos ou técnico inativo/bloqueado (EX-01)"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para agendar inspeções"),
        @ApiResponse(responseCode = "404", description = "Cliente, local, equipamento, técnico ou modelo não encontrado"),
        @ApiResponse(responseCode = "422", description = "Incompatibilidade de local/equipamento, registro inativo ou modelo não publicado")
    })
    public ResponseEntity<InspectionDetailsResponse> schedule(@Valid @RequestBody ScheduleInspectionRequest request) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        InspectionDetailsResponse created = schedulingService.schedule(request, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Cancelar inspeção administrativamente",
        description = "Exige justificativa obrigatória (HTTP 422 se ausente), bloqueia inspeções já APROVADAS e registra trilha de auditoria."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Inspeção cancelada com sucesso"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para cancelar inspeções"),
        @ApiResponse(responseCode = "404", description = "Inspeção não encontrada"),
        @ApiResponse(responseCode = "422", description = "Justificativa ausente (EX-02) ou inspeção já aprovada/cancelada")
    })
    public ResponseEntity<InspectionDetailsResponse> cancel(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) CancelInspectionRequest request
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.cancel(id, request, actor));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Cancelar inspeção administrativamente (PATCH)",
        description = "Alias PATCH para cancelamento administrativo com justificativa obrigatória."
    )
    public ResponseEntity<InspectionDetailsResponse> cancelPatch(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) CancelInspectionRequest request
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.cancel(id, request, actor));
    }

    @GetMapping("/assigned")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(
        summary = "Consultar inspeções atribuídas a um técnico para sincronização",
        description = "Para técnicos autenticados, retorna apenas as próprias inspeções atribuídas com os itens de snapshot completos. Supervisores/Admins podem informar technicianId."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Lista de inspeções atribuídas com snapshot do checklist"),
        @ApiResponse(responseCode = "403", description = "Técnico tentando consultar inspeções de outro usuário")
    })
    public ResponseEntity<List<InspectionDetailsResponse>> listAssigned(
            @Parameter(description = "ID do técnico (obrigatório apenas quando consultado por supervisor/admin para outro técnico)")
            @RequestParam(name = "technicianId", required = false) UUID technicianId,
            @Parameter(description = "Filtro opcional por estado de negócio")
            @RequestParam(name = "status", required = false) InspectionStatus status,
            @Parameter(description = "Quando true e status omitido, inclui inspeções canceladas para ciência offline")
            @RequestParam(name = "includeCanceled", required = false, defaultValue = "false") boolean includeCanceled
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.listAssigned(technicianId, status, includeCanceled, actor));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(
        summary = "Listar inspeções paginadas com filtros",
        description = "Suporta filtros por texto, estado, prioridade, cliente, local, equipamento, técnico, período e atrasadas."
    )
    public ResponseEntity<PageResponse<InspectionDetailsResponse>> list(
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) InspectionStatus status,
            @RequestParam(name = "priority", required = false) InspectionPriority priority,
            @RequestParam(name = "clientId", required = false) UUID clientId,
            @RequestParam(name = "siteId", required = false) UUID siteId,
            @RequestParam(name = "equipmentId", required = false) UUID equipmentId,
            @RequestParam(name = "technicianId", required = false) UUID technicianId,
            @RequestParam(name = "supervisorId", required = false) UUID supervisorId,
            @RequestParam(name = "scheduledFrom", required = false) String scheduledFrom,
            @RequestParam(name = "scheduledTo", required = false) String scheduledTo,
            @RequestParam(name = "overdue", required = false) Boolean overdue,
            @ParameterObject @PageableDefault(size = 20, sort = "scheduledFor") Pageable pageable
    ) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.list(
                search,
                status,
                priority,
                clientId,
                siteId,
                equipmentId,
                technicianId,
                supervisorId,
                scheduledFrom,
                scheduledTo,
                overdue,
                pageable,
                actor
        ));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(summary = "Consultar detalhes completos da inspeção e seu snapshot")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Inspeção encontrada"),
        @ApiResponse(responseCode = "403", description = "Técnico tentando acessar inspeção de outro usuário"),
        @ApiResponse(responseCode = "404", description = "Inspeção não encontrada")
    })
    public ResponseEntity<InspectionDetailsResponse> getById(@PathVariable("id") UUID id) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.getById(id, actor));
    }

    @GetMapping("/{id}/snapshots")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'TECHNICIAN')")
    @Operation(summary = "Consultar itens congelados do snapshot da inspeção")
    public ResponseEntity<List<InspectionItemSnapshotResponse>> getSnapshots(@PathVariable("id") UUID id) {
        AuthenticatedUser actor = extractAuthenticatedUser();
        return ResponseEntity.ok(schedulingService.getSnapshots(id, actor));
    }

    @GetMapping("/{id}/audit-logs")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Consultar trilha de auditoria da inspeção")
    public ResponseEntity<List<AuditLogResponse>> getAuditLogs(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(schedulingService.getAuditLogs(id));
    }

    private AuthenticatedUser extractAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser;
        }
        return null;
    }
}
