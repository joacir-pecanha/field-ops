package com.fieldops.modules.sync.domain;

import java.util.Locale;

/**
 * Estados de uma Não Conformidade registrada em campo.
 */
public enum NonConformityStatus {
    OPEN,
    RESOLVED,
    CANCELED;

    public static NonConformityStatus fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return OPEN;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "OPEN", "ABERTA" -> OPEN;
            case "RESOLVED", "RESOLVIDA" -> RESOLVED;
            case "CANCELED", "CANCELLED", "CANCELADA" -> CANCELED;
            default -> throw new IllegalArgumentException("Status de não conformidade inválido: '" + raw + "'.");
        };
    }
}
