package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload de criação de usuário (RT-02, RT-03, AC-USERS).
 */
@Schema(description = "Dados de entrada para criação de usuário")
public record UserCreateRequest(
        @Schema(description = "Nome completo do usuário", example = "Carlos Técnico")
        @NotBlank(message = "O nome do usuário é obrigatório.")
        @Size(min = 2, max = 150, message = "O nome do usuário deve ter entre 2 e 150 caracteres.")
        String name,

        @Schema(description = "E-mail corporativo único", example = "carlos@fieldops.com")
        @NotBlank(message = "O e-mail do usuário é obrigatório.")
        @Email(message = "O e-mail informado é inválido.")
        @Size(max = 255, message = "O e-mail deve ter no máximo 255 caracteres.")
        String email,

        @Schema(description = "Senha inicial de acesso (mínimo 8 caracteres)", format = "password")
        @NotBlank(message = "A senha inicial é obrigatória.")
        @Size(min = 8, max = 100, message = "A senha deve ter entre 8 e 100 caracteres.")
        String password,

        @Schema(description = "Perfil de acesso do usuário")
        @NotNull(message = "O perfil (role) do usuário é obrigatório.")
        UserRole role,

        @Schema(description = "Situação inicial do usuário (padrão ACTIVE)")
        UserStatus status,

        @Schema(description = "Telefone de contato", example = "+5511999990001")
        @Size(max = 32, message = "O telefone deve ter no máximo 32 caracteres.")
        @Pattern(regexp = "^\\+?[0-9()\\s-]{8,20}$", message = "O telefone informado possui formato inválido.")
        String phone
) {
    @Override
    public String toString() {
        return "UserCreateRequest{name='" + name + "', email='" + email + "', password='[REDACTED]', role=" + role
                + ", status=" + status + "}";
    }
}

