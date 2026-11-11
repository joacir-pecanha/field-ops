package com.fieldops.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO de entrada para o endpoint POST /api/v1/auth/refresh.
 * Mascara o token em toString() para impedir vazamento em logs (RN-007, RT-01).
 */
public class RefreshTokenRequest {

    @NotBlank(message = "O refresh token é obrigatório.")
    private String refreshToken;

    public RefreshTokenRequest() {
    }

    public RefreshTokenRequest(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    @Override
    public String toString() {
        return "RefreshTokenRequest{refreshToken='[REDACTED]'}";
    }
}

