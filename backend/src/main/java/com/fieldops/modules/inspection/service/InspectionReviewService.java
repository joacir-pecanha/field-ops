package com.fieldops.modules.inspection.service;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionReview;
import com.fieldops.modules.inspection.domain.InspectionReviewDecision;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import com.fieldops.modules.inspection.dto.AdminResponseAdjustmentRequest;
import com.fieldops.modules.inspection.dto.ApproveInspectionRequest;
import com.fieldops.modules.inspection.dto.InspectionDetailsResponse;
import com.fieldops.modules.inspection.dto.InspectionResponseReviewDto;
import com.fieldops.modules.inspection.dto.InspectionReviewHistoryDto;
import com.fieldops.modules.inspection.dto.RejectInspectionRequest;
import com.fieldops.modules.inspection.exception.InspectionReviewValidationException;
import com.fieldops.modules.inspection.exception.InvalidInspectionStateTransitionException;
import com.fieldops.modules.inspection.repository.InspectionRepository;
import com.fieldops.modules.inspection.repository.InspectionReviewRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.exception.ResourceNotFoundException;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.modules.sync.domain.InspectionResponse;
import com.fieldops.modules.sync.repository.InspectionResponseRepository;
import com.fieldops.security.jwt.AuthenticatedUser;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Serviço de domínio responsável pela máquina de estados de revisão técnica, aprovação,
 * reprovação obrigatória com motivo, bloqueio pós-aprovação e ajustes administrativos auditados
 * (TASK-019, RF-01..RF-07, RT-01..RT-03, EX-01, EX-02).
 */
@Service
public class InspectionReviewService {

    public static final String REJECTION_REASON_REQUIRED_MESSAGE = "O motivo da reprovação é obrigatório";

    private final InspectionRepository inspectionRepository;
    private final InspectionReviewRepository inspectionReviewRepository;
    private final InspectionResponseRepository inspectionResponseRepository;
    private final UserRepository userRepository;
    private final InspectionAuditService inspectionAuditService;
    private final InspectionDetailsAssembler inspectionDetailsAssembler;
    private final TransactionTemplate transactionTemplate;

    public InspectionReviewService(
            InspectionRepository inspectionRepository,
            InspectionReviewRepository inspectionReviewRepository,
            InspectionResponseRepository inspectionResponseRepository,
            UserRepository userRepository,
            InspectionAuditService inspectionAuditService,
            InspectionDetailsAssembler inspectionDetailsAssembler,
            PlatformTransactionManager transactionManager
    ) {
        this.inspectionRepository = inspectionRepository;
        this.inspectionReviewRepository = inspectionReviewRepository;
        this.inspectionResponseRepository = inspectionResponseRepository;
        this.userRepository = userRepository;
        this.inspectionAuditService = inspectionAuditService;
        this.inspectionDetailsAssembler = inspectionDetailsAssembler;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * Inicia formalmente a revisão de uma inspeção no estado ENVIADA, transitando-a para EM_REVISÃO
     * e gerando trilha de auditoria assíncrona (RF-01, RF-02, RT-01, RT-02).
     */
    public InspectionDetailsResponse startReview(UUID inspectionId, AuthenticatedUser actor) {
        User reviewer = requireAuthorizedReviewer(actor);
        Instant now = Instant.now();

        ReviewTransitionOutcome outcome = transactionTemplate.execute(status -> {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

            InspectionStatus currentStatus = inspection.getStatus();
            if (!currentStatus.canStartReview()) {
                throw new InvalidInspectionStateTransitionException(
                        resolveStartReviewErrorCode(currentStatus),
                        currentStatus,
                        InspectionStatus.EM_REVISÃO,
                        buildStartReviewErrorMessage(currentStatus)
                );
            }

            int nextCycle = (inspection.getReviewCycle() != null ? inspection.getReviewCycle() : 0) + 1;
            inspection.setStatus(InspectionStatus.EM_REVISÃO);
            inspection.setReviewStartedAt(now);
            inspection.setReviewStartedBy(reviewer.getId());
            inspection.setReviewCycle(nextCycle);
            if (inspection.getSupervisor() == null) {
                inspection.setSupervisor(reviewer);
            }

            Inspection saved = inspectionRepository.saveAndFlush(inspection);
            saveReviewRecord(saved.getId(), reviewer.getId(), InspectionReviewDecision.REVIEW_STARTED, null, null, now, nextCycle);

            return new ReviewTransitionOutcome(saved.getId(), currentStatus, saved.getStatus(), nextCycle);
        });

        inspectionAuditService.recordStateTransition(
                outcome.inspectionId(),
                actor,
                "REVIEW_STARTED",
                "INSPECTION",
                outcome.inspectionId(),
                outcome.previousStatus().name(),
                outcome.newStatus().name(),
                "{\"status\":\"" + outcome.previousStatus().name() + "\"}",
                "{\"status\":\"" + outcome.newStatus().name() + "\",\"reviewCycle\":" + outcome.reviewCycle()
                        + ",\"reviewStartedBy\":\"" + reviewer.getId() + "\"}",
                "{\"reviewerId\":\"" + reviewer.getId() + "\",\"reviewerName\":\"" + escapeJson(reviewer.getName())
                        + "\",\"reviewCycle\":" + outcome.reviewCycle() + "}",
                "Revisão técnica iniciada por " + reviewer.getName() + " (ciclo " + outcome.reviewCycle() + ").",
                now
        );

        return loadDetailedInspection(outcome.inspectionId());
    }

    /**
     * Aprova uma inspeção em EM_REVISÃO ou ENVIADA, registrando supervisor, data e parecer opcional,
     * bloqueando alterações comuns futuras (RF-03, RF-04, EX-02).
     */
    public InspectionDetailsResponse approve(
            UUID inspectionId,
            ApproveInspectionRequest request,
            AuthenticatedUser actor
    ) {
        User reviewer = requireAuthorizedReviewer(actor);
        String comments = request != null ? request.effectiveComments() : null;
        Instant now = Instant.now();

        ReviewTransitionOutcome outcome = transactionTemplate.execute(status -> {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

            InspectionStatus currentStatus = inspection.getStatus();
            if (!currentStatus.canApprove()) {
                throw new InvalidInspectionStateTransitionException(
                        resolveApprovalErrorCode(currentStatus),
                        currentStatus,
                        InspectionStatus.APROVADA,
                        buildApprovalErrorMessage(currentStatus)
                );
            }

            int cycle = currentStatus == InspectionStatus.ENVIADA
                    ? (inspection.getReviewCycle() != null ? inspection.getReviewCycle() : 0) + 1
                    : Math.max(1, inspection.getReviewCycle() != null ? inspection.getReviewCycle() : 1);

            if (currentStatus == InspectionStatus.ENVIADA) {
                inspection.setReviewStartedAt(now);
                inspection.setReviewStartedBy(reviewer.getId());
                inspection.setReviewCycle(cycle);
            }
            inspection.setStatus(InspectionStatus.APROVADA);
            inspection.setApprovedAt(now);
            inspection.setApprovedBy(reviewer.getId());
            inspection.setReviewComments(comments);
            if (inspection.getSupervisor() == null) {
                inspection.setSupervisor(reviewer);
            }

            Inspection saved = inspectionRepository.saveAndFlush(inspection);
            saveReviewRecord(saved.getId(), reviewer.getId(), InspectionReviewDecision.APPROVED, null, comments, now, cycle);

            return new ReviewTransitionOutcome(saved.getId(), currentStatus, saved.getStatus(), cycle);
        });

        inspectionAuditService.recordStateTransition(
                outcome.inspectionId(),
                actor,
                "INSPECTION_APPROVED",
                "INSPECTION",
                outcome.inspectionId(),
                outcome.previousStatus().name(),
                outcome.newStatus().name(),
                "{\"status\":\"" + outcome.previousStatus().name() + "\"}",
                "{\"status\":\"APROVADA\",\"approvedBy\":\"" + reviewer.getId()
                        + "\",\"approvedAt\":\"" + now + "\""
                        + (comments != null ? ",\"reviewComments\":\"" + escapeJson(comments) + "\"" : "") + "}",
                "{\"reviewerId\":\"" + reviewer.getId() + "\",\"reviewerName\":\"" + escapeJson(reviewer.getName())
                        + "\",\"reviewCycle\":" + outcome.reviewCycle() + "}",
                "Inspeção aprovada por " + reviewer.getName()
                        + (comments != null ? ". Comentário: " + comments : "."),
                now
        );

        return loadDetailedInspection(outcome.inspectionId());
    }

    /**
     * Reprova uma inspeção em EM_REVISÃO ou ENVIADA exigindo motivo obrigatório (EX-01, RF-05, RF-06).
     */
    public InspectionDetailsResponse reject(
            UUID inspectionId,
            RejectInspectionRequest request,
            AuthenticatedUser actor
    ) {
        User reviewer = requireAuthorizedReviewer(actor);
        String reason = request != null ? request.effectiveRejectionReason() : null;
        if (reason == null) {
            throw new InspectionReviewValidationException(
                    "REJECTION_REASON_REQUIRED",
                    REJECTION_REASON_REQUIRED_MESSAGE,
                    Map.of(
                            "rejection_reason", REJECTION_REASON_REQUIRED_MESSAGE,
                            "rejectionReason", REJECTION_REASON_REQUIRED_MESSAGE,
                            "reason", REJECTION_REASON_REQUIRED_MESSAGE
                    )
            );
        }

        String comments = request != null ? request.effectiveComments() : null;
        Instant now = Instant.now();

        ReviewTransitionOutcome outcome = transactionTemplate.execute(status -> {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

            InspectionStatus currentStatus = inspection.getStatus();
            if (!currentStatus.canReject()) {
                throw new InvalidInspectionStateTransitionException(
                        resolveRejectionErrorCode(currentStatus),
                        currentStatus,
                        InspectionStatus.REPROVADA,
                        buildRejectionErrorMessage(currentStatus)
                );
            }

            int cycle = currentStatus == InspectionStatus.ENVIADA
                    ? (inspection.getReviewCycle() != null ? inspection.getReviewCycle() : 0) + 1
                    : Math.max(1, inspection.getReviewCycle() != null ? inspection.getReviewCycle() : 1);

            if (currentStatus == InspectionStatus.ENVIADA) {
                inspection.setReviewStartedAt(now);
                inspection.setReviewStartedBy(reviewer.getId());
                inspection.setReviewCycle(cycle);
            }
            inspection.setStatus(InspectionStatus.REPROVADA);
            inspection.setRejectedAt(now);
            inspection.setRejectedBy(reviewer.getId());
            inspection.setRejectionReason(reason);
            inspection.setReviewComments(comments);
            if (inspection.getSupervisor() == null) {
                inspection.setSupervisor(reviewer);
            }

            Inspection saved = inspectionRepository.saveAndFlush(inspection);
            saveReviewRecord(saved.getId(), reviewer.getId(), InspectionReviewDecision.REJECTED, reason, comments, now, cycle);

            return new ReviewTransitionOutcome(saved.getId(), currentStatus, saved.getStatus(), cycle);
        });

        inspectionAuditService.recordStateTransition(
                outcome.inspectionId(),
                actor,
                "INSPECTION_REJECTED",
                "INSPECTION",
                outcome.inspectionId(),
                outcome.previousStatus().name(),
                outcome.newStatus().name(),
                "{\"status\":\"" + outcome.previousStatus().name() + "\"}",
                "{\"status\":\"REPROVADA\",\"rejectedBy\":\"" + reviewer.getId()
                        + "\",\"rejectedAt\":\"" + now
                        + "\",\"rejectionReason\":\"" + escapeJson(reason) + "\"}",
                "{\"reviewerId\":\"" + reviewer.getId() + "\",\"reviewerName\":\"" + escapeJson(reviewer.getName())
                        + "\",\"reviewCycle\":" + outcome.reviewCycle() + "}",
                "Inspeção reprovada por " + reviewer.getName() + ". Motivo: " + reason,
                now
        );

        return loadDetailedInspection(outcome.inspectionId());
    }

    /**
     * Registra um ajuste administrativo diferenciado sobre a resposta de um item sem sobrescrever
     * silenciosamente o dado original capturado em campo pelo técnico (RF-04, RF-07, RN-084, RN-085).
     */
    public InspectionResponseReviewDto adjustResponseAdministratively(
            UUID inspectionId,
            UUID itemId,
            AdminResponseAdjustmentRequest request,
            AuthenticatedUser actor
    ) {
        User reviewer = requireAuthorizedReviewer(actor);
        String adjustedValue = request != null ? request.effectiveAdjustedValue() : null;
        String reason = request != null ? request.effectiveReason() : null;

        if (adjustedValue == null) {
            throw new InspectionReviewValidationException(
                    "ADJUSTED_VALUE_REQUIRED",
                    "O valor do ajuste administrativo é obrigatório.",
                    Map.of("adjustedValue", "O valor do ajuste administrativo é obrigatório.")
            );
        }
        if (reason == null) {
            throw new InspectionReviewValidationException(
                    "ADJUSTMENT_REASON_REQUIRED",
                    "A justificativa do ajuste administrativo é obrigatória.",
                    Map.of("reason", "A justificativa do ajuste administrativo é obrigatória.")
            );
        }

        Instant now = Instant.now();

        AdjustmentOutcome outcome = transactionTemplate.execute(status -> {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));

            if (inspection.getStatus().isLockedForCommonEdit()) {
                throw new InvalidInspectionStateTransitionException(
                        "INSPECTION_LOCKED_FOR_EDIT",
                        inspection.getStatus(),
                        inspection.getStatus(),
                        "Inspeção no estado " + inspection.getStatus()
                                + " encontra-se bloqueada e não aceita ajustes."
                );
            }

            InspectionResponse response = inspectionResponseRepository
                    .findByInspectionIdAndInspectionItemId(inspectionId, itemId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Resposta de item da inspeção", itemId));

            String previousValueJson = "{"
                    + "\"fieldValueRaw\":" + quoteOrNull(response.getValueRaw()) + ","
                    + "\"adminAdjusted\":" + response.isAdminAdjusted() + ","
                    + "\"adminAdjustedValue\":" + quoteOrNull(response.getAdminAdjustedValue())
                    + "}";

            // Preserva integralmente os campos originais do técnico (valueRaw, valueText, etc.)
            response.setAdminAdjusted(true);
            response.setAdminAdjustedValue(adjustedValue);
            response.setAdminAdjustmentReason(reason);
            response.setAdminAdjustedBy(reviewer.getId());
            response.setAdminAdjustedAt(now);

            InspectionResponse saved = inspectionResponseRepository.saveAndFlush(response);
            return new AdjustmentOutcome(saved, inspection.getStatus(), previousValueJson);
        });

        inspectionAuditService.recordAdminAdjustment(
                inspectionId,
                actor,
                outcome.response().getId(),
                outcome.inspectionStatus().name(),
                outcome.previousValueJson(),
                "{\"fieldValueRaw\":" + quoteOrNull(outcome.response().getValueRaw())
                        + ",\"adminAdjusted\":true,\"adminAdjustedValue\":\"" + escapeJson(adjustedValue)
                        + "\",\"adminAdjustmentReason\":\"" + escapeJson(reason) + "\"}",
                "{\"reviewerId\":\"" + reviewer.getId() + "\",\"reviewerName\":\"" + escapeJson(reviewer.getName())
                        + "\",\"itemId\":\"" + itemId + "\"}",
                "Ajuste administrativo registrado por " + reviewer.getName() + " no item " + itemId + ". Motivo: " + reason,
                now
        );

        return InspectionResponseReviewDto.fromEntity(
                outcome.response(),
                Map.of(reviewer.getId(), reviewer.getName())
        );
    }

    @Transactional(readOnly = true)
    public List<InspectionReviewHistoryDto> getReviewHistory(UUID inspectionId) {
        Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));
        List<InspectionReview> reviews = inspectionReviewRepository
                .findByInspectionIdOrderByReviewCycleAscCreatedAtAsc(inspectionId);
        Map<UUID, String> userNames = inspectionDetailsAssembler.resolveUserNames(inspection, List.of(), reviews);
        return reviews.stream()
                .map(review -> InspectionReviewHistoryDto.fromEntity(review, userNames))
                .toList();
    }

    private InspectionDetailsResponse loadDetailedInspection(UUID inspectionId) {
        return transactionTemplate.execute(status -> {
            Inspection inspection = inspectionRepository.findDetailedById(inspectionId)
                    .orElseThrow(() -> ResourceNotFoundException.of("Inspeção", inspectionId));
            return inspectionDetailsAssembler.assembleDetailed(inspection);
        });
    }

    private User requireAuthorizedReviewer(AuthenticatedUser actor) {
        if (actor == null) {
            throw new AccessDeniedException("Autenticação obrigatória para revisar inspeções.");
        }
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new AccessDeniedException("Usuário autenticado não encontrado."));
        if (!user.isActive()) {
            throw new AccessDeniedException("Usuário inativo ou bloqueado não pode revisar inspeções.");
        }
        if (user.getRole() != UserRole.SUPERVISOR && user.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Somente supervisores ou administradores autorizados podem revisar inspeções.");
        }
        return user;
    }

    private void saveReviewRecord(
            UUID inspectionId,
            UUID reviewerId,
            InspectionReviewDecision decision,
            String reason,
            String comments,
            Instant reviewedAt,
            int reviewCycle
    ) {
        InspectionReview review = new InspectionReview();
        review.setId(UUID.randomUUID());
        review.setInspectionId(inspectionId);
        review.setReviewerId(reviewerId);
        review.setDecision(decision);
        review.setReason(reason);
        review.setComments(comments);
        review.setReviewedAt(reviewedAt);
        review.setReviewCycle(reviewCycle);
        inspectionReviewRepository.saveAndFlush(review);
    }

    private String resolveStartReviewErrorCode(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "INSPECTION_LOCKED_APPROVED";
            case CANCELADA -> "INSPECTION_LOCKED_CANCELED";
            case EM_REVISÃO -> "REVIEW_ALREADY_STARTED";
            default -> "INVALID_REVIEW_START_STATE";
        };
    }

    private String buildStartReviewErrorMessage(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "A inspeção já foi aprovada e está bloqueada contra nova revisão.";
            case CANCELADA -> "A inspeção foi cancelada e não pode entrar em revisão.";
            case EM_REVISÃO -> "A revisão desta inspeção já foi iniciada anteriormente.";
            default -> "Não é possível iniciar revisão: a inspeção está no estado " + status + " e precisa estar em ENVIADA.";
        };
    }

    private String resolveApprovalErrorCode(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "INSPECTION_ALREADY_APPROVED";
            case CANCELADA -> "INSPECTION_LOCKED_CANCELED";
            default -> "INVALID_APPROVAL_STATE";
        };
    }

    private String buildApprovalErrorMessage(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "A inspeção já está aprovada e encontra-se bloqueada contra alterações comuns.";
            case CANCELADA -> "A inspeção está cancelada e não pode ser aprovada.";
            default -> "Tentativa de aprovação bloqueada: a inspeção está no estado " + status
                    + " e precisa estar em EM_REVISÃO ou ENVIADA.";
        };
    }

    private String resolveRejectionErrorCode(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "INSPECTION_LOCKED_APPROVED";
            case CANCELADA -> "INSPECTION_LOCKED_CANCELED";
            default -> "INVALID_REJECTION_STATE";
        };
    }

    private String buildRejectionErrorMessage(InspectionStatus status) {
        return switch (status) {
            case APROVADA -> "A inspeção já foi aprovada e está bloqueada contra reprovação ou alterações comuns.";
            case CANCELADA -> "A inspeção está cancelada e não pode ser reprovada.";
            default -> "Tentativa de reprovação bloqueada: a inspeção está no estado " + status
                    + " e precisa estar em EM_REVISÃO ou ENVIADA.";
        };
    }

    private String quoteOrNull(String value) {
        return value != null ? "\"" + escapeJson(value) + "\"" : "null";
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private record ReviewTransitionOutcome(
            UUID inspectionId,
            InspectionStatus previousStatus,
            InspectionStatus newStatus,
            int reviewCycle
    ) {
    }

    private record AdjustmentOutcome(
            InspectionResponse response,
            InspectionStatus inspectionStatus,
            String previousValueJson
    ) {
    }
}
