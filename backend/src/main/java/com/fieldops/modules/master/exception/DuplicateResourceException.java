package com.fieldops.modules.master.exception;

/**
 * Exceção lançada em conflitos de unicidade, como QR Code ou e-mail duplicado (HTTP 409 Conflict).
 */
public class DuplicateResourceException extends RuntimeException {

    private final String code;

    public DuplicateResourceException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}

