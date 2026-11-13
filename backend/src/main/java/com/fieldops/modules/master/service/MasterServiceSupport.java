package com.fieldops.modules.master.service;

import com.fieldops.modules.master.exception.BusinessRuleException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Utilitários compartilhados entre os serviços de cadastros mestres para higienização de strings
 * e validação segura de paginação/ordenação.
 */
final class MasterServiceSupport {

    private static final int MAX_PAGE_SIZE = 100;

    private MasterServiceSupport() {
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static Pageable sanitizePageable(Pageable pageable, Set<String> allowedSortFields, Sort defaultSort) {
        if (pageable == null || pageable.isUnpaged()) {
            return PageRequest.of(0, 20, defaultSort);
        }
        int page = Math.max(0, pageable.getPageNumber());
        int size = Math.min(Math.max(1, pageable.getPageSize()), MAX_PAGE_SIZE);

        Sort sort = pageable.getSort();
        if (sort.isUnsorted()) {
            return PageRequest.of(page, size, defaultSort);
        }

        for (Sort.Order order : sort) {
            if (!allowedSortFields.contains(order.getProperty())) {
                throw new BusinessRuleException(
                        "INVALID_SORT_FIELD",
                        "Campo de ordenação inválido: '" + order.getProperty() + "'."
                );
            }
        }
        return PageRequest.of(page, size, sort);
    }
}

