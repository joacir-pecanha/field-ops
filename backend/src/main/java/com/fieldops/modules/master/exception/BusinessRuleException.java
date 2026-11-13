package com.fieldops.modules.master.exception;

/**
 * Exceção lançada quando uma regra de negócio de integridade cadastral é violada (HTTP 422).
 */
public class BusinessRuleException extends RuntimeException {

    private final String code;

    public BusinessRuleException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}

