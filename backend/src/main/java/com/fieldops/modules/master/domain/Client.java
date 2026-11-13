package com.fieldops.modules.master.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Entidade JPA que representa um Cliente atendido pela operação FieldOps (docs/modelo-de-dados.md 10.5.1).
 */
@Entity
@Table(
    name = "clients",
    indexes = {
        @Index(name = "idx_clients_name", columnList = "name"),
        @Index(name = "idx_clients_document", columnList = "document"),
        @Index(name = "idx_clients_status", columnList = "status"),
        @Index(name = "idx_clients_active", columnList = "active")
    }
)
public class Client extends AuditableMasterEntity {

    @Column(name = "code", unique = true, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "legal_name", length = 200)
    private String legalName;

    @Column(name = "document", length = 32)
    private String document;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "phone", length = 32)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private MasterStatus status = MasterStatus.ACTIVE;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    public Client() {
    }

    @Override
    protected void onBeforePersist() {
        syncActiveState();
    }

    @Override
    protected void onBeforeUpdate() {
        syncActiveState();
    }

    private void syncActiveState() {
        if (this.status == null) {
            this.status = this.active ? MasterStatus.ACTIVE : MasterStatus.INACTIVE;
        }
        this.active = this.status == MasterStatus.ACTIVE;
        if (this.email != null) {
            this.email = this.email.trim().toLowerCase();
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

    public String getLegalName() {
        return legalName;
    }

    public void setLegalName(String legalName) {
        this.legalName = legalName;
    }

    public String getDocument() {
        return document;
    }

    public void setDocument(String document) {
        this.document = document;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email != null ? email.trim().toLowerCase() : null;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
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

