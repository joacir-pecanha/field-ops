package com.fieldops.modules.auth;

import com.fieldops.modules.auth.controller.AuthController;
import com.fieldops.modules.auth.domain.RefreshToken;
import com.fieldops.modules.auth.dto.AuthResponse;
import com.fieldops.modules.auth.dto.LoginRequest;
import com.fieldops.modules.auth.dto.LogoutRequest;
import com.fieldops.modules.auth.dto.RefreshTokenRequest;
import com.fieldops.modules.auth.repository.RefreshTokenRepository;
import com.fieldops.modules.auth.service.AuthService;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import com.fieldops.modules.master.domain.UserStatus;
import com.fieldops.modules.master.repository.UserRepository;
import com.fieldops.security.config.GlobalExceptionHandler;
import com.fieldops.security.config.SecurityConfig;
import com.fieldops.security.jwt.JwtAuthenticationFilter;
import com.fieldops.security.jwt.JwtTokenProvider;
import com.fieldops.security.logging.SensitiveDataMaskingConverter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Suíte de testes de integração com MockMvc e unitários para Autenticação JWT,
 * Autorização Baseada em Roles e Gestão de Sessão (TASK-005 Passo 6).
 *
 * Cobre:
 * - CA-01: Login válido retornando 200 OK com par de tokens, dados públicos do perfil e auditoria de IP/data.
 * - EX-01: Erro de senha ou e-mail inexistente retornando 401 com mensagem padronizada "Credenciais inválidas".
 * - RF-02: Bloqueio de acesso para usuário INACTIVE ou BLOCKED.
 * - EX-02: Renovação de sessão com refresh token válido, expirado ou revogado (logout/rotação).
 * - CA-02: Requisição a rota protegida sem Bearer token retornando 401 Unauthorized.
 * - CA-03: Restrição por role (@PreAuthorize) negando 403 Forbidden para TECHNICIAN em endpoint de ADMIN/SUPERVISOR.
 * - RT-01: Sanitização de logs com Logback e mascaramento em toString() de DTOs/entidades.
 */
@SpringJUnitWebConfig(classes = AuthControllerTest.TestConfig.class)
class AuthControllerTest {

    private static final String TEST_JWT_SECRET = "FieldOpsTestHmacSha256SecretKeyWithMoreThan32Bytes2026!";
    private static final Pattern JSON_FIELD_EXTRACTOR = Pattern.compile("\"([^\"]+)\"\\s*:\\s*\"([^\"]+)\"");

    @Configuration
    @EnableWebMvc
    @Import({
        SecurityConfig.class,
        JwtAuthenticationFilter.class,
        AuthController.class,
        AuthService.class,
        GlobalExceptionHandler.class
    })
    static class TestConfig {

        static final Map<UUID, User> USER_STORE = new ConcurrentHashMap<>();
        static final Map<UUID, RefreshToken> REFRESH_TOKEN_STORE = new ConcurrentHashMap<>();

        @Bean
        public JwtTokenProvider jwtTokenProvider() {
            return new JwtTokenProvider(TEST_JWT_SECRET, 900_000L, 604_800_000L);
        }

        @Bean
        public UserRepository userRepository() {
            return (UserRepository) Proxy.newProxyInstance(
                    UserRepository.class.getClassLoader(),
                    new Class<?>[]{UserRepository.class},
                    (proxy, method, args) -> {
                        String name = method.getName();
                        if ("findByEmailIgnoreCase".equals(name)) {
                            String email = (String) args[0];
                            return USER_STORE.values().stream()
                                    .filter(u -> u.getEmail().equalsIgnoreCase(email))
                                    .findFirst();
                        }
                        if ("existsByEmailIgnoreCase".equals(name)) {
                            String email = (String) args[0];
                            return USER_STORE.values().stream()
                                    .anyMatch(u -> u.getEmail().equalsIgnoreCase(email));
                        }
                        if ("findById".equals(name)) {
                            UUID id = (UUID) args[0];
                            return Optional.ofNullable(USER_STORE.get(id));
                        }
                        if ("save".equals(name)) {
                            User user = (User) args[0];
                            if (user.getId() == null) {
                                user.setId(UUID.randomUUID());
                            }
                            USER_STORE.put(user.getId(), user);
                            return user;
                        }
                        if ("deleteAll".equals(name)) {
                            USER_STORE.clear();
                            return null;
                        }
                        if ("toString".equals(name)) {
                            return "InMemoryUserRepository";
                        }
                        if ("hashCode".equals(name)) {
                            return System.identityHashCode(proxy);
                        }
                        if ("equals".equals(name)) {
                            return proxy == args[0];
                        }
                        throw new UnsupportedOperationException("Método não suportado no stub: " + name);
                    }
            );
        }

        @Bean
        public RefreshTokenRepository refreshTokenRepository() {
            return (RefreshTokenRepository) Proxy.newProxyInstance(
                    RefreshTokenRepository.class.getClassLoader(),
                    new Class<?>[]{RefreshTokenRepository.class},
                    (proxy, method, args) -> {
                        String name = method.getName();
                        if ("findByToken".equals(name)) {
                            String token = (String) args[0];
                            return REFRESH_TOKEN_STORE.values().stream()
                                    .filter(rt -> rt.getToken().equals(token))
                                    .findFirst();
                        }
                        if ("findAllByUser_IdAndRevokedFalse".equals(name)) {
                            UUID userId = (UUID) args[0];
                            return REFRESH_TOKEN_STORE.values().stream()
                                    .filter(rt -> rt.getUser() != null
                                            && userId.equals(rt.getUser().getId())
                                            && !rt.isRevoked())
                                    .toList();
                        }
                        if ("revokeAllActiveByUserId".equals(name)) {
                            UUID userId = (UUID) args[0];
                            Instant revokedAt = (Instant) args[1];
                            int count = 0;
                            for (RefreshToken rt : REFRESH_TOKEN_STORE.values()) {
                                if (rt.getUser() != null && userId.equals(rt.getUser().getId()) && !rt.isRevoked()) {
                                    rt.setRevoked(true);
                                    rt.setRevokedAt(revokedAt);
                                    count++;
                                }
                            }
                            return count;
                        }
                        if ("save".equals(name)) {
                            RefreshToken rt = (RefreshToken) args[0];
                            if (rt.getId() == null) {
                                rt.setId(UUID.randomUUID());
                            }
                            if (rt.getCreatedAt() == null) {
                                rt.setCreatedAt(Instant.now());
                            }
                            REFRESH_TOKEN_STORE.put(rt.getId(), rt);
                            return rt;
                        }
                        if ("saveAll".equals(name)) {
                            @SuppressWarnings("unchecked")
                            Iterable<RefreshToken> tokens = (Iterable<RefreshToken>) args[0];
                            List<RefreshToken> saved = new ArrayList<>();
                            for (RefreshToken rt : tokens) {
                                if (rt.getId() == null) {
                                    rt.setId(UUID.randomUUID());
                                }
                                REFRESH_TOKEN_STORE.put(rt.getId(), rt);
                                saved.add(rt);
                            }
                            return saved;
                        }
                        if ("findAll".equals(name)) {
                            return new ArrayList<>(REFRESH_TOKEN_STORE.values());
                        }
                        if ("deleteAll".equals(name)) {
                            REFRESH_TOKEN_STORE.clear();
                            return null;
                        }
                        if ("toString".equals(name)) {
                            return "InMemoryRefreshTokenRepository";
                        }
                        if ("hashCode".equals(name)) {
                            return System.identityHashCode(proxy);
                        }
                        if ("equals".equals(name)) {
                            return proxy == args[0];
                        }
                        throw new UnsupportedOperationException("Método não suportado no stub: " + name);
                    }
            );
        }
    }

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private AuthService authService;

    private MockMvc mockMvc;

    private User activeTechnician;
    private User activeSupervisor;
    private User activeAdmin;
    private User inactiveUser;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        TestConfig.USER_STORE.clear();
        TestConfig.REFRESH_TOKEN_STORE.clear();

        String encodedPassword = passwordEncoder.encode("SenhaForte@123");

        activeTechnician = new User(
                UUID.randomUUID(),
                "Carlos Técnico",
                "tecnico@fieldops.com",
                encodedPassword,
                UserRole.TECHNICIAN,
                UserStatus.ACTIVE,
                "+5511999990001"
        );
        activeSupervisor = new User(
                UUID.randomUUID(),
                "Ana Supervisora",
                "supervisor@fieldops.com",
                encodedPassword,
                UserRole.SUPERVISOR,
                UserStatus.ACTIVE,
                "+5511999990002"
        );
        activeAdmin = new User(
                UUID.randomUUID(),
                "Joacir Admin",
                "admin@fieldops.com",
                encodedPassword,
                UserRole.ADMIN,
                UserStatus.ACTIVE,
                "+5511999990003"
        );
        inactiveUser = new User(
                UUID.randomUUID(),
                "Roberto Inativo",
                "inativo@fieldops.com",
                encodedPassword,
                UserRole.TECHNICIAN,
                UserStatus.INACTIVE,
                "+5511999990004"
        );

        TestConfig.USER_STORE.put(activeTechnician.getId(), activeTechnician);
        TestConfig.USER_STORE.put(activeSupervisor.getId(), activeSupervisor);
        TestConfig.USER_STORE.put(activeAdmin.getId(), activeAdmin);
        TestConfig.USER_STORE.put(inactiveUser.getId(), inactiveUser);
    }

    @Test
    @DisplayName("CA-01: Login com usuário ativo retorna 200 OK com tokens assinados, perfil público e auditoria de IP")
    void loginWithValidCredentialsReturnsTokensAndProfile() throws Exception {
        String payload = "{\"email\":\"tecnico@fieldops.com\",\"password\":\"SenhaForte@123\"}";

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "192.168.1.50")
                        .header(HttpHeaders.USER_AGENT, "FieldOpsMobile/1.0")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(jsonPath("$.user.id").value(activeTechnician.getId().toString()))
                .andExpect(jsonPath("$.user.name").value("Carlos Técnico"))
                .andExpect(jsonPath("$.user.email").value("tecnico@fieldops.com"))
                .andExpect(jsonPath("$.user.role").value("TECHNICIAN"))
                .andExpect(jsonPath("$.user.status").value("ACTIVE"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        String accessToken = extractJsonStringField(responseBody, "accessToken");
        String refreshToken = extractJsonStringField(responseBody, "refreshToken");

        assertTrue(jwtTokenProvider.validateAccessToken(accessToken));
        assertTrue(jwtTokenProvider.validateRefreshToken(refreshToken));
        assertEquals(activeTechnician.getId(), jwtTokenProvider.getUserIdFromToken(accessToken));
        assertEquals(UserRole.TECHNICIAN, jwtTokenProvider.getRoleFromToken(accessToken));

        Collection<RefreshToken> persistedTokens = TestConfig.REFRESH_TOKEN_STORE.values();
        assertEquals(1, persistedTokens.size());
        RefreshToken savedToken = persistedTokens.iterator().next();
        assertEquals("192.168.1.50", savedToken.getIpAddress());
        assertEquals("FieldOpsMobile/1.0", savedToken.getUserAgent());
        assertNotNull(savedToken.getCreatedAt());
        assertNotNull(savedToken.getExpiresAt());
        assertFalse(savedToken.isRevoked());
    }

    @Test
    @DisplayName("EX-01: Login com senha incorreta ou e-mail inexistente retorna 401 com mensagem padronizada sem distinguir e-mail")
    void loginWithInvalidPasswordOrUnknownEmailReturnsStandardized401() throws Exception {
        String wrongPasswordPayload = "{\"email\":\"tecnico@fieldops.com\",\"password\":\"SenhaErrada999\"}";
        String unknownEmailPayload = "{\"email\":\"naoexiste@fieldops.com\",\"password\":\"SenhaErrada999\"}";

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongPasswordPayload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas"))
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(unknownEmailPayload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Credenciais inválidas"))
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    @DisplayName("RF-02: Login com usuário inativo ou bloqueado é negado com 403 Forbidden")
    void loginWithInactiveUserReturns403Forbidden() throws Exception {
        String payload = "{\"email\":\"inativo@fieldops.com\",\"password\":\"SenhaForte@123\"}";

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("USER_INACTIVE"));

        assertTrue(TestConfig.REFRESH_TOKEN_STORE.isEmpty());
    }

    @Test
    @DisplayName("RF-03 / EX-02: Refresh token válido renova sessão e rotaciona o token anterior; reuso retorna 401")
    void refreshTokenRotatesSessionAndRejectsReusedToken() throws Exception {
        AuthResponse initialSession = authService.login(
                new LoginRequest("tecnico@fieldops.com", "SenhaForte@123"),
                "10.0.0.10",
                "JUnit"
        );

        String refreshPayload = "{\"refreshToken\":\"" + initialSession.getRefreshToken() + "\"}";

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();

        String newRefreshToken = extractJsonStringField(refreshResult.getResponse().getContentAsString(), "refreshToken");
        assertNotNull(newRefreshToken);

        // Tentativa de reutilizar o refresh token antigo já rotacionado deve retornar 401
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshPayload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
    }

    @Test
    @DisplayName("EX-02: Refresh com token expirado retorna 401 Unauthorized forçando novo login")
    void refreshWithExpiredTokenReturns401Unauthorized() throws Exception {
        String expiredRefreshJwt = jwtTokenProvider.generateTokenWithCustomExpiration(
                activeTechnician,
                JwtTokenProvider.TOKEN_TYPE_REFRESH,
                -60_000L
        );

        RefreshToken expiredEntity = new RefreshToken(
                UUID.randomUUID(),
                activeTechnician,
                expiredRefreshJwt,
                "127.0.0.1",
                "JUnit",
                Instant.now().minusSeconds(60)
        );
        TestConfig.REFRESH_TOKEN_STORE.put(expiredEntity.getId(), expiredEntity);

        String refreshPayload = "{\"refreshToken\":\"" + expiredRefreshJwt + "\"}";

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(refreshPayload))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));

        assertTrue(expiredEntity.isRevoked());
    }

    @Test
    @DisplayName("RF-05: Logout explícito revoga o refresh token e impede renovação posterior")
    void logoutRevokesRefreshToken() throws Exception {
        AuthResponse session = authService.login(
                new LoginRequest("tecnico@fieldops.com", "SenhaForte@123"),
                "127.0.0.1",
                "JUnit"
        );

        String tokenPayload = "{\"refreshToken\":\"" + session.getRefreshToken() + "\"}";

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tokenPayload))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tokenPayload))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("CA-02: Requisição a rota protegida sem Bearer token retorna 401 Unauthorized")
    void protectedEndpointWithoutBearerTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        String validAccessToken = jwtTokenProvider.generateAccessToken(activeTechnician);
        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + validAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("tecnico@fieldops.com"))
                .andExpect(jsonPath("$.role").value("TECHNICIAN"));
    }

    @Test
    @DisplayName("CA-03 / RF-04: Técnico recebe 403 Forbidden em endpoint restrito a ADMIN ou SUPERVISOR; Supervisor tem sucesso")
    void technicianCannotAccessSupervisorOrAdminEndpoint() throws Exception {
        String technicianToken = jwtTokenProvider.generateAccessToken(activeTechnician);
        String supervisorToken = jwtTokenProvider.generateAccessToken(activeSupervisor);

        // Técnico tentando revogar sessões administrativas recebe 403 Forbidden
        mockMvc.perform(post("/api/v1/auth/sessions/" + activeTechnician.getId() + "/revoke")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + technicianToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Supervisor executando a mesma ação tem permissão concedida (204 No Content)
        mockMvc.perform(post("/api/v1/auth/sessions/" + activeTechnician.getId() + "/revoke")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + supervisorToken))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("RF-05 / RN-008: Troca de senha ou bloqueio do usuário invalida sessões ativas imediatamente")
    void passwordChangeAndUserBlockInvalidateActiveSessions() {
        AuthResponse session = authService.login(
                new LoginRequest("tecnico@fieldops.com", "SenhaForte@123"),
                "127.0.0.1",
                "JUnit"
        );

        authService.changePasswordAndRevokeSessions(activeTechnician.getId(), "NovaSenhaSegura@456");

        RefreshToken stored = TestConfig.REFRESH_TOKEN_STORE.values().iterator().next();
        assertTrue(stored.isRevoked());
        assertTrue(passwordEncoder.matches("NovaSenhaSegura@456", activeTechnician.getPasswordHash()));

        // Novo login com a nova senha e posterior bloqueio do usuário
        AuthResponse secondSession = authService.login(
                new LoginRequest("tecnico@fieldops.com", "NovaSenhaSegura@456"),
                "127.0.0.1",
                "JUnit"
        );
        assertNotNull(secondSession.getAccessToken());

        authService.updateUserStatus(activeTechnician.getId(), UserStatus.BLOCKED);
        boolean anyUnrevoked = TestConfig.REFRESH_TOKEN_STORE.values().stream()
                .anyMatch(rt -> !rt.isRevoked());
        assertFalse(anyUnrevoked);
    }

    @Test
    @DisplayName("RT-01 / Passo 5: Conversor Logback e DTOs mascaram senhas, tokens JWT e cartões contra vazamento em logs")
    void logSanitizerAndDtoToStringMaskSensitiveFields() {
        String rawLog = "Payload={\"email\":\"user@fieldops.com\",\"password\":\"Segredo123\",\"accessToken\":\"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig\"} "
                + "Header=Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig card=4532 0151 1283 0366";

        String masked = SensitiveDataMaskingConverter.maskSensitiveData(rawLog);

        assertFalse(masked.contains("Segredo123"));
        assertFalse(masked.contains("eyJhbGciOiJIUzI1NiJ9"));
        assertFalse(masked.contains("4532 0151 1283 0366"));
        assertTrue(masked.contains("[REDACTED]"));

        LoginRequest loginRequest = new LoginRequest("user@fieldops.com", "Segredo123");
        RefreshTokenRequest refreshRequest = new RefreshTokenRequest("refresh-secret-token");
        LogoutRequest logoutRequest = new LogoutRequest("logout-secret-token");

        assertFalse(loginRequest.toString().contains("Segredo123"));
        assertFalse(refreshRequest.toString().contains("refresh-secret-token"));
        assertFalse(logoutRequest.toString().contains("logout-secret-token"));
    }

    private String extractJsonStringField(String json, String fieldName) {
        Matcher matcher = JSON_FIELD_EXTRACTOR.matcher(json);
        while (matcher.find()) {
            if (fieldName.equals(matcher.group(1))) {
                return matcher.group(2);
            }
        }
        return null;
    }
}

