package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.MasterStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO de saída de Cliente (RT-02).
 */
@Schema(description = "Dados de resposta de cliente cadastrado")
public record ClientResponse(
        UUID id,
        String code,
        String name,
        String legalName,
        String document,
        String email,
        String phone,
        MasterStatus status,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static ClientResponse fromEntity(Client client) {
        return new ClientResponse(
                client.getId(),
                client.getCode(),
                client.getName(),
                client.getLegalName(),
                client.getDocument(),
                client.getEmail(),
                client.getPhone(),
                client.getStatus(),
                client.isActive(),
                client.getCreatedAt(),
                client.getUpdatedAt(),
                client.getVersion()
        );
    }
}

