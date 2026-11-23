package com.fieldops.modules.sync.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Entidade JPA que representa a resposta sincronizada de um item do snapshot da inspeção (10.8.4).
 */
@Entity
@Table(
    name = "inspection_responses",
    indexes = {
        @Index(name = "idx_inspection_responses_inspection_id", columnList = "inspection_id"),
        @Index(name = "idx_inspection_responses_answered_by", columnList = "answered_by")
    }
)
public class InspectionResponse {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "inspection_id", nullable = false)
    private UUID inspectionId;

    @Column(name = "inspection_item_id", nullable = false, unique = true)
    private UUID inspectionItemId;

    @Column(name = "value_raw", columnDefinition = "text")
    private String valueRaw;

    @Column(name = "value_text", columnDefinition = "text")
    private String valueText;

    @Column(name = "value_number", precision = 19, scale = 4)
    private BigDecimal valueNumber;

    @Column(name = "value_boolean")
    private Boolean valueBoolean;

    @Column(name = "value_date")
    private LocalDate valueDate;

    @Column(name = "value_json", columnDefinition = "text")
    private String valueJson;

    @Column(name = "observation", length = 2000)
    private String observation;

    @Column(name = "conformity", length = 32)
    private String conformity;

    @Column(name = "is_non_conformity", nullable = false)
    private boolean nonConformity = false;

    @Column(name = "non_conformity_description", length = 2000)
    private String nonConformityDescription;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "accuracy", precision = 10, scale = 2)
    private BigDecimal accuracy;

    @Column(name = "answered_by")
    private UUID answeredBy;

    @Column(name = "answered_at_device")
    private Instant answeredAtDevice;

    @Column(name = "server_received_at", nullable = false)
    private Instant serverReceivedAt;

    @Column(name = "is_admin_adjusted", nullable = false)
    private boolean adminAdjusted = false;

    @Column(name = "admin_adjusted_value", columnDefinition = "text")
    private String adminAdjustedValue;

    @Column(name = "admin_adjustment_reason", length = 1000)
    private String adminAdjustmentReason;

    @Column(name = "admin_adjusted_by")
    private UUID adminAdjustedBy;

    @Column(name = "admin_adjusted_at")
    private Instant adminAdjustedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    public InspectionResponse() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
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

    public String getValueRaw() {
        return valueRaw;
    }

    public void setValueRaw(String valueRaw) {
        this.valueRaw = valueRaw;
    }

    public String getValueText() {
        return valueText;
    }

    public void setValueText(String valueText) {
        this.valueText = valueText;
    }

    public BigDecimal getValueNumber() {
        return valueNumber;
    }

    public void setValueNumber(BigDecimal valueNumber) {
        this.valueNumber = valueNumber;
    }

    public Boolean getValueBoolean() {
        return valueBoolean;
    }

    public void setValueBoolean(Boolean valueBoolean) {
        this.valueBoolean = valueBoolean;
    }

    public LocalDate getValueDate() {
        return valueDate;
    }

    public void setValueDate(LocalDate valueDate) {
        this.valueDate = valueDate;
    }

    public String getValueJson() {
        return valueJson;
    }

    public void setValueJson(String valueJson) {
        this.valueJson = valueJson;
    }

    public String getObservation() {
        return observation;
    }

    public void setObservation(String observation) {
        this.observation = observation;
    }

    public String getConformity() {
        return conformity;
    }

    public void setConformity(String conformity) {
        this.conformity = conformity;
    }

    public boolean isNonConformity() {
        return nonConformity;
    }

    public void setNonConformity(boolean nonConformity) {
        this.nonConformity = nonConformity;
    }

    public String getNonConformityDescription() {
        return nonConformityDescription;
    }

    public void setNonConformityDescription(String nonConformityDescription) {
        this.nonConformityDescription = nonConformityDescription;
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

    public BigDecimal getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(BigDecimal accuracy) {
        this.accuracy = accuracy;
    }

    public UUID getAnsweredBy() {
        return answeredBy;
    }

    public void setAnsweredBy(UUID answeredBy) {
        this.answeredBy = answeredBy;
    }

    public Instant getAnsweredAtDevice() {
        return answeredAtDevice;
    }

    public void setAnsweredAtDevice(Instant answeredAtDevice) {
        this.answeredAtDevice = answeredAtDevice;
    }

    public Instant getServerReceivedAt() {
        return serverReceivedAt;
    }

    public void setServerReceivedAt(Instant serverReceivedAt) {
        this.serverReceivedAt = serverReceivedAt;
    }

    public boolean isAdminAdjusted() {
        return adminAdjusted;
    }

    public void setAdminAdjusted(boolean adminAdjusted) {
        this.adminAdjusted = adminAdjusted;
    }

    public String getAdminAdjustedValue() {
        return adminAdjustedValue;
    }

    public void setAdminAdjustedValue(String adminAdjustedValue) {
        this.adminAdjustedValue = adminAdjustedValue;
    }

    public String getAdminAdjustmentReason() {
        return adminAdjustmentReason;
    }

    public void setAdminAdjustmentReason(String adminAdjustmentReason) {
        this.adminAdjustmentReason = adminAdjustmentReason;
    }

    public UUID getAdminAdjustedBy() {
        return adminAdjustedBy;
    }

    public void setAdminAdjustedBy(UUID adminAdjustedBy) {
        this.adminAdjustedBy = adminAdjustedBy;
    }

    public Instant getAdminAdjustedAt() {
        return adminAdjustedAt;
    }

    public void setAdminAdjustedAt(Instant adminAdjustedAt) {
        this.adminAdjustedAt = adminAdjustedAt;
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
