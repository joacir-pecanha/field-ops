package com.fieldops.modules.inspection.exception;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Exceção lançada para erros de validação de entrada durante revisão, reprovação ou
 * ajuste administrativo (ex.: motivo de reprovação ausente em EX-01 -> HTTP 400 Bad Request).
 */
public class InspectionReviewValidationException extends RuntimeException {

    private final String code;
    private final Map<String, String> errors;

    public InspectionReviewValidationException(
            String code,
            String message,
            Map<String, String> errors
    ) {
        super(message);
        this.code = code;
        this.errors = errors != null ? Collections.unmodifiableMap(new LinkedHashMap<>(errors)) : Map.of();
    }

    public String getCode() {
        return code;
    }

    public Map<String, String> getErrors() {
        return errors;
    }
}
