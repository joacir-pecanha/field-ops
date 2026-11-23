package com.fieldops.modules.sync.domain;

import java.util.Locale;

/**
 * Níveis de criticidade permitidos para Não Conformidades (RN-054).
 */
public enum NonConformitySeverity {
    BAIXA,
    MEDIA,
    ALTA,
    CRITICA;

    public static NonConformitySeverity fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "BAIXA", "LOW" -> BAIXA;
            case "MEDIA", "MÉDIA", "MEDIUM" -> MEDIA;
            case "ALTA", "HIGH" -> ALTA;
            case "CRITICA", "CRÍTICA", "CRITICAL" -> CRITICA;
            default -> throw new IllegalArgumentException("Criticidade de não conformidade inválida: '" + raw + "'.");
        };
    }
}
