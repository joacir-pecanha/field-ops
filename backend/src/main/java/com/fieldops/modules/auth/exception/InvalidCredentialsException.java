package com.fieldops.modules.auth.exception;

/**
 * Exceção lançada quando e-mail ou senha são inválidos (EX-01).
 * Sempre produz mensagem padronizada "Credenciais inválidas" sem revelar se o e-mail existe.
 */
public class InvalidCredentialsException extends RuntimeException {

    public static final String DEFAULT_MESSAGE = "Credenciais inválidas";

    public InvalidCredentialsException() {
        super(DEFAULT_MESSAGE);
    }

    public InvalidCredentialsException(String message) {
        super(message);
    }
}

