package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.MasterStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload de entrada para cadastro ou atualização de Cliente (RT-02, RT-03).
 */
@Schema(description = "Dados de entrada para criação ou atualização de cliente")
public record ClientRequest(
        @Schema(description = "Código identificador interno opcional do cliente", example = "CLI-001")
        @Size(min = 2, max = 50, message = "O código do cliente deve ter entre 2 e 50 caracteres.")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "O código do cliente aceita apenas letras, números, ponto, hífen e sublinhado.")
        String code,

        @Schema(description = "Nome de exibição do cliente", example = "Indústria Alfa")
        @NotBlank(message = "O nome do cliente é obrigatório.")
        @Size(min = 2, max = 150, message = "O nome do cliente deve ter entre 2 e 150 caracteres.")
        String name,

        @Schema(description = "Razão social do cliente", example = "Indústria Alfa S.A.")
        @Size(max = 200, message = "A razão social deve ter no máximo 200 caracteres.")
        String legalName,

        @Schema(description = "CPF ou CNPJ do cliente", example = "12.345.678/0001-90")
        @Size(max = 32, message = "O documento deve ter no máximo 32 caracteres.")
        @Pattern(regexp = "^[0-9./-]{11,20}$", message = "O documento informado possui formato inválido.")
        String document,

        @Schema(description = "E-mail de contato do cliente", example = "contato@alfa.com.br")
        @Email(message = "O e-mail do cliente é inválido.")
        @Size(max = 255, message = "O e-mail deve ter no máximo 255 caracteres.")
        String email,

        @Schema(description = "Telefone de contato", example = "+551133334444")
        @Size(max = 32, message = "O telefone deve ter no máximo 32 caracteres.")
        @Pattern(regexp = "^\\+?[0-9()\\s-]{8,20}$", message = "O telefone informado possui formato inválido.")
        String phone,

        @Schema(description = "Situação cadastral do cliente (padrão ACTIVE)")
        MasterStatus status
) {
}

