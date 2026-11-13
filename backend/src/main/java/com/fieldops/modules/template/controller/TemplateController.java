package com.fieldops.modules.template.controller;

import com.fieldops.modules.master.dto.PageResponse;
import com.fieldops.modules.template.domain.TemplateStatus;
import com.fieldops.modules.template.dto.TemplateRequest;
import com.fieldops.modules.template.dto.TemplateResponse;
import com.fieldops.modules.template.dto.TemplateSnapshotResponse;
import com.fieldops.modules.template.dto.TemplateVersionResponse;
import com.fieldops.modules.template.service.TemplateService;
import com.fieldops.modules.template.service.TemplateSnapshotService;
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

import java.util.List;
import java.util.UUID;

/**
 * Controller REST para Modelos de Inspeção, versionamento imutável e geração de snapshots (Passo 4).
 */
@RestController
@RequestMapping("/api/v1/inspection-templates")
@Tag(name = "Modelos de Inspeção", description = "CRUD de rascunhos, publicação imutável, histórico de versões e snapshots de checklist")
public class TemplateController {

    private final TemplateService templateService;
    private final TemplateSnapshotService templateSnapshotService;

    public TemplateController(
            TemplateService templateService,
            TemplateSnapshotService templateSnapshotService
    ) {
        this.templateService = templateService;
        this.templateSnapshotService = templateSnapshotService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(
        summary = "Listar modelos de inspeção paginados",
        description = "Suporta paginação, ordenação, filtros por categoria/status/active e pesquisa textual."
    )
    public ResponseEntity<PageResponse<TemplateResponse>> list(
            @Parameter(description = "Pesquisa textual por título, código, categoria ou descrição")
            @RequestParam(name = "search", required = false) String search,
            @Parameter(description = "Filtro por categoria operacional")
            @RequestParam(name = "category", required = false) String category,
            @Parameter(description = "Filtro por status do modelo (DRAFT, PUBLISHED, INACTIVE)")
            @RequestParam(name = "status", required = false) TemplateStatus status,
            @Parameter(description = "Filtro por registro ativo (true/false)")
            @RequestParam(name = "active", required = false) Boolean active,
            @ParameterObject @PageableDefault(size = 20, sort = "title") Pageable pageable
    ) {
        return ResponseEntity.ok(templateService.list(search, category, status, active, pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Consultar modelo de inspeção por ID com seções e itens da versão atual")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Modelo encontrado"),
        @ApiResponse(responseCode = "404", description = "Modelo não encontrado")
    })
    public ResponseEntity<TemplateResponse> getById(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Criar novo modelo de inspeção em rascunho")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Rascunho criado com sucesso"),
        @ApiResponse(responseCode = "400", description = "Erro de validação"),
        @ApiResponse(responseCode = "409", description = "Código de modelo já existente")
    })
    public ResponseEntity<TemplateResponse> createDraft(@Valid @RequestBody TemplateRequest request) {
        UUID actorUserId = extractAuthenticatedUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createDraft(request, actorUserId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Atualizar modelo em estado de rascunho",
        description = "Rejeita alterações diretas quando o modelo já está em estado PUBLISHED (HTTP 422)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Rascunho atualizado"),
        @ApiResponse(responseCode = "400", description = "Erro de validação"),
        @ApiResponse(responseCode = "404", description = "Modelo não encontrado"),
        @ApiResponse(responseCode = "422", description = "Versão publicada é imutável; crie uma nova versão")
    })
    public ResponseEntity<TemplateResponse> updateDraft(
            @PathVariable("id") UUID id,
            @Valid @RequestBody TemplateRequest request
    ) {
        return ResponseEntity.ok(templateService.updateDraft(id, request));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Publicar versão imutável do modelo",
        description = "Valida título, categoria, seções e itens válidos. Retorna HTTP 400 se houver pendências."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Versão publicada com sucesso"),
        @ApiResponse(responseCode = "400", description = "Pendências impedem a publicação"),
        @ApiResponse(responseCode = "404", description = "Modelo não encontrado"),
        @ApiResponse(responseCode = "422", description = "Modelo já publicado ou inativo")
    })
    public ResponseEntity<TemplateVersionResponse> publish(@PathVariable("id") UUID id) {
        UUID actorUserId = extractAuthenticatedUserId();
        return ResponseEntity.ok(templateService.publish(id, actorUserId));
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Publicar versão imutável do modelo (PATCH)",
        description = "Alias PATCH para publicação atômica do rascunho atual."
    )
    public ResponseEntity<TemplateVersionResponse> publishPatch(@PathVariable("id") UUID id) {
        UUID actorUserId = extractAuthenticatedUserId();
        return ResponseEntity.ok(templateService.publish(id, actorUserId));
    }

    @PostMapping({"/{id}/versions", "/{id}/new-version"})
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Criar nova versão editável (N + 1) preservando versões publicadas anteriores",
        description = "Quando o corpo é omitido, clona seções e itens da última versão publicada."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Nova versão em rascunho iniciada"),
        @ApiResponse(responseCode = "400", description = "Erro de validação no payload informado"),
        @ApiResponse(responseCode = "404", description = "Modelo não encontrado"),
        @ApiResponse(responseCode = "422", description = "Já existe rascunho em aberto ou modelo está inativo")
    })
    public ResponseEntity<TemplateVersionResponse> createNewVersion(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) TemplateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createNewVersion(id, request));
    }

    @GetMapping("/{id}/versions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Listar histórico de versões de um modelo")
    public ResponseEntity<List<TemplateVersionResponse>> listVersions(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.listVersions(id));
    }

    @GetMapping("/{id}/versions/{versionNumber}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Consultar uma versão específica de um modelo")
    public ResponseEntity<TemplateVersionResponse> getVersion(
            @PathVariable("id") UUID id,
            @PathVariable("versionNumber") Integer versionNumber
    ) {
        return ResponseEntity.ok(templateService.getVersion(id, versionNumber));
    }

    @PutMapping("/{id}/versions/{versionNumber}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(
        summary = "Atualizar uma versão específica em rascunho",
        description = "Rejeita alterações diretas caso a versão informada já esteja publicada (HTTP 422)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Versão em rascunho atualizada"),
        @ApiResponse(responseCode = "404", description = "Modelo ou versão não encontrada"),
        @ApiResponse(responseCode = "422", description = "Versão publicada é imutável; crie uma nova versão")
    })
    public ResponseEntity<TemplateVersionResponse> updateVersion(
            @PathVariable("id") UUID id,
            @PathVariable("versionNumber") Integer versionNumber,
            @Valid @RequestBody TemplateRequest request
    ) {
        return ResponseEntity.ok(templateService.updateVersion(id, versionNumber, request));
    }

    @GetMapping("/{id}/snapshot")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gerar snapshot desnormalizado da versão publicada ativa do modelo")
    public ResponseEntity<TemplateSnapshotResponse> getActiveSnapshot(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateSnapshotService.generateSnapshotForTemplate(id));
    }

    @GetMapping("/{id}/versions/{versionNumber}/snapshot")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gerar snapshot desnormalizado de uma versão publicada específica")
    public ResponseEntity<TemplateSnapshotResponse> getVersionSnapshot(
            @PathVariable("id") UUID id,
            @PathVariable("versionNumber") Integer versionNumber
    ) {
        return ResponseEntity.ok(templateSnapshotService.generateSnapshotForVersion(id, versionNumber));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar modelo logicamente", description = "Preserva o modelo e versões históricas (active=false, status=INACTIVE).")
    public ResponseEntity<TemplateResponse> delete(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.deactivate(id));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Inativar modelo logicamente")
    public ResponseEntity<TemplateResponse> deactivate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.deactivate(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    @Operation(summary = "Reativar modelo")
    public ResponseEntity<TemplateResponse> activate(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(templateService.activate(id));
    }

    private UUID extractAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser.getId();
        }
        return null;
    }
}
