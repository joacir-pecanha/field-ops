package com.fieldops.modules.sync.repository;

import com.fieldops.modules.sync.domain.NonConformity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NonConformityRepository extends JpaRepository<NonConformity, UUID> {

    List<NonConformity> findByInspectionIdOrderByCreatedAtAsc(UUID inspectionId);

    long countByInspectionId(UUID inspectionId);

    @Query("select n.severity, count(n) from NonConformity n where n.status <> com.fieldops.modules.sync.domain.NonConformityStatus.CANCELED group by n.severity")
    List<Object[]> countActiveGroupedBySeverity();
}
