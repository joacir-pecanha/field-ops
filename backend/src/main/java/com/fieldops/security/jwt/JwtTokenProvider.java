package com.fieldops.security.jwt;

import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.master.domain.UserRole;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Provedor de geração e validação de tokens JWT assinados com HMAC-SHA256 (HS256).
 * Emite tokens com claims mínimas (sub, email, role, type, jti, iat, exp) e verifica
 * a assinatura em tempo constante (MessageDigest.isEqual) sem expor credenciais em logs.
 */
@Component
public class JwtTokenProvider {

    public static final String TOKEN_TYPE_ACCESS = "ACCESS";
    public static final String TOKEN_TYPE_REFRESH = "REFRESH";

    private static final String HMAC_ALGO = "HmacSHA256";
    private static final String JWT_HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
    private static final String ENCODED_HEADER = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(JWT_HEADER_JSON.getBytes(StandardCharsets.UTF_8));

    private static final Pattern STRING_CLAIM_PATTERN = Pattern.compile("\"([^\"]+)\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern NUMBER_CLAIM_PATTERN = Pattern.compile("\"([^\"]+)\"\\s*:\\s*(-?\\d+)");

    private final byte[] secretBytes;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    @Autowired
    public JwtTokenProvider(
            @Value("${fieldops.security.jwt.secret:FieldOpsDefaultSecureHmacSha256SecretKeyForDevAndTestEnv2026!}") String secret,
            @Value("${fieldops.security.jwt.access-token-expiration-ms:900000}") long accessTokenExpirationMs,
            @Value("${fieldops.security.jwt.refresh-token-expiration-ms:604800000}") long refreshTokenExpirationMs
    ) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("A chave secreta JWT deve possuir pelo menos 256 bits (32 bytes).");
        }
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    /**
     * Gera um Access Token assinado de curta duração (padrão 15 minutos) com claims mínimas.
     */
    public String generateAccessToken(User user) {
        return buildSignedToken(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                TOKEN_TYPE_ACCESS,
                accessTokenExpirationMs
        );
    }

    /**
     * Gera um Refresh Token assinado de longa duração (padrão 7 dias) com identificador único (jti).
     */
    public String generateRefreshToken(User user) {
        return buildSignedToken(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                TOKEN_TYPE_REFRESH,
                refreshTokenExpirationMs
        );
    }

    /**
     * Gera um token assinado com tempo de expiração customizado (útil para testes de expiração).
     */
    public String generateTokenWithCustomExpiration(
            User user,
            String tokenType,
            long customExpirationMs
    ) {
        return buildSignedToken(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                tokenType,
                customExpirationMs
        );
    }

    private String buildSignedToken(
            UUID userId,
            String email,
            UserRole role,
            String tokenType,
            long ttlMs
    ) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusMillis(ttlMs);
        String jti = UUID.randomUUID().toString();

        String payloadJson = "{"
                + "\"sub\":\"" + escapeJson(userId.toString()) + "\","
                + "\"email\":\"" + escapeJson(email) + "\","
                + "\"role\":\"" + escapeJson(role.name()) + "\","
                + "\"type\":\"" + escapeJson(tokenType) + "\","
                + "\"jti\":\"" + escapeJson(jti) + "\","
                + "\"iat\":" + now.getEpochSecond() + ","
                + "\"exp\":" + expiresAt.getEpochSecond()
                + "}";

        String encodedPayload = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

        String signingInput = ENCODED_HEADER + "." + encodedPayload;
        String signature = signHmacSha256(signingInput);
        return signingInput + "." + signature;
    }

    /**
     * Valida estrutura, assinatura HMAC-SHA256 em tempo constante e expiração do token JWT.
     */
    public boolean validateToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        return claims != null;
    }

    /**
     * Valida se o token é íntegro, não expirado e do tipo ACCESS.
     */
    public boolean validateAccessToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null) {
            return false;
        }
        return TOKEN_TYPE_ACCESS.equals(claims.get("type"));
    }

    /**
     * Valida se o token é íntegro, não expirado e do tipo REFRESH.
     */
    public boolean validateRefreshToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null) {
            return false;
        }
        return TOKEN_TYPE_REFRESH.equals(claims.get("type"));
    }

    public UUID getUserIdFromToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null || !claims.containsKey("sub")) {
            throw new IllegalArgumentException("Token JWT inválido ou sem claim 'sub'.");
        }
        return UUID.fromString(claims.get("sub"));
    }

    public String getEmailFromToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null || !claims.containsKey("email")) {
            throw new IllegalArgumentException("Token JWT inválido ou sem claim 'email'.");
        }
        return claims.get("email");
    }

    public UserRole getRoleFromToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null || !claims.containsKey("role")) {
            throw new IllegalArgumentException("Token JWT inválido ou sem claim 'role'.");
        }
        return UserRole.valueOf(claims.get("role"));
    }

    public Instant getExpirationFromToken(String token) {
        Map<String, String> claims = parseVerifiedClaims(token);
        if (claims == null || !claims.containsKey("exp")) {
            throw new IllegalArgumentException("Token JWT inválido ou sem claim 'exp'.");
        }
        return Instant.ofEpochSecond(Long.parseLong(claims.get("exp")));
    }

    public long getAccessTokenExpirationMs() {
        return accessTokenExpirationMs;
    }

    public long getRefreshTokenExpirationMs() {
        return refreshTokenExpirationMs;
    }

    private Map<String, String> parseVerifiedClaims(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return null;
        }

        try {
            String signingInput = parts[0] + "." + parts[1];
            String expectedSignature = signHmacSha256(signingInput);
            boolean signatureValid = MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    parts[2].getBytes(StandardCharsets.UTF_8)
            );
            if (!signatureValid) {
                return null;
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            String payloadJson = new String(payloadBytes, StandardCharsets.UTF_8);

            Map<String, String> claims = new LinkedHashMap<>();
            Matcher stringMatcher = STRING_CLAIM_PATTERN.matcher(payloadJson);
            while (stringMatcher.find()) {
                claims.put(stringMatcher.group(1), stringMatcher.group(2));
            }
            Matcher numberMatcher = NUMBER_CLAIM_PATTERN.matcher(payloadJson);
            while (numberMatcher.find()) {
                claims.putIfAbsent(numberMatcher.group(1), numberMatcher.group(2));
            }

            String expStr = claims.get("exp");
            if (expStr == null) {
                return null;
            }
            long expEpochSeconds = Long.parseLong(expStr);
            if (Instant.now().getEpochSecond() >= expEpochSeconds) {
                return null;
            }

            return claims;
        } catch (Exception ex) {
            return null;
        }
    }

    private String signHmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            SecretKeySpec keySpec = new SecretKeySpec(secretBytes, HMAC_ALGO);
            mac.init(keySpec);
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
        } catch (Exception ex) {
            throw new IllegalStateException("Falha ao assinar token JWT com HmacSHA256", ex);
        }
    }

    private String escapeJson(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}

