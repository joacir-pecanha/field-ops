package com.fieldops.modules.template.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entidade JPA que representa uma versão (rascunho ou publicada imutável) de um modelo de inspeção
 * (docs/modelo-de-dados.md 10.7.2).
 */
@Entity
@Table(
    name = "template_versions",
    indexes = {
        @Index(name = "idx_template_versions_template_id", columnList = "template_id"),
        @Index(name = "idx_template_versions_status", columnList = "status"),
        @Index(name = "idx_template_versions_active_new", columnList = "active_for_new_inspections")
    }
)
public class TemplateVersion {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private InspectionTemplate template;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private TemplateVersionStatus status = TemplateVersionStatus.DRAFT;

    @Column(name = "title_snapshot", nullable = false, length = 200)
    private String titleSnapshot;

    @Column(name = "description_snapshot", length = 1000)
    private String descriptionSnapshot;

    @Column(name = "category_snapshot", nullable = false, length = 100)
    private String categorySnapshot;

    @Column(name = "published_by")
    private UUID publishedBy;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "active_for_new_inspections", nullable = false)
    private boolean activeForNewInspections = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "templateVersion", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orderIndex ASC")
    private List<TemplateSection> sections = new ArrayList<>();

    public TemplateVersion() {
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
            this.status = TemplateVersionStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public boolean isPublished() {
        return this.status == TemplateVersionStatus.PUBLISHED;
    }

    public void addSection(TemplateSection section) {
        section.setTemplateVersion(this);
        this.sections.add(section);
    }

    public void clearAndSetSections(List<TemplateSection> newSections) {
        this.sections.clear();
        if (newSections != null) {
            for (TemplateSection section : newSections) {
                addSection(section);
            }
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public InspectionTemplate getTemplate() {
        return template;
    }

    public void setTemplate(InspectionTemplate template) {
        this.template = template;
    }

    public Integer getVersionNumber() {
        return versionNumber;
    }

    public void setVersionNumber(Integer versionNumber) {
        this.versionNumber = versionNumber;
    }

    public TemplateVersionStatus getStatus() {
        return status;
    }

    public void setStatus(TemplateVersionStatus status) {
        this.status = status;
    }

    public String getTitleSnapshot() {
        return titleSnapshot;
    }

    public void setTitleSnapshot(String titleSnapshot) {
        this.titleSnapshot = titleSnapshot;
    }

    public String getDescriptionSnapshot() {
        return descriptionSnapshot;
    }

    public void setDescriptionSnapshot(String descriptionSnapshot) {
        this.descriptionSnapshot = descriptionSnapshot;
    }

    public String getCategorySnapshot() {
        return categorySnapshot;
    }

    public void setCategorySnapshot(String categorySnapshot) {
        this.categorySnapshot = categorySnapshot;
    }

    public UUID getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(UUID publishedBy) {
        this.publishedBy = publishedBy;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public boolean isActiveForNewInspections() {
        return activeForNewInspections;
    }

    public void setActiveForNewInspections(boolean activeForNewInspections) {
        this.activeForNewInspections = activeForNewInspections;
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

    public List<TemplateSection> getSections() {
        return sections;
    }

    public void setSections(List<TemplateSection> sections) {
        this.sections = sections;
    }
}

