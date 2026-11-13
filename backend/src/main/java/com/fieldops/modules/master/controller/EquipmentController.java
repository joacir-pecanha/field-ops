package com.fieldops.modules.master.controller;

import com.fieldops.modules.master.domain.EquipmentStatus;
import com.fieldops.modules.master.dto.EquipmentRequest;
import com.fieldops.modules.master.dto.EquipmentResponse;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.service.EquipmentService;
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
 * Controller REST para gestão de Equipamentos e leitura por QR Code (TASK-007 Passo 5, RF-02, RF-03, EX-01).
 */
@RestController
@RequestMapping("/api/v1/equipments")
@Tag(name = "Equipamentos", description = "Cadastro de equipamentos vinculados a locais, unicidade de QR Code e inativação lógica")
public class EquipmentController {

    private final EquipmentService equipmentService;

    public EquipmentController(EquipmentService equipmentService) {
        this.equipmentService = equipmentService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar equipamentos paginados", description = "Suporta filtros por cliente (clientId), local (siteId), pesquisa textual por nome/código/QR Code/patrimônio e paginação.")
    public ResponseEntity<PageResponse<EquipmentResponse>> list(
            @Parameter(description = "Filtrar pelo UUID do cliente")
            @RequestParam(name = "clientId", required = false) UUID clientId,
            @Parameter(description = "Filtrar pelo UUID do local")
            @RequestParam(name = "siteId", required = false) UUID siteId,
            @Parameter(description = "Pesquisa textual por nome, código, QR Code, patrimônio ou número de série")
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) EquipmentStatus status,
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        return ResponseEntity.ok(equipmentService.list(clientId, siteId, search, status, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Buscar equipamento por ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Equipamento encontrado"),
        @ApiResponse(responseCode = "404", description = "Equipamento não encontrado")
    })
    public ResponseEntity<EquipmentResponse> getById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(equipmentService.getById(id));
    }

    @GetMapping("/qr/{qrCode}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Buscar equipamento por QR Code", description = "Consulta exata (case-insensitive) pelo QR Code físico do equipamento.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Equipamento encontrado"),
        @ApiResponse(responseCode = "404", description = "Nenhum equipamento encontrado para o QR Code")
    })
    public ResponseEntity<EquipmentResponse> getByQrCode(@PathVariable("qrCode") String qrCode) {
        return ResponseEntity.ok(equipmentService.getByQrCode(qrCode));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Cadastrar equipamento", description = "Exige vínculo com local ativo (RN-010) e QR Code único (RN-011).")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Equipamento criado com sucesso"),
        @ApiResponse(responseCode = "400", description = "Erro de validação"),
        @ApiResponse(responseCode = "404", description = "Local não encontrado"),
        @ApiResponse(responseCode = "409", description = "QR Code já cadastrado no sistema"),
        @ApiResponse(responseCode = "422", description = "Local ou cliente proprietário inativo")
    })
    public ResponseEntity<EquipmentResponse> create(@Valid @RequestBody EquipmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(equipmentService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Atualizar equipamento")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Equipamento atualizado"),
        @ApiResponse(responseCode = "404", description = "Equipamento ou local não encontrado"),
        @ApiResponse(responseCode = "409", description = "QR Code duplicado em outro equipamento")
    })
    public ResponseEntity<EquipmentResponse> update(
            @PathVariable("id") UUID id,
            @Valid @RequestBody EquipmentRequest request
    ) {
        return ResponseEntity.ok(equipmentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar equipamento logicamente", description = "Preserva o equipamento no banco (active=false, status=INACTIVE) mantendo integridade com inspeções históricas.")
    public ResponseEntity<EquipmentResponse> delete(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(equipmentService.deactivate(id));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar equipamento")
    public ResponseEntity<EquipmentResponse> deactivate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(equipmentService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Reativar equipamento")
    public ResponseEntity<EquipmentResponse> activate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(equipmentService.activate(id));
    }
}

