package com.fieldops.modules.master.controller;

import com.fieldops.modules.master.domain.EquipmentStatus;
import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.dto.EquipmentResponse;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.dto.SiteRequest;
import com.fieldops.modules.master.dto.SiteResponse;
import com.fieldops.modules.master.service.EquipmentService;
import com.fieldops.modules.master.service.SiteService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Controller REST para gestão de Locais de Inspeção (TASK-007 Passo 5, RF-01, AC-MASTER).
 */
@RestController
@RequestMapping("/api/v1/sites")
@Tag(name = "Locais de Inspeção", description = "Cadastro hierárquico de locais vinculados a clientes e inativação lógica")
public class SiteController {

    private final SiteService siteService;
    private final EquipmentService equipmentService;

    public SiteController(SiteService siteService, EquipmentService equipmentService) {
        this.siteService = siteService;
        this.equipmentService = equipmentService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar locais paginados", description = "Suporta filtro por cliente (clientId), pesquisa textual por nome/código/cidade e paginação.")
    public ResponseEntity<PageResponse<SiteResponse>> list(
            @Parameter(description = "Filtrar locais pelo UUID do cliente proprietário")
            @RequestParam(name = "clientId", required = false) UUID clientId,
            @Parameter(description = "Pesquisa textual por nome, código, cidade ou endereço")
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) MasterStatus status,
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        return ResponseEntity.ok(siteService.list(clientId, search, status, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Buscar local por ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Local encontrado"),
        @ApiResponse(responseCode = "404", description = "Local não encontrado")
    })
    public ResponseEntity<SiteResponse> getById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(siteService.getById(id));
    }

    @GetMapping("/{siteId}/equipments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar equipamentos de um local específico")
    public ResponseEntity<PageResponse<EquipmentResponse>> listSiteEquipments(
            @PathVariable("siteId") UUID siteId,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) EquipmentStatus status,
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        siteService.getById(siteId);
        return ResponseEntity.ok(equipmentService.list(null, siteId, search, status, active, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Cadastrar local", description = "Exige vínculo com um cliente ativo (RN-009).")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Local criado com sucesso"),
        @ApiResponse(responseCode = "400", description = "Erro de validação"),
        @ApiResponse(responseCode = "404", description = "Cliente proprietário não encontrado"),
        @ApiResponse(responseCode = "422", description = "Cliente proprietário inativo")
    })
    public ResponseEntity<SiteResponse> create(@Valid @RequestBody SiteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(siteService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Atualizar local")
    public ResponseEntity<SiteResponse> update(
            @PathVariable("id") UUID id,
            @Valid @RequestBody SiteRequest request
    ) {
        return ResponseEntity.ok(siteService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar local logicamente", description = "Preserva o local no banco (active=false, status=INACTIVE) para manter integridade histórica.")
    public ResponseEntity<SiteResponse> delete(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(siteService.deactivate(id));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar local")
    public ResponseEntity<SiteResponse> deactivate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(siteService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Reativar local")
    public ResponseEntity<SiteResponse> activate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(siteService.activate(id));
    }
}

