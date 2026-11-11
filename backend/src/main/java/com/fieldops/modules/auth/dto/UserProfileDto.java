package com.fieldops.modules.auth.dto;

import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;

import java.util.UUID;

/**
 * DTO com dados públicos do perfil do usuário autenticado (CA-01).
 * Nunca inclui passwordHash ou dados sensíveis internos.
 */
public class UserProfileDto {

    private UUID id;
    private String name;
    private String email;
    private UserRole role;
    private UserStatus status;
    private String phone;

    public UserProfileDto() {
    }

    public UserProfileDto(
            UUID id,
            String name,
            String email,
            UserRole role,
            UserStatus status,
            String phone
    ) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.status = status;
        this.phone = phone;
    }

    public static UserProfileDto fromEntity(User user) {
        return new UserProfileDto(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getPhone()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }
}

