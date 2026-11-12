package com.fieldops.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO de entrada para o endpoint POST /api/v1/auth/login.
 * Mascara a senha em toString() para impedir vazamento em logs (RN-007, RT-01).
 */
public class LoginRequest {

    @NotBlank(message = "O e-mail é obrigatório.")
    @Email(message = "Informe um endereço de e-mail válido.")
    private String email;

    @NotBlank(message = "A senha é obrigatória.")
    @Size(min = 6, max = 128, message = "A senha deve ter entre 6 e 128 caracteres.")
    private String password;

    public LoginRequest() {
    }

    public LoginRequest(String email, String password) {
        this.email = email;
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    @Override
    public String toString() {
        return "LoginRequest{" +
                "email='" + email + '\'' +
                ", password='[REDACTED]'" +
                '}';
    }
}

