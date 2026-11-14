package com.fieldops.modules.inspection.repository;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repositório JPA para a entidade {@link Inspection}.
 */
@Repository
public interface InspectionRepository extends JpaRepository<Inspection, UUID>, JpaSpecificationExecutor<Inspection> {

    @Override
    @EntityGraph(attributePaths = {"template", "templateVersion", "client", "site", "equipment", "technician", "supervisor"})
    Page<Inspection> findAll(Specification<Inspection> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"template", "templateVersion", "client", "site", "equipment", "technician", "supervisor"})
    Optional<Inspection> findDetailedById(UUID id);

    @EntityGraph(attributePaths = {"template", "templateVersion", "client", "site", "equipment", "technician", "supervisor"})
    List<Inspection> findByTechnicianIdOrderByScheduledForAsc(UUID technicianId);

    @EntityGraph(attributePaths = {"template", "templateVersion", "client", "site", "equipment", "technician", "supervisor"})
    List<Inspection> findByTechnicianIdAndStatusOrderByScheduledForAsc(UUID technicianId, InspectionStatus status);

    @EntityGraph(attributePaths = {"template", "templateVersion", "client", "site", "equipment", "technician", "supervisor"})
    List<Inspection> findByTechnicianIdAndStatusInOrderByScheduledForAsc(UUID technicianId, List<InspectionStatus> statuses);
}
