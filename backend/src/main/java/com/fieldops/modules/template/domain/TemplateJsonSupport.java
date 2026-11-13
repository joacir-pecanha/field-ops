package com.fieldops.modules.template.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * Utilitário simples e seguro para serialização e parsing JSON sem acoplamento de versão do Jackson.
 */
public final class TemplateJsonSupport {

    private TemplateJsonSupport() {
    }

    public static String toJsonStringArray(List<String> values) {
        if (values == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"').append(escapeJsonString(values.get(i))).append('"');
        }
        sb.append(']');
        return sb.toString();
    }

    public static List<String> parseJsonStringArray(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        String trimmed = json.trim();
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
            throw new IllegalArgumentException("optionsJson deve ser um array JSON de strings (ex.: [\"Sim\", \"Não\"]).");
        }
        String inner = trimmed.substring(1, trimmed.length() - 1).trim();
        if (inner.isEmpty()) {
            return List.of();
        }

        List<String> result = new ArrayList<>();
        int index = 0;
        int length = inner.length();
        while (index < length) {
            while (index < length && Character.isWhitespace(inner.charAt(index))) {
                index++;
            }
            if (index >= length) {
                break;
            }
            if (inner.charAt(index) != '"') {
                throw new IllegalArgumentException("Cada item de optionsJson deve ser uma string JSON válida.");
            }
            index++; // pula aspa de abertura
            StringBuilder token = new StringBuilder();
            boolean closed = false;
            while (index < length) {
                char c = inner.charAt(index++);
                if (c == '\\') {
                    if (index >= length) {
                        throw new IllegalArgumentException("Escape JSON inválido em optionsJson.");
                    }
                    char escaped = inner.charAt(index++);
                    switch (escaped) {
                        case '"', '\\', '/' -> token.append(escaped);
                        case 'b' -> token.append('\b');
                        case 'f' -> token.append('\f');
                        case 'n' -> token.append('\n');
                        case 'r' -> token.append('\r');
                        case 't' -> token.append('\t');
                        case 'u' -> {
                            if (index + 4 > length) {
                                throw new IllegalArgumentException("Sequência Unicode inválida em optionsJson.");
                            }
                            String hex = inner.substring(index, index + 4);
                            token.append((char) Integer.parseInt(hex, 16));
                            index += 4;
                        }
                        default -> throw new IllegalArgumentException("Caractere de escape inválido em optionsJson: \\" + escaped);
                    }
                } else if (c == '"') {
                    closed = true;
                    break;
                } else {
                    token.append(c);
                }
            }
            if (!closed) {
                throw new IllegalArgumentException("String não finalizada em optionsJson.");
            }
            String value = token.toString().trim();
            if (!value.isEmpty()) {
                result.add(value);
            }
            while (index < length && Character.isWhitespace(inner.charAt(index))) {
                index++;
            }
            if (index < length) {
                if (inner.charAt(index) != ',') {
                    throw new IllegalArgumentException("Separador ',' esperado em optionsJson.");
                }
                index++;
            }
        }
        return result;
    }

    public static String buildRulesJson(
            boolean observationRequiredOnFailure,
            boolean evidenceRequiredOnFailure
    ) {
        return "{\"observationRequiredOnFailure\":" + observationRequiredOnFailure
                + ",\"evidenceRequiredOnFailure\":" + evidenceRequiredOnFailure + "}";
    }

    private static String escapeJsonString(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }
}

