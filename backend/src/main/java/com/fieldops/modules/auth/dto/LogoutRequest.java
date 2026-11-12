package com.fieldops.modules.auth.dto;

/**
 * DTO de entrada para o endpoint POST /api/v1/auth/logout.
 * Mascara o token em toString() para impedir vazamento em logs (RN-007, RT-01).
 */
public class LogoutRequest {

    private String refreshToken;

    public LogoutRequest() {
    }

    public LogoutRequest(String refreshToken) {
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
        return "LogoutRequest{refreshToken='[REDACTED]'}";
    }
}

