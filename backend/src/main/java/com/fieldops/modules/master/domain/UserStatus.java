package com.fieldops.modules.master.domain;

/**
 * Estados cadastrais de usuário na plataforma FieldOps (docs/modelo-de-dados.md 10.6.1).
 * RN-001: Somente usuários ACTIVE podem iniciar nova sessão.
 * RN-002: A inativação não exclui registros históricos.
 */
public enum UserStatus {
    ACTIVE,
    INACTIVE,
    BLOCKED
}

