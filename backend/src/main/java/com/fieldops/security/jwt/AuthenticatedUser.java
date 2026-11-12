package com.fieldops.security.jwt;

import com.fieldops.modules.master.domain.UserRole;

import java.security.Principal;
import java.util.UUID;

/**
 * Representa a identidade autenticada extraída do token JWT no SecurityContext.
 */
public class AuthenticatedUser implements Principal {

    private final UUID id;
    private final String email;
    private final UserRole role;

    public AuthenticatedUser(UUID id, String email, UserRole role) {
        this.id = id;
        this.email = email;
        this.role = role;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public UserRole getRole() {
        return role;
    }

    @Override
    public String getName() {
        return email;
    }

    @Override
    public String toString() {
        return "AuthenticatedUser{" +
                "id=" + id +
                ", email='" + email + '\'' +
                ", role=" + role +
                '}';
    }
}

