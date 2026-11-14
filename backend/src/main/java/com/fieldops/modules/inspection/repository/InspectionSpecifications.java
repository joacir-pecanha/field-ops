package com.fieldops.modules.inspection.repository;

import com.fieldops.modules.inspection.domain.Inspection;
import com.fieldops.modules.inspection.domain.InspectionPriority;
import com.fieldops.modules.inspection.domain.InspectionStatus;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Specifications dinâmicas para filtragem paginada de inspeções agendadas.
 */
public final class InspectionSpecifications {

    private InspectionSpecifications() {
    }

    public static Specification<Inspection> filterInspections(
            String search,
            InspectionStatus status,
            InspectionPriority priority,
            UUID clientId,
            UUID siteId,
            UUID equipmentId,
            UUID technicianId,
            UUID supervisorId,
            Instant scheduledFrom,
            Instant scheduledTo,
            Boolean overdue,
            Instant referenceNow
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                var clientJoin = root.join("client", JoinType.LEFT);
                var siteJoin = root.join("site", JoinType.LEFT);
                var equipmentJoin = root.join("equipment", JoinType.LEFT);
                var technicianJoin = root.join("technician", JoinType.LEFT);

                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern),
                        cb.like(cb.lower(clientJoin.get("name")), pattern),
                        cb.like(cb.lower(siteJoin.get("name")), pattern),
                        cb.like(cb.lower(equipmentJoin.get("name")), pattern),
                        cb.like(cb.lower(equipmentJoin.get("code")), pattern),
                        cb.like(cb.lower(technicianJoin.get("name")), pattern)
                ));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (priority != null) {
                predicates.add(cb.equal(root.get("priority"), priority));
            }

            if (clientId != null) {
                predicates.add(cb.equal(root.get("client").get("id"), clientId));
            }

            if (siteId != null) {
                predicates.add(cb.equal(root.get("site").get("id"), siteId));
            }

            if (equipmentId != null) {
                predicates.add(cb.equal(root.get("equipment").get("id"), equipmentId));
            }

            if (technicianId != null) {
                predicates.add(cb.equal(root.get("technician").get("id"), technicianId));
            }

            if (supervisorId != null) {
                predicates.add(cb.equal(root.get("supervisor").get("id"), supervisorId));
            }

            if (scheduledFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("scheduledFor"), scheduledFrom));
            }

            if (scheduledTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("scheduledFor"), scheduledTo));
            }

            if (Boolean.TRUE.equals(overdue)) {
                Instant now = referenceNow != null ? referenceNow : Instant.now();
                predicates.add(cb.lessThan(root.get("scheduledFor"), now));
                predicates.add(root.get("status").in(
                        InspectionStatus.ATRIBUÍDA,
                        InspectionStatus.EM_ANDAMENTO,
                        InspectionStatus.REPROVADA
                ));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
