package com.fieldops.modules.master.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

/**
 * Entidade JPA que representa um Equipamento físico vinculado a um Local (docs/modelo-de-dados.md 10.5.3).
 * RN-010: Todo equipamento deve pertencer a um local no MVP.
 * RN-011: O QR Code do equipamento deve ser único no sistema.
 */
@Entity
@Table(
    name = "equipments",
    indexes = {
        @Index(name = "idx_equipments_site_id", columnList = "site_id"),
        @Index(name = "idx_equipments_name", columnList = "name"),
        @Index(name = "idx_equipments_code", columnList = "code"),
        @Index(name = "idx_equipments_asset_number", columnList = "asset_number"),
        @Index(name = "idx_equipments_serial_number", columnList = "serial_number"),
        @Index(name = "idx_equipments_status", columnList = "status"),
        @Index(name = "idx_equipments_active", columnList = "active")
    }
)
public class Equipment extends AuditableMasterEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;

    @Column(name = "code", length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "asset_number", length = 80)
    private String assetNumber;

    @Column(name = "serial_number", length = 100)
    private String serialNumber;

    @Column(name = "manufacturer", length = 120)
    private String manufacturer;

    @Column(name = "model", length = 120)
    private String model;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "qr_code", nullable = false, unique = true, length = 120)
    private String qrCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private EquipmentStatus status = EquipmentStatus.ACTIVE;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "installed_at")
    private LocalDate installedAt;

    public Equipment() {
    }

    @Override
    protected void onBeforePersist() {
        syncState();
    }

    @Override
    protected void onBeforeUpdate() {
        syncState();
    }

    private void syncState() {
        if (this.status == null) {
            this.status = this.active ? EquipmentStatus.ACTIVE : EquipmentStatus.INACTIVE;
        }
        this.active = this.status == EquipmentStatus.ACTIVE;
        if (this.qrCode != null) {
            this.qrCode = this.qrCode.trim();
        }
    }

    public void activate() {
        this.status = EquipmentStatus.ACTIVE;
        this.active = true;
    }

    public void deactivate() {
        this.status = EquipmentStatus.INACTIVE;
        this.active = false;
    }

    public Site getSite() {
        return site;
    }

    public void setSite(Site site) {
        this.site = site;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAssetNumber() {
        return assetNumber;
    }

    public void setAssetNumber(String assetNumber) {
        this.assetNumber = assetNumber;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getQrCode() {
        return qrCode;
    }

    public void setQrCode(String qrCode) {
        this.qrCode = qrCode != null ? qrCode.trim() : null;
    }

    public EquipmentStatus getStatus() {
        return status;
    }

    public void setStatus(EquipmentStatus status) {
        this.status = status != null ? status : EquipmentStatus.ACTIVE;
        this.active = this.status == EquipmentStatus.ACTIVE;
    }

    public boolean isActive() {
        return active && status == EquipmentStatus.ACTIVE;
    }

    public void setActive(boolean active) {
        this.active = active;
        this.status = active ? EquipmentStatus.ACTIVE : EquipmentStatus.INACTIVE;
    }

    public LocalDate getInstalledAt() {
        return installedAt;
    }

    public void setInstalledAt(LocalDate installedAt) {
        this.installedAt = installedAt;
    }
}

