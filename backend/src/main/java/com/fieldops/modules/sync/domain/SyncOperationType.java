package com.fieldops.modules.sync.domain;

import java.util.Locale;

/**
 * Tipos de mutação suportados pelo lote de sincronização Outbox com precedência causal (RF-04, RN-069).
 */
public enum SyncOperationType {
    START_INSPECTION(10),
    SAVE_RESPONSE(20),
    UPLOAD_EVIDENCE(25),
    CREATE_NON_CONFORMITY(30),
    UPDATE_NON_CONFORMITY(31),
    CANCEL_NON_CONFORMITY(32),
    COMPLETE_INSPECTION(40);

    private final int dependencyOrder;

    SyncOperationType(int dependencyOrder) {
        this.dependencyOrder = dependencyOrder;
    }

    public int getDependencyOrder() {
        return dependencyOrder;
    }

    public static SyncOperationType fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "START_INSPECTION" -> START_INSPECTION;
            case "SAVE_RESPONSE", "SUBMIT_RESPONSE" -> SAVE_RESPONSE;
            case "UPLOAD_EVIDENCE" -> UPLOAD_EVIDENCE;
            case "CREATE_NON_CONFORMITY" -> CREATE_NON_CONFORMITY;
            case "UPDATE_NON_CONFORMITY" -> UPDATE_NON_CONFORMITY;
            case "CANCEL_NON_CONFORMITY" -> CANCEL_NON_CONFORMITY;
            case "COMPLETE_INSPECTION" -> COMPLETE_INSPECTION;
            default -> null;
        };
    }
}
