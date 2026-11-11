package com.fieldops.security.logging;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.util.regex.Pattern;

/**
 * Conversor de mensagens Logback para sanitização e mascaramento automático de dados sensíveis (TASK-005 Passo 5).
 * Garante que senhas, tokens JWT, refresh tokens, cabeçalhos Authorization e números de cartão
 * nunca sejam gravados em texto claro nos logs (RN-007, RT-01, DoD 18.4).
 */
public class SensitiveDataMaskingConverter extends MessageConverter {

    private static final Pattern JSON_SENSITIVE_FIELD_PATTERN = Pattern.compile(
            "(?i)(\"(?:password|senha|passwordHash|password_hash|accessToken|access_token|refreshToken|refresh_token|token|secret|cardNumber|card_number|cvv)\"\\s*:\\s*\")([^\"]*)(\")"
    );

    private static final Pattern KEY_VALUE_SENSITIVE_PATTERN = Pattern.compile(
            "(?i)\\b(password|senha|passwordHash|accessToken|access_token|refreshToken|refresh_token|token|secret|cardNumber|cvv)\\s*=\\s*([^,\\s}\\]]+)"
    );

    private static final Pattern BEARER_TOKEN_PATTERN = Pattern.compile(
            "(?i)(Bearer\\s+)[A-Za-z0-9._~+/-]+=*"
    );

    private static final Pattern RAW_JWT_PATTERN = Pattern.compile(
            "\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b"
    );

    private static final Pattern CREDIT_CARD_PATTERN = Pattern.compile(
            "\\b(?:\\d[ -]*?){13,19}\\b"
    );

    @Override
    public String convert(ILoggingEvent event) {
        String originalMessage = super.convert(event);
        return maskSensitiveData(originalMessage);
    }

    /**
     * Sanitiza qualquer string mascarando credenciais, tokens JWT e dados de cartão.
     */
    public static String maskSensitiveData(String message) {
        if (message == null || message.isEmpty()) {
            return message;
        }

        String sanitized = JSON_SENSITIVE_FIELD_PATTERN.matcher(message).replaceAll("$1[REDACTED]$3");
        sanitized = KEY_VALUE_SENSITIVE_PATTERN.matcher(sanitized).replaceAll("$1=[REDACTED]");
        sanitized = BEARER_TOKEN_PATTERN.matcher(sanitized).replaceAll("$1[REDACTED]");
        sanitized = RAW_JWT_PATTERN.matcher(sanitized).replaceAll("[REDACTED_JWT]");
        sanitized = CREDIT_CARD_PATTERN.matcher(sanitized).replaceAll("[REDACTED_CARD]");
        return sanitized;
    }
}

