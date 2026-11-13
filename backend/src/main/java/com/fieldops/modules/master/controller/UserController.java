package com.fieldops.modules.master.controller;

import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.master.dto.UserCreateRequest;
import com.fieldops.modules.master.dto.UserResponse;
import com.fieldops.modules.master.dto.UserUpdateRequest;
import com.fieldops.modules.master.service.UserMasterService;
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
 * Controller REST para gestão administrativa de Usuários (TASK-007 Passo 5, AC-USERS).
 */
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Usuários", description = "Gestão administrativa de usuários, perfis e inativação lógica")
public class UserController {

    private final UserMasterService userMasterService;

    public UserController(UserMasterService userMasterService) {
        this.userMasterService = userMasterService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Listar usuários paginados", description = "Suporta paginação, ordenação, filtro por role/status e pesquisa textual por nome ou e-mail.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Lista paginada retornada com sucesso"),
        @ApiResponse(responseCode = "401", description = "Não autenticado"),
        @ApiResponse(responseCode = "403", description = "Permissão insuficiente")
    })
    public ResponseEntity<PageResponse<UserResponse>> list(
            @Parameter(description = "Pesquisa textual por nome, e-mail ou telefone")
            @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Filtro por perfil")
            @RequestParam(name = "role", required = false) UserRole role,
            @Parameter(description = "Filtro por situação cadastral")
            @RequestParam(name = "status", required = false) UserStatus status,
            @Parameter(description = "Filtro booleano por situação ativa")
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        return ResponseEntity.ok(userMasterService.list(search, role, status, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Buscar usuário por ID")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Usuário encontrado"),
        @ApiResponse(responseCode = "404", description = "Usuário não encontrado")
    })
    public ResponseEntity<UserResponse> getById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(userMasterService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Cadastrar usuário", description = "Restrito ao perfil ADMIN.")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Usuário criado com sucesso"),
        @ApiResponse(responseCode = "400", description = "Erro de validação nos dados informados"),
        @ApiResponse(responseCode = "409", description = "E-mail já cadastrado")
    })
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userMasterService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Atualizar usuário", description = "Restrito ao perfil ADMIN. Alterar status para inativo/bloqueado ou trocar senha revoga sessões ativas.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Usuário atualizado"),
        @ApiResponse(responseCode = "404", description = "Usuário não encontrado"),
        @ApiResponse(responseCode = "409", description = "E-mail duplicado")
    })
    public ResponseEntity<UserResponse> update(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UserUpdateRequest request
    ) {
        return ResponseEntity.ok(userMasterService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Inativar usuário logicamente", description = "Converte exclusão em inativação lógica (status=INACTIVE) preservando histórico.")
    public ResponseEntity<UserResponse> delete(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(userMasterService.deactivate(id));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Inativar usuário")
    public ResponseEntity<UserResponse> deactivate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(userMasterService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Reativar usuário")
    public ResponseEntity<UserResponse> activate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(userMasterService.activate(id));
    }
}

