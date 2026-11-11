package com.fieldops.modules.auth.dto;

/**
 * DTO de resposta de autenticação e renovação de sessão (CA-01, RF-03).
 * Compatível com o contrato consumido pelo Mobile (TASK-004) e Web Admin (TASK-006).
 */
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType = "Bearer";
    private long expiresIn;
    private UserProfileDto user;

    public AuthResponse() {
    }

    public AuthResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            UserProfileDto user
    ) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenType = "Bearer";
        this.expiresIn = expiresIn;
        this.user = user;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public long getExpiresIn() {
        return expiresIn;
    }

    public void setExpiresIn(long expiresIn) {
        this.expiresIn = expiresIn;
    }

    public UserProfileDto getUser() {
        return user;
    }

    public void setUser(UserProfileDto user) {
        this.user = user;
    }

    @Override
    public String toString() {
        return "AuthResponse{" +
                "accessToken='[REDACTED]'" +
                ", refreshToken='[REDACTED]'" +
                ", tokenType='" + tokenType + '\'' +
                ", expiresIn=" + expiresIn +
                ", user=" + (user != null ? user.getEmail() : null) +
                '}';
    }
}

