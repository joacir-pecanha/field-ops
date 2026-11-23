package com.fieldops.modules.inspection.controller;

import com.fieldops.modules.inspection.dto.AdminResponseAdjustmentRequest;
import com.fieldops.modules.inspection.dto.ApproveInspectionRequest;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.InspectionResponseReviewDto;
import com.fieldops.modules.inspection.dto.InspectionReviewHistoryDto;
import com.fieldops.modules.inspection.dto.RejectInspectionRequest;
import com.fieldops.modules.inspection.service.InspectionReviewService;
import com.fieldops.security.jwt.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Controller REST da máquina de estados de revisão, aprovação, reprovação e ajuste administrativo auditado
 * (TASK-019 Passo 4, RF-01..RF-07, RT-01..RT-03).
 */
@RestController
@RequestMapping("/api/v1/inspections")
@Tag(
    name = "Revisão e Auditoria de Inspeções",
    description = "Fluxo formal de início de revisão, aprovação final, reprovação com motivo obrigatório e ajustes administrativos auditados"
)
public class InspectionReviewController {

    private final InspectionReviewService inspectionReviewService;

    public InspectionReviewController(InspectionReviewService inspectionReviewService) {
        this.inspectionReviewService = inspectionReviewService;
    }

    @PostMapping("/{id}/start-review")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(
        summary = "Iniciar revisão técnica da inspeção",
        description = "Transita a inspeção do estado ENVIADA para EM_REVISÃO e registra evento de auditoria."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Revisão iniciada; estado atualizado para EM_REVISÃO"),
        @ApiResponse(responseCode = "401", description = "Sessão não autenticada"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para revisar inspeções"),
        @ApiResponse(responseCode = "404", description = "Inspeção não encontrada"),
        @ApiResponse(responseCode = "409", description = "Transição de estado inválida; inspeção não está em ENVIADA")
    })
    public ResponseEntity<InspectionDetailsResponse> startReview(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(inspectionReviewService.startReview(id, extractAuthenticatedUser()));
    }

    @PatchMapping("/{id}/start-review")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(summary = "Iniciar revisão técnica da inspeção (PATCH)")
    public ResponseEntity<InspectionDetailsResponse> startReviewPatch(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(inspectionReviewService.startReview(id, extractAuthenticatedUser()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(
        summary = "Aprovar inspeção técnica",
        description = "Transita inspeção de EM_REVISÃO ou ENVIADA para APROVADA, registra supervisor, timestamp e comentários opcionais, bloqueando edições comuns."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Inspeção aprovada com sucesso"),
        @ApiResponse(responseCode = "401", description = "Sessão não autenticada"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para aprovar inspeções"),
        @ApiResponse(responseCode = "404", description = "Inspeção não encontrada"),
        @ApiResponse(responseCode = "409", description = "Inspeção não está em EM_REVISÃO ou ENVIADA (EX-02)")
    })
    public ResponseEntity<InspectionDetailsResponse> approve(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) ApproveInspectionRequest request
    ) {
        return ResponseEntity.ok(inspectionReviewService.approve(id, request, extractAuthenticatedUser()));
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(summary = "Aprovar inspeção técnica (PATCH)")
    public ResponseEntity<InspectionDetailsResponse> approvePatch(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) ApproveInspectionRequest request
    ) {
        return ResponseEntity.ok(inspectionReviewService.approve(id, request, extractAuthenticatedUser()));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(
        summary = "Reprovar inspeção e devolver para correção",
        description = "Exige motivo obrigatório (HTTP 400 se ausente), transita para REPROVADA, registra ciclo de revisão e auditoria e disponibiliza para download pelo técnico."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Inspeção reprovada com motivo registrado"),
        @ApiResponse(responseCode = "400", description = "Motivo da reprovação ausente ou em branco (EX-01)"),
        @ApiResponse(responseCode = "401", description = "Sessão não autenticada"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para reprovar inspeções"),
        @ApiResponse(responseCode = "404", description = "Inspeção não encontrada"),
        @ApiResponse(responseCode = "409", description = "Transição de estado inválida para reprovação")
    })
    public ResponseEntity<InspectionDetailsResponse> reject(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) RejectInspectionRequest request
    ) {
        return ResponseEntity.ok(inspectionReviewService.reject(id, request, extractAuthenticatedUser()));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(summary = "Reprovar inspeção e devolver para correção (PATCH)")
    public ResponseEntity<InspectionDetailsResponse> rejectPatch(
            @PathVariable("id") UUID id,
            @Valid @RequestBody(required = false) RejectInspectionRequest request
    ) {
        return ResponseEntity.ok(inspectionReviewService.reject(id, request, extractAuthenticatedUser()));
    }

    @PostMapping("/{id}/responses/{itemId}/admin-adjustment")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(
        summary = "Registrar ajuste administrativo auditado sobre resposta de campo",
        description = "Preserva integralmente a resposta original do técnico e registra ajuste administrativo diferenciado com justificativa e evento de auditoria (RF-07, RN-084, RN-085)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Ajuste administrativo registrado com auditoria"),
        @ApiResponse(responseCode = "400", description = "Valor ou justificativa do ajuste ausente"),
        @ApiResponse(responseCode = "403", description = "Perfil sem permissão para ajustes administrativos"),
        @ApiResponse(responseCode = "404", description = "Inspeção ou resposta não encontrada"),
        @ApiResponse(responseCode = "409", description = "Inspeção aprovada ou cancelada não aceita ajustes")
    })
    public ResponseEntity<InspectionResponseReviewDto> adjustResponseAdministratively(
            @PathVariable("id") UUID id,
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody(required = false) AdminResponseAdjustmentRequest request
    ) {
        return ResponseEntity.ok(
                inspectionReviewService.adjustResponseAdministratively(
                        id,
                        itemId,
                        request,
                        extractAuthenticatedUser()
                )
        );
    }

    @PatchMapping("/{id}/responses/{itemId}/admin-adjustment")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(summary = "Registrar ajuste administrativo auditado sobre resposta de campo (PATCH)")
    public ResponseEntity<InspectionResponseReviewDto> adjustResponseAdministrativelyPatch(
            @PathVariable("id") UUID id,
            @PathVariable("itemId") UUID itemId,
            @Valid @RequestBody(required = false) AdminResponseAdjustmentRequest request
    ) {
        return ResponseEntity.ok(
                inspectionReviewService.adjustResponseAdministratively(
                        id,
                        itemId,
                        request,
                        extractAuthenticatedUser()
                )
        );
    }

    @GetMapping("/{id}/reviews")
    @PreAuthorize("hasAnyRole('SUPERVISOR', 'ADMIN')")
    @Operation(summary = "Consultar histórico completo de ciclos de revisão da inspeção")
    public ResponseEntity<List<InspectionReviewHistoryDto>> getReviewHistory(@PathVariable("id") UUID id) {
        return ResponseEntity.ok(inspectionReviewService.getReviewHistory(id));
    }

    private AuthenticatedUser extractAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser;
        }
        return null;
    }
}
