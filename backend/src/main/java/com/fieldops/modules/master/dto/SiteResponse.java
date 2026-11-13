package com.fieldops.modules.master.dto;

import com.fieldops.modules.master.domain.MasterStatus;
import com.fieldops.modules.master.domain.Site;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO de saída de Local de Inspeção (RT-02).
 */
@Schema(description = "Dados de resposta de local de inspeção cadastrado")
public record SiteResponse(
        UUID id,
        UUID clientId,
        String clientName,
        String code,
        String name,
        String description,
        String addressLine,
        String city,
        String state,
        String postalCode,
        BigDecimal latitude,
        BigDecimal longitude,
        String contactName,
        String contactPhone,
        MasterStatus status,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        Integer version
) {
    public static SiteResponse fromEntity(Site site) {
        return new SiteResponse(
                site.getId(),
                site.getClient().getId(),
                site.getClient().getName(),
                site.getCode(),
                site.getName(),
                site.getDescription(),
                site.getAddressLine(),
                site.getCity(),
                site.getState(),
                site.getPostalCode(),
                site.getLatitude(),
                site.getLongitude(),
                site.getContactName(),
                site.getContactPhone(),
                site.getStatus(),
                site.isActive(),
                site.getCreatedAt(),
                site.getUpdatedAt(),
                site.getVersion()
        );
    }
}

