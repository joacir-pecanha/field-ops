package com.fieldops.modules.inspection.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * Estados formais de negócio da inspeção no MVP e máquina de estados de transição
 * conforme tabela 7.6 de docs/fluxo_geral.md, RN-089 e EX-02 (TASK-019).
 */
public enum InspectionStatus {
    RASCUNHO,
    ATRIBUÍDA,
    EM_ANDAMENTO,
    ENVIADA,
    EM_REVISÃO,
    APROVADA,
    REPROVADA,
    CANCELADA;

    public boolean canBeCanceled() {
        return this != APROVADA && this != CANCELADA;
    }

    public boolean isTerminal() {
        return this == APROVADA || this == CANCELADA;
    }

    public boolean isLockedForCommonEdit() {
        return this == APROVADA || this == CANCELADA;
    }

    public boolean canStartReview() {
        return this == ENVIADA;
    }

    /**
     * Conforme EX-02, a aprovação é permitida apenas a partir de EM_REVISÃO ou ENVIADA.
     */
    public boolean canApprove() {
        return this == EM_REVISÃO || this == ENVIADA;
    }

    /**
     * A reprovação é permitida a partir de EM_REVISÃO ou ENVIADA.
     */
    public boolean canReject() {
        return this == EM_REVISÃO || this == ENVIADA;
    }

    public boolean canReopenForCorrection() {
        return this == REPROVADA;
    }

    public Set<InspectionStatus> allowedTransitions() {
        return switch (this) {
            case RASCUNHO -> Collections.unmodifiableSet(EnumSet.of(ATRIBUÍDA, CANCELADA));
            case ATRIBUÍDA -> Collections.unmodifiableSet(EnumSet.of(EM_ANDAMENTO, CANCELADA));
            case EM_ANDAMENTO -> Collections.unmodifiableSet(EnumSet.of(ENVIADA, CANCELADA));
            case ENVIADA -> Collections.unmodifiableSet(EnumSet.of(EM_REVISÃO, APROVADA, REPROVADA, CANCELADA));
            case EM_REVISÃO -> Collections.unmodifiableSet(EnumSet.of(APROVADA, REPROVADA, CANCELADA));
            case REPROVADA -> Collections.unmodifiableSet(EnumSet.of(EM_ANDAMENTO, CANCELADA));
            case APROVADA, CANCELADA -> Collections.emptySet();
        };
    }

    public boolean canTransitionTo(InspectionStatus target) {
        if (target == null) {
            return false;
        }
        return allowedTransitions().contains(target);
    }

    @JsonCreator
    public static InspectionStatus fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "RASCUNHO", "DRAFT" -> RASCUNHO;
            case "ATRIBUÍDA", "ATRIBUIDA", "ASSIGNED" -> ATRIBUÍDA;
            case "EM_ANDAMENTO", "IN_PROGRESS" -> EM_ANDAMENTO;
            case "ENVIADA", "SUBMITTED" -> ENVIADA;
            case "EM_REVISÃO", "EM_REVISAO", "UNDER_REVIEW" -> EM_REVISÃO;
            case "APROVADA", "APPROVED" -> APROVADA;
            case "REPROVADA", "REJECTED" -> REPROVADA;
            case "CANCELADA", "CANCELED", "CANCELLED" -> CANCELADA;
            default -> throw new IllegalArgumentException("Estado de inspeção inválido: '" + raw + "'.");
        };
    }
}
