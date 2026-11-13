package com.fieldops.modules.template.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entidade mestre que representa a identidade lógica de um modelo de inspeção (docs/modelo-de-dados.md 10.7.1).
 */
@Entity
@Table(
    name = "inspection_templates",
    indexes = {
        @Index(name = "idx_inspection_templates_title", columnList = "title"),
        @Index(name = "idx_inspection_templates_category", columnList = "category"),
        @Index(name = "idx_inspection_templates_status", columnList = "status"),
        @Index(name = "idx_inspection_templates_active", columnList = "active")
    }
)
public class InspectionTemplate {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", unique = true, length = 60)
    private String code;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "category", nullable = false, length = 100)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private TemplateStatus status = TemplateStatus.DRAFT;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "version", nullable = false)
    private Integer version = 0;

    @Column(name = "current_version", nullable = false)
    private Integer currentVersion = 0;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private Integer lockVersion = 0;

    @OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("versionNumber ASC")
    private List<TemplateVersion> versions = new ArrayList<>();

    public InspectionTemplate() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
        if (this.status == null) {
            this.status = TemplateStatus.DRAFT;
        }
        if (this.version == null) {
            this.version = 0;
        }
        if (this.currentVersion == null) {
            this.currentVersion = 0;
        }
        if (this.lockVersion == null) {
            this.lockVersion = 0;
        }
        this.active = this.status != TemplateStatus.INACTIVE;
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = Instant.now();
        this.active = this.status != TemplateStatus.INACTIVE;
    }

    public void addVersion(TemplateVersion templateVersion) {
        templateVersion.setTemplate(this);
        this.versions.add(templateVersion);
    }

    public void deactivate() {
        this.status = TemplateStatus.INACTIVE;
        this.active = false;
    }

    public void activate() {
        this.status = (this.currentVersion != null && this.currentVersion > 0)
                ? TemplateStatus.PUBLISHED
                : TemplateStatus.DRAFT;
        this.active = true;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
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
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public TemplateStatus getStatus() {
        return status;
    }

    public void setStatus(TemplateStatus status) {
        this.status = status != null ? status : TemplateStatus.DRAFT;
        this.active = this.status != TemplateStatus.INACTIVE;
    }

    public boolean isActive() {
        return active && status != TemplateStatus.INACTIVE;
    }

    public void setActive(boolean active) {
        this.active = active;
        if (!active) {
            this.status = TemplateStatus.INACTIVE;
        }
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Integer getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(Integer currentVersion) {
        this.currentVersion = currentVersion;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
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

    public Integer getLockVersion() {
        return lockVersion;
    }

    public void setLockVersion(Integer lockVersion) {
        this.lockVersion = lockVersion;
    }

    public List<TemplateVersion> getVersions() {
        return versions;
    }

    public void setVersions(List<TemplateVersion> versions) {
        this.versions = versions;
    }
}

