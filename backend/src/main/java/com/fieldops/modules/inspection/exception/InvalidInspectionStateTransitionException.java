package com.fieldops.modules.inspection.exception;

import com.fieldops.modules.inspection.domain.InspectionStatus;

/**
 * Exceção lançada quando uma transição de estado da inspeção viola a máquina de estados
 * ou tenta alterar uma inspeção já bloqueada (APROVADA / CANCELADA), retornando HTTP 409 Conflict (RT-01, EX-02).
 */
public class InvalidInspectionStateTransitionException extends RuntimeException {

    private final String code;
    private final InspectionStatus currentStatus;
    private final InspectionStatus targetStatus;

    public InvalidInspectionStateTransitionException(
            String code,
            InspectionStatus currentStatus,
            InspectionStatus targetStatus,
            String message
    ) {
        super(message);
        this.code = code;
        this.currentStatus = currentStatus;
        this.targetStatus = targetStatus;
    }

    public String getCode() {
        return code;
    }

    public InspectionStatus getCurrentStatus() {
        return currentStatus;
    }

    public InspectionStatus getTargetStatus() {
        return targetStatus;
    }
}
