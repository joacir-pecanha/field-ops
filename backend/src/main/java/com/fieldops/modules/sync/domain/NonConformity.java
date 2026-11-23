package com.fieldops.modules.sync.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * Entidade JPA de Não Conformidades sincronizadas pelo aplicativo móvel (10.10.1).
 */
@Entity
@Table(
    name = "non_conformities",
    indexes = {
        @Index(name = "idx_non_conformities_inspection_id", columnList = "inspection_id"),
        @Index(name = "idx_non_conformities_item_id", columnList = "inspection_item_id"),
        @Index(name = "idx_non_conformities_response_id", columnList = "response_id"),
        @Index(name = "idx_non_conformities_severity", columnList = "severity"),
        @Index(name = "idx_non_conformities_status", columnList = "status")
    }
)
public class NonConformity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "inspection_id", nullable = false)
    private UUID inspectionId;

    @Column(name = "inspection_item_id")
    private UUID inspectionItemId;

    @Column(name = "response_id")
    private UUID responseId;

    @Column(name = "item_title", length = 300)
    private String itemTitle;

    @Column(name = "title", nullable = false, length = 250)
    private String title;

    @Column(name = "description", nullable = false, length = 2000)
    private String description = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 32)
    private NonConformitySeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private NonConformityStatus status = NonConformityStatus.OPEN;

    @Column(name = "canceled_reason", length = 1000)
    private String canceledReason;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at_device")
    private Instant createdAtDevice;

    @Column(name = "server_received_at", nullable = false)
    private Instant serverReceivedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    public NonConformity() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.description == null) {
            this.description = "";
        }
        if (this.status == null) {
            this.status = NonConformityStatus.OPEN;
        }
        Instant now = Instant.now();
        if (this.serverReceivedAt == null) {
            this.serverReceivedAt = now;
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
        if (this.version == null) {
            this.version = 0;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(UUID inspectionId) {
        this.inspectionId = inspectionId;
    }

    public UUID getInspectionItemId() {
        return inspectionItemId;
    }

    public void setInspectionItemId(UUID inspectionItemId) {
        this.inspectionItemId = inspectionItemId;
    }

    public UUID getResponseId() {
        return responseId;
    }

    public void setResponseId(UUID responseId) {
        this.responseId = responseId;
    }

    public String getItemTitle() {
        return itemTitle;
    }

    public void setItemTitle(String itemTitle) {
        this.itemTitle = itemTitle;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description != null ? description : "";
    }

    public NonConformitySeverity getSeverity() {
        return severity;
    }

    public void setSeverity(NonConformitySeverity severity) {
        this.severity = severity;
    }

    public NonConformityStatus getStatus() {
        return status;
    }

    public void setStatus(NonConformityStatus status) {
        this.status = status;
    }

    public String getCanceledReason() {
        return canceledReason;
    }

    public void setCanceledReason(String canceledReason) {
        this.canceledReason = canceledReason;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAtDevice() {
        return createdAtDevice;
    }

    public void setCreatedAtDevice(Instant createdAtDevice) {
        this.createdAtDevice = createdAtDevice;
    }

    public Instant getServerReceivedAt() {
        return serverReceivedAt;
    }

    public void setServerReceivedAt(Instant serverReceivedAt) {
        this.serverReceivedAt = serverReceivedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }
}
