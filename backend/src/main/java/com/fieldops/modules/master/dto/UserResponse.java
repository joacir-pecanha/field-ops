package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de saída de usuário sem exposição de credenciais ou hash de senha (RT-02, RN-007).
 */
@Schema(description = "Dados públicos de usuário cadastrado")
public record UserResponse(
        UUID id,
        String name,
        String email,
        UserRole role,
        UserStatus status,
        boolean active,
        String phone,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static UserResponse fromEntity(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.isActive(),
                user.getPhone(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getVersion()
        );
    }
}

