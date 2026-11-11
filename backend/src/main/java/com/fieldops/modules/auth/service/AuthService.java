package com.fieldops.modules.auth.service;

import com.fieldops.modules.auth.domain.RefreshToken;
import com.fieldops.modules.auth.dto.AuthResponse;
import com.fieldops.modules.auth.dto.LoginRequest;
import com.fieldops.modules.auth.dto.LogoutRequest;
import com.fieldops.modules.auth.dto.RefreshTokenRequest;
import com.fieldops.modules.auth.dto.UserProfileDto;
import com.fieldops.modules.auth.exception.InvalidCredentialsException;
import com.fieldops.modules.auth.exception.InvalidRefreshTokenException;
import com.fieldops.modules.auth.exception.UserInactiveException;
import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.security.jwt.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Serviço de domínio de Autenticação e Gestão de Sessão (TASK-005).
 * Implementa login por e-mail/senha com BCrypt (RF-01), bloqueio de usuários inativos/bloqueados (RF-02),
 * emissão de par Access/Refresh Token (RF-03) e revogação/rotação segura de tokens (RF-05).
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtTokenProvider jwtTokenProvider,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Autentica um usuário por e-mail e senha, emitindo par de tokens e persistindo auditoria do Refresh Token.
     */
    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent) {
        String normalizedEmail = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        if (!user.isActive()) {
            revokeAllUserSessions(user.getId());
            throw new UserInactiveException(
                    "Usuário inativo ou bloqueado. Entre em contato com o suporte ou administrador.",
                    user.getStatus()
            );
        }

        AuthResponse response = issueSessionTokens(user, ipAddress, userAgent);
        log.info("Sessão iniciada com sucesso para userId={} role={} ip={}", user.getId(), user.getRole(), ipAddress);
        return response;
    }

    /**
     * Renova o par de tokens validando integridade, expiração, estado de revogação e status ativo do usuário.
     */
    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request, String ipAddress, String userAgent) {
        String rawRefreshToken = request.getRefreshToken() != null ? request.getRefreshToken().trim() : "";
        if (rawRefreshToken.isEmpty()) {
            throw new InvalidRefreshTokenException("O refresh token é obrigatório.");
        }

        Optional<RefreshToken> storedOpt = refreshTokenRepository.findByToken(rawRefreshToken);
        if (storedOpt.isEmpty()) {
            throw new InvalidRefreshTokenException("Refresh token inválido ou não reconhecido.");
        }

        RefreshToken storedToken = storedOpt.get();
        if (storedToken.isRevoked()) {
            throw new InvalidRefreshTokenException("Refresh token já foi revogado. Realize um novo login.");
        }

        if (storedToken.isExpired() || !jwtTokenProvider.validateRefreshToken(rawRefreshToken)) {
            storedToken.revoke();
            refreshTokenRepository.save(storedToken);
            throw new InvalidRefreshTokenException("Refresh token expirado. Realize um novo login.");
        }

        User user = storedToken.getUser();
        if (user == null || !user.isActive()) {
            storedToken.revoke();
            refreshTokenRepository.save(storedToken);
            if (user != null) {
                revokeAllUserSessions(user.getId());
            }
            throw new InvalidRefreshTokenException("Sessão encerrada: usuário inativo ou bloqueado.");
        }

        // Rotaciona o refresh token atual (revoga o anterior e emite um novo par)
        storedToken.revoke();
        refreshTokenRepository.save(storedToken);

        AuthResponse response = issueSessionTokens(user, ipAddress, userAgent);
        log.info("Sessão renovada com sucesso para userId={} ip={}", user.getId(), ipAddress);
        return response;
    }

    /**
     * Invalida o refresh token informado e/ou as sessões ativas do usuário no logout explícito (RF-05).
     */
    @Transactional
    public void logout(LogoutRequest request, UUID authenticatedUserId) {
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            String rawToken = request.getRefreshToken().trim();
            refreshTokenRepository.findByToken(rawToken).ifPresent(rt -> {
                if (!rt.isRevoked()) {
                    rt.revoke();
                    refreshTokenRepository.save(rt);
                }
            });
        }

        if (authenticatedUserId != null) {
            revokeAllUserSessions(authenticatedUserId);
            log.info("Logout executado para userId={}", authenticatedUserId);
        }
    }

    /**
     * Revoga todas as sessões (refresh tokens) ativas de um usuário ao trocar senha, bloquear conta ou por ação administrativa (RF-05, RN-008).
     */
    @Transactional
    public void revokeAllUserSessions(UUID userId) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findAllByUser_IdAndRevokedFalse(userId);
        Instant now = Instant.now();
        for (RefreshToken token : activeTokens) {
            token.setRevoked(true);
            token.setRevokedAt(now);
        }
        if (!activeTokens.isEmpty()) {
            refreshTokenRepository.saveAll(activeTokens);
        }
    }

    /**
     * Atualiza a senha de um usuário com hash BCrypt e revoga imediatamente todos os seus refresh tokens (RF-05, RN-008).
     */
    @Transactional
    public void changePasswordAndRevokeSessions(UUID userId, String newRawPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        user.setPasswordHash(passwordEncoder.encode(newRawPassword));
        userRepository.save(user);
        revokeAllUserSessions(userId);
        log.info("Senha atualizada e sessões revogadas para userId={}", userId);
    }

    /**
     * Altera o status do usuário (ex: BLOCKED / INACTIVE) e revoga todas as sessões caso não esteja ACTIVE (RF-02, RF-05, RN-008).
     */
    @Transactional
    public void updateUserStatus(UUID userId, UserStatus newStatus) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        user.setStatus(newStatus);
        userRepository.save(user);
        if (newStatus != UserStatus.ACTIVE) {
            revokeAllUserSessions(userId);
            log.info("Usuário userId={} alterado para status={} e sessões revogadas", userId, newStatus);
        }
    }

    /**
     * Retorna os dados públicos do perfil do usuário autenticado.
     */
    @Transactional(readOnly = true)
    public UserProfileDto getCurrentUserProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(InvalidCredentialsException::new);
        if (!user.isActive()) {
            throw new UserInactiveException(
                    "Usuário inativo ou bloqueado.",
                    user.getStatus()
            );
        }
        return UserProfileDto.fromEntity(user);
    }

    private AuthResponse issueSessionTokens(User user, String ipAddress, String userAgent) {
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshTokenValue = jwtTokenProvider.generateRefreshToken(user);
        Instant refreshExpiresAt = Instant.now().plusMillis(jwtTokenProvider.getRefreshTokenExpirationMs());

        RefreshToken refreshTokenEntity = new RefreshToken(
                UUID.randomUUID(),
                user,
                refreshTokenValue,
                ipAddress,
                userAgent,
                refreshExpiresAt
        );
        refreshTokenRepository.save(refreshTokenEntity);

        long expiresInSeconds = jwtTokenProvider.getAccessTokenExpirationMs() / 1000L;
        return new AuthResponse(
                accessToken,
                refreshTokenValue,
                expiresInSeconds,
                UserProfileDto.fromEntity(user)
        );
    }
}

