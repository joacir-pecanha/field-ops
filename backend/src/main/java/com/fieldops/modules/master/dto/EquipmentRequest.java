package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.EquipmentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Payload de entrada para cadastro ou atualização de Equipamento (RT-02, RT-03, RN-010, RN-011).
 */
@Schema(description = "Dados de entrada para criação ou atualização de equipamento")
public record EquipmentRequest(
        @Schema(description = "Identificador UUID do local ao qual o equipamento pertence (obrigatório - RN-010)")
        @NotNull(message = "O local (siteId) do equipamento é obrigatório.")
        UUID siteId,

        @Schema(description = "Código operacional opcional do equipamento", example = "EQP-GD-001")
        @Size(min = 2, max = 50, message = "O código do equipamento deve ter entre 2 e 50 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "O código do equipamento aceita apenas letras, números, ponto, hífen e sublinhado.")
        String code,

        @Schema(description = "Nome do equipamento", example = "Gerador Diesel GD-001")
        @NotBlank(message = "O nome do equipamento é obrigatório.")
        @Size(min = 2, max = 150, message = "O nome do equipamento deve ter entre 2 e 150 caracteres.")
        String name,

        @Schema(description = "Número patrimonial opcional", example = "PAT-2026-0091")
        @Size(max = 80, message = "O número patrimonial deve ter no máximo 80 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "O número patrimonial aceita apenas letras, números, ponto, hífen e sublinhado.")
        String assetNumber,

        @Schema(description = "Número de série opcional", example = "SN-99887766")
        @Size(max = 100, message = "O número de série deve ter no máximo 100 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "O número de série aceita apenas letras, números, ponto, hífen e sublinhado.")
        String serialNumber,

        @Schema(description = "Fabricante opcional", example = "Caterpillar")
        @Size(max = 120, message = "O fabricante deve ter no máximo 120 caracteres.")
        String manufacturer,

        @Schema(description = "Modelo opcional", example = "C15-500kVA")
        @Size(max = 120, message = "O modelo deve ter no máximo 120 caracteres.")
        String model,

        @Schema(description = "Descrição complementar do equipamento")
        @Size(max = 500, message = "A descrição deve ter no máximo 500 caracteres.")
        String description,

        @Schema(description = "Código QR único do equipamento (RN-011)", example = "QR-FIELDOPS-GD001")
        @NotBlank(message = "O QR Code do equipamento é obrigatório.")
        @Size(min = 3, max = 120, message = "O QR Code deve ter entre 3 e 120 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._:-]+$", message = "O QR Code deve conter apenas caracteres alfanuméricos, '.', '_', ':' ou '-'.")
        String qrCode,

        @Schema(description = "Situação cadastral do equipamento (padrão ACTIVE)")
        EquipmentStatus status,

        @Schema(description = "Data de instalação opcional (YYYY-MM-DD)", example = "2026-01-15")
        LocalDate installedAt
) {
}

