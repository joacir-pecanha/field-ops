package com.fieldops.modules.template.exception;

import java.util.List;

/**
 * Exceção lançada quando um modelo de inspeção possui pendências que impedem sua publicação (HTTP 400).
 */
public class TemplatePublishValidationException extends RuntimeException {

    private final String code;
    private final List<String> pendencies;

    public TemplatePublishValidationException(String code, String message, List<String> pendencies) {
        super(message);
        this.code = code;
        this.pendencies = pendencies != null ? List.copyOf(pendencies) : List.of();
    }

    public String getCode() {
        return code;
    }

    public List<String> getPendencies() {
        return pendencies;
    }
}

