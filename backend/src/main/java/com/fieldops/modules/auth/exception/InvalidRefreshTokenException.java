package com.fieldops.modules.auth.exception;

/**
 * Exceção lançada quando o Refresh Token está ausente, inválido, revogado ou expirado (EX-02).
 */
public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException(String message) {
        super(message);
    }
}

