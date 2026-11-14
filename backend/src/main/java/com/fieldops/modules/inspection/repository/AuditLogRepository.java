package com.fieldops.modules.inspection.repository;

import com.fieldops.modules.inspection.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repositório JPA para trilha de auditoria ({@link AuditLog}).
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByInspectionIdOrderByOccurredAtAsc(UUID inspectionId);

    List<AuditLog> findByEntityTypeAndEntityIdOrderByOccurredAtAsc(String entityType, UUID entityId);
}
