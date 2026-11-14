package com.fieldops.modules.inspection.domain;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.Locale;

/**
 * Prioridade operacional da inspeção agendada (docs/modelo-de-dados.md 10.8.1 e TASK-012).
 */
public enum InspectionPriority {
    BAIXA,
    MEDIA,
    ALTA,
    URGENTE,
    CRITICA;

    @JsonCreator
    public static InspectionPriority fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "BAIXA", "LOW" -> BAIXA;
            case "MEDIA", "MÉDIA", "MEDIUM" -> MEDIA;
            case "ALTA", "HIGH" -> ALTA;
            case "URGENTE", "URGENT" -> URGENTE;
            case "CRITICA", "CRÍTICA", "CRITICAL" -> CRITICA;
            default -> throw new IllegalArgumentException("Prioridade de inspeção inválida: '" + raw + "'.");
        };
    }
}
