package com.fieldops.modules.auth.controller;

import com.fieldops.modules.auth.dto.AuthResponse;
import com.fieldops.modules.auth.dto.LoginRequest;
import com.fieldops.modules.auth.dto.LogoutRequest;
import com.fieldops.modules.auth.dto.RefreshTokenRequest;
import com.fieldops.modules.auth.dto.UserProfileDto;
import com.fieldops.modules.auth.service.AuthService;
import com.fieldops.security.jwt.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Controller REST de Autenticação e Gestão de Sessão (TASK-005 Passo 4, RT-03).
 *
 * Endpoints expostos:
 * - POST /api/v1/auth/login: Autentica usuário ativo e emite par de tokens (Access + Refresh).
 * - POST /api/v1/auth/refresh: Renova sessão utilizando Refresh Token válido e não revogado.
 * - POST /api/v1/auth/logout: Revoga Refresh Token e encerra a sessão atual.
 * - GET  /api/v1/auth/me: Retorna dados públicos do perfil do usuário autenticado.
 * - POST /api/v1/auth/sessions/{userId}/revoke: Revoga todas as sessões de um usuário (restrito a ADMIN/SUPERVISOR).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Endpoint de autenticação por e-mail e senha (RF-01, RF-02, RF-03, CA-01).
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest servletRequest
    ) {
        String ipAddress = extractClientIp(servletRequest);
        String userAgent = servletRequest.getHeader(HttpHeaders.USER_AGENT);
        AuthResponse response = authService.login(request, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint de renovação de sessão via Refresh Token com rotação automática (RF-03, EX-02).
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest servletRequest
    ) {
        String ipAddress = extractClientIp(servletRequest);
        String userAgent = servletRequest.getHeader(HttpHeaders.USER_AGENT);
        AuthResponse response = authService.refresh(request, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint de encerramento explícito de sessão e revogação do Refresh Token (RF-05, AC-AUTH).
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @RequestBody(required = false) LogoutRequest request
    ) {
        UUID authenticatedUserId = extractAuthenticatedUserId();
        authService.logout(request, authenticatedUserId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retorna o perfil público do usuário autenticado na sessão atual (CA-01, CA-02).
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserProfileDto> me() {
        UUID authenticatedUserId = extractAuthenticatedUserId();
        UserProfileDto profile = authService.getCurrentUserProfile(authenticatedUserId);
        return ResponseEntity.ok(profile);
    }

    /**
     * Revoga todas as sessões ativas de um usuário específico.
     * Restrito aos perfis ADMIN e SUPERVISOR (RF-04, RF-05, CA-03).
     */
    @PostMapping("/sessions/{userId}/revoke")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public ResponseEntity<Void> revokeUserSessions(@PathVariable("userId") UUID userId) {
        authService.revokeAllUserSessions(userId);
        return ResponseEntity.noContent().build();
    }

    private UUID extractAuthenticatedUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser) {
            return authenticatedUser.getId();
        }
        return null;
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

