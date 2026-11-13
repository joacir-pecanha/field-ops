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

import java.math.BigDecimal;

/**
 * Entidade JPA que representa um Local de Inspeção pertencente a um Cliente (docs/modelo-de-dados.md 10.5.2).
 * RN-009: Todo local deve pertencer a um cliente.
 */
@Entity
@Table(
    name = "sites",
    indexes = {
        @Index(name = "idx_sites_client_id", columnList = "client_id"),
        @Index(name = "idx_sites_name", columnList = "name"),
        @Index(name = "idx_sites_code", columnList = "code"),
        @Index(name = "idx_sites_city", columnList = "city"),
        @Index(name = "idx_sites_status", columnList = "status"),
        @Index(name = "idx_sites_active", columnList = "active")
    }
)
public class Site extends AuditableMasterEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "code", length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "address_line", length = 255)
    private String addressLine;

    @Column(name = "city", length = 120)
    private String city;

    @Column(name = "state", length = 32)
    private String state;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "contact_name", length = 150)
    private String contactName;

    @Column(name = "contact_phone", length = 32)
    private String contactPhone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private MasterStatus status = MasterStatus.ACTIVE;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public Site() {
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
            this.status = this.active ? MasterStatus.ACTIVE : MasterStatus.INACTIVE;
        }
        this.active = this.status == MasterStatus.ACTIVE;
        if (this.state != null) {
            this.state = this.state.trim().toUpperCase();
        }
    }

    public void activate() {
        this.status = MasterStatus.ACTIVE;
        this.active = true;
    }

    public void deactivate() {
        this.status = MasterStatus.INACTIVE;
        this.active = false;
    }

    public Client getClient() {
        return client;
    }

    public void setClient(Client client) {
        this.client = client;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state != null ? state.trim().toUpperCase() : null;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public String getContactName() {
        return contactName;
    }

    public void setContactName(String contactName) {
        this.contactName = contactName;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
    }

    public MasterStatus getStatus() {
        return status;
    }

    public void setStatus(MasterStatus status) {
        this.status = status != null ? status : MasterStatus.ACTIVE;
        this.active = this.status == MasterStatus.ACTIVE;
    }

    public boolean isActive() {
        return active && status == MasterStatus.ACTIVE;
    }

    public void setActive(boolean active) {
        this.active = active;
        this.status = active ? MasterStatus.ACTIVE : MasterStatus.INACTIVE;
    }
}

