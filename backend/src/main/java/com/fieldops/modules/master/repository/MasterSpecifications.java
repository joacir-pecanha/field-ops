package com.fieldops.modules.master.repository;

import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.EquipmentStatus;
import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Fábrica de {@link Specification} para consultas paginadas e filtradas dos cadastros mestres (RF-06).
 */
public final class MasterSpecifications {

    private MasterSpecifications() {
    }

    public static Specification<User> filterUsers(String search, UserRole role, UserStatus status, Boolean active) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            addTextSearchPredicate(predicates, root, cb, search, "name", "email", "phone");
            if (role != null) {
                predicates.add(cb.equal(root.get("role"), role));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (active != null) {
                predicates.add(active
                        ? cb.equal(root.get("status"), UserStatus.ACTIVE)
                        : cb.notEqual(root.get("status"), UserStatus.ACTIVE));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public static Specification<Client> filterClients(String search, MasterStatus status, Boolean active) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            addTextSearchPredicate(predicates, root, cb, search, "name", "legalName", "code", "document", "email");
            addStatusAndActivePredicates(predicates, root, cb, status, active);
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public static Specification<Site> filterSites(UUID clientId, String search, MasterStatus status, Boolean active) {
        return (root, query, cb) -> {
            if (query != null && Long.class != query.getResultType() && long.class != query.getResultType()) {
                root.fetch("client", JoinType.INNER);
            }
            List<Predicate> predicates = new ArrayList<>();
            if (clientId != null) {
                predicates.add(cb.equal(root.get("client").get("id"), clientId));
            }
            addTextSearchPredicate(predicates, root, cb, search, "name", "code", "city", "addressLine");
            addStatusAndActivePredicates(predicates, root, cb, status, active);
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public static Specification<Equipment> filterEquipments(
            UUID clientId,
            UUID siteId,
            String search,
            EquipmentStatus status,
            Boolean active
    ) {
        return (root, query, cb) -> {
            if (query != null && Long.class != query.getResultType() && long.class != query.getResultType()) {
                var siteFetch = root.fetch("site", JoinType.INNER);
                siteFetch.fetch("client", JoinType.INNER);
            }
            List<Predicate> predicates = new ArrayList<>();
            if (siteId != null) {
                predicates.add(cb.equal(root.get("site").get("id"), siteId));
            }
            if (clientId != null) {
                predicates.add(cb.equal(root.get("site").get("client").get("id"), clientId));
            }
            addTextSearchPredicate(predicates, root, cb, search, "name", "code", "qrCode", "assetNumber", "serialNumber");
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static <T> void addTextSearchPredicate(
            List<Predicate> predicates,
            Root<T> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            String search,
            String... fields
    ) {
        if (search == null || search.isBlank()) {
            return;
        }
        String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        List<Predicate> orPredicates = new ArrayList<>(fields.length);
        for (String field : fields) {
            Expression<String> path = cb.lower(root.get(field));
            orPredicates.add(cb.like(path, pattern));
        }
        predicates.add(cb.or(orPredicates.toArray(Predicate[]::new)));
    }

    private static <T> void addStatusAndActivePredicates(
            List<Predicate> predicates,
            Root<T> root,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            MasterStatus status,
            Boolean active
    ) {
        if (status != null) {
            predicates.add(cb.equal(root.get("status"), status));
        }
        if (active != null) {
            predicates.add(cb.equal(root.get("active"), active));
        }
    }
}

