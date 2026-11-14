package com.fieldops.modules.inspection.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.Locale;

/**
 * Estados formais de negócio da inspeção no MVP (RT-01, docs/fluxo_geral.md 7.4 e 7.6).
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

    public boolean canTransitionTo(InspectionStatus target) {
        if (target == null) {
            return false;
        }
        return switch (this) {
            case RASCUNHO -> target == ATRIBUÍDA || target == CANCELADA;
            case ATRIBUÍDA -> target == EM_ANDAMENTO || target == CANCELADA;
            case EM_ANDAMENTO -> target == ENVIADA || target == CANCELADA;
            case ENVIADA -> target == EM_REVISÃO || target == CANCELADA;
            case EM_REVISÃO -> target == APROVADA || target == REPROVADA || target == CANCELADA;
            case REPROVADA -> target == EM_ANDAMENTO || target == CANCELADA;
            case APROVADA, CANCELADA -> false;
        };
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
