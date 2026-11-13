package com.fieldops.modules.master.exception;

import java.util.UUID;

/**
 * Exceção lançada quando um recurso mestre solicitado não é encontrado (HTTP 404).
 */
public class ResourceNotFoundException extends RuntimeException {

    private final String code;

    public ResourceNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static ResourceNotFoundException of(String resourceName, UUID id) {
        return new ResourceNotFoundException(
                "RESOURCE_NOT_FOUND",
                resourceName + " não encontrado para o identificador " + id + "."
        );
    }

    public String getCode() {
        return code;
    }
}

