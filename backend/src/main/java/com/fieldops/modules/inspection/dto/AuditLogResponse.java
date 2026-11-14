package com.fieldops.modules.inspection.dto;

import com.fieldops.modules.inspection.domain.AuditLog;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de consulta da trilha de auditoria das inspeções (RT-03, RN-086).
 */
@Schema(description = "Registro de auditoria de ação realizada sobre uma inspeção")
public record AuditLogResponse(
        UUID id,
        UUID inspectionId,
        UUID actorId,
        String actorEmail,
        String action,
        String entityType,
        UUID entityId,
        String previousStatus,
        String newStatus,
        String previousValueJson,
        String newValueJson,
        String metadataJson,
        String details,
        Instant occurredAt
) {
    public static AuditLogResponse fromEntity(AuditLog entity) {
        return new AuditLogResponse(
                entity.getId(),
                entity.getInspectionId(),
                entity.getActorId(),
                entity.getActorEmail(),
                entity.getAction(),
                entity.getEntityType(),
                entity.getEntityId(),
                entity.getPreviousStatus(),
                entity.getNewStatus(),
                entity.getPreviousValueJson(),
                entity.getNewValueJson(),
                entity.getMetadataJson(),
                entity.getDetails(),
                entity.getOccurredAt()
        );
    }
}
