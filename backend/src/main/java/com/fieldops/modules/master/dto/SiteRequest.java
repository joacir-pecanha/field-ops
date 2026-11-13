package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.MasterStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Payload de entrada para cadastro ou atualização de Local de Inspeção (RT-02, RT-03, RN-009).
 */
@Schema(description = "Dados de entrada para criação ou atualização de local de inspeção")
public record SiteRequest(
        @Schema(description = "Identificador UUID do cliente proprietário (obrigatório - RN-009)")
        @NotNull(message = "O cliente proprietário (clientId) do local é obrigatório.")
        UUID clientId,

        @Schema(description = "Código identificador opcional do local", example = "SITE-SOR-01")
        @Size(min = 2, max = 50, message = "O código do local deve ter entre 2 e 50 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "O código do local aceita apenas letras, números, ponto, hífen e sublinhado.")
        String code,

        @Schema(description = "Nome da unidade ou local", example = "Unidade Sorocaba")
        @NotBlank(message = "O nome do local é obrigatório.")
        @Size(min = 2, max = 150, message = "O nome do local deve ter entre 2 e 150 caracteres.")
        String name,

        @Schema(description = "Descrição complementar do local")
        @Size(max = 500, message = "A descrição deve ter no máximo 500 caracteres.")
        String description,

        @Schema(description = "Logradouro e número", example = "Av. Industrial, 1200")
        @Size(max = 255, message = "O endereço deve ter no máximo 255 caracteres.")
        String addressLine,

        @Schema(description = "Cidade", example = "Sorocaba")
        @Size(max = 120, message = "A cidade deve ter no máximo 120 caracteres.")
        String city,

        @Schema(description = "Unidade federativa (2 letras)", example = "SP")
        @Pattern(regexp = "^[A-Za-z]{2}$", message = "O estado deve conter exatamente 2 letras (UF).")
        String state,

        @Schema(description = "CEP no formato 00000-000", example = "18010-000")
        @Pattern(regexp = "^\\d{5}-?\\d{3}$", message = "O CEP informado possui formato inválido.")
        String postalCode,

        @Schema(description = "Latitude opcional", example = "-23.5015300")
        @DecimalMin(value = "-90.0", message = "A latitude mínima permitida é -90.0.")
        @DecimalMax(value = "90.0", message = "A latitude máxima permitida é 90.0.")
        BigDecimal latitude,

        @Schema(description = "Longitude opcional", example = "-47.4525600")
        @DecimalMin(value = "-180.0", message = "A longitude mínima permitida é -180.0.")
        @DecimalMax(value = "180.0", message = "A longitude máxima permitida é 180.0.")
        BigDecimal longitude,

        @Schema(description = "Nome do responsável no local", example = "Marcos Silva")
        @Size(max = 150, message = "O nome do contato deve ter no máximo 150 caracteres.")
        String contactName,

        @Schema(description = "Telefone do responsável no local", example = "+5515999991111")
        @Size(max = 32, message = "O telefone de contato deve ter no máximo 32 caracteres.")
        @Pattern(regexp = "^\\+?[0-9()\\s-]{8,20}$", message = "O telefone de contato possui formato inválido.")
        String contactPhone,

        @Schema(description = "Situação cadastral do local (padrão ACTIVE)")
        MasterStatus status
) {
}

