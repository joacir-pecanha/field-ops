package com.fieldops.modules.master.controller;

import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.dto.ClientRequest;
import com.fieldops.modules.master.dto.ClientResponse;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.dto.SiteResponse;
import com.fieldops.modules.master.service.ClientService;
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
 * Controller REST para gestão de Clientes (TASK-007 Passo 5, AC-MASTER).
 */
@RestController
@RequestMapping("/api/v1/clients")
@Tag(name = "Clientes", description = "Cadastro, busca paginada e inativação lógica de clientes")
public class ClientController {

    private final ClientService clientService;
    private final SiteService siteService;

    public ClientController(ClientService clientService, SiteService siteService) {
        this.clientService = clientService;
        this.siteService = siteService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar clientes paginados", description = "Suporta paginação, ordenação, filtros por status/active e pesquisa textual por nome, razão social, código ou documento.")
    public ResponseEntity<PageResponse<ClientResponse>> list(
            @Parameter(description = "Pesquisa textual por nome, razão social, código, documento ou e-mail")
            @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Filtro por situação cadastral")
            @RequestParam(name = "status", required = false) MasterStatus status,
            @Parameter(description = "Filtro por registro ativo (true/false)")
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        return ResponseEntity.ok(clientService.list(search, status, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Buscar cliente por ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Cliente encontrado"),
        @ApiResponse(responseCode = "404", description = "Cliente não encontrado")
    })
    public ResponseEntity<ClientResponse> getById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(clientService.getById(id));
    }

    @GetMapping("/{clientId}/sites")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar locais de um cliente específico")
    public ResponseEntity<PageResponse<SiteResponse>> listClientSites(
            @PathVariable("clientId") UUID clientId,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "status", required = false) MasterStatus status,
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        clientService.getById(clientId);
        return ResponseEntity.ok(siteService.list(clientId, search, status, active, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Cadastrar cliente")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Cliente criado com sucesso"),
        @ApiResponse(responseCode = "400", description = "Erro de validação"),
        @ApiResponse(responseCode = "409", description = "Código de cliente já existente")
    })
    public ResponseEntity<ClientResponse> create(@Valid @RequestBody ClientRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clientService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Atualizar cliente")
    public ResponseEntity<ClientResponse> update(
            @PathVariable("id") UUID id,
            @Valid @RequestBody ClientRequest request
    ) {
        return ResponseEntity.ok(clientService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar cliente logicamente", description = "Preserva o cliente no banco (active=false, status=INACTIVE) para manter integridade histórica.")
    public ResponseEntity<ClientResponse> delete(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(clientService.deactivate(id));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar cliente")
    public ResponseEntity<ClientResponse> deactivate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(clientService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Reativar cliente")
    public ResponseEntity<ClientResponse> activate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(clientService.activate(id));
    }
}

