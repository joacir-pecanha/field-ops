package com.fieldops.modules.auth.exception;

import com.fieldops.modules.master.domain.UserStatus;

/**
 * Exceção lançada quando um usuário INACTIVE ou BLOCKED tenta iniciar ou renovar sessão (RF-02, RN-001).
 */
public class UserInactiveException extends RuntimeException {

    private final UserStatus status;

    public UserInactiveException(String message, UserStatus status) {
        super(message);
        this.status = status;
    }

    public UserStatus getStatus() {
        return status;
    }
}

