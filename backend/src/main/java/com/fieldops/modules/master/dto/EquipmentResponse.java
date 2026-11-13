package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.EquipmentStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * DTO de saída de Equipamento (RT-02).
 */
@Schema(description = "Dados de resposta de equipamento cadastrado")
public record EquipmentResponse(
        UUID id,
        UUID siteId,
        String siteName,
        UUID clientId,
        String clientName,
        String code,
        String name,
        String assetNumber,
        String serialNumber,
        String manufacturer,
        String model,
        String description,
        String qrCode,
        EquipmentStatus status,
        boolean active,
        LocalDate installedAt,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static EquipmentResponse fromEntity(Equipment equipment) {
        return new EquipmentResponse(
                equipment.getId(),
                equipment.getSite().getId(),
                equipment.getSite().getName(),
                equipment.getSite().getClient().getId(),
                equipment.getSite().getClient().getName(),
                equipment.getCode(),
                equipment.getName(),
                equipment.getAssetNumber(),
                equipment.getSerialNumber(),
                equipment.getManufacturer(),
                equipment.getModel(),
                equipment.getDescription(),
                equipment.getQrCode(),
                equipment.getStatus(),
                equipment.isActive(),
                equipment.getInstalledAt(),
                equipment.getCreatedAt(),
                equipment.getUpdatedAt(),
                equipment.getVersion()
        );
    }
}

