package com.fieldops.modules.template.repository;

import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Specifications para busca paginada e filtragem de modelos de inspeção.
 */
public final class TemplateSpecifications {

    private TemplateSpecifications() {
    }

    public static Specification<InspectionTemplate> filterTemplates(
            String search,
            String category,
            TemplateStatus status,
            Boolean active
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                List<Predicate> orPredicates = new ArrayList<>(4);
                for (String field : List.of("title", "code", "category", "description")) {
                    Expression<String> path = cb.lower(root.get(field));
                    orPredicates.add(cb.like(path, pattern));
                }
                predicates.add(cb.or(orPredicates.toArray(Predicate[]::new)));
            }

            if (category != null && !category.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("category")), category.trim().toLowerCase(Locale.ROOT)));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}

