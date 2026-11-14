package com.fieldops.modules.inspection.exception;

/**
 * Exceção lançada para erros de validação operacional no agendamento de inspeções
 * que devem retornar HTTP 400 Bad Request (ex.: técnico inativo - EX-01).
 */
public class InspectionSchedulingValidationException extends RuntimeException {

    private final String code;

    public InspectionSchedulingValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
