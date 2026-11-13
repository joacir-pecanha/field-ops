package com.fieldops.modules.template.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entidade JPA que organiza os itens do checklist em seções ordenadas (docs/modelo-de-dados.md 10.7.3).
 */
@Entity
@Table(
    name = "template_sections",
    indexes = {
        @Index(name = "idx_template_sections_version_id", columnList = "template_version_id"),
        @Index(name = "idx_template_sections_version_order", columnList = "template_version_id, order_index")
    }
)
public class TemplateSection {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false)
    private TemplateVersion templateVersion;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "section", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orderIndex ASC")
    private List<TemplateItem> items = new ArrayList<>();

    public TemplateSection() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.orderIndex == null) {
            this.orderIndex = 0;
        }
    }

    public void addItem(TemplateItem item) {
        item.setSection(this);
        this.items.add(item);
    }

    public void clearAndSetItems(List<TemplateItem> newItems) {
        this.items.clear();
        if (newItems != null) {
            for (TemplateItem item : newItems) {
                addItem(item);
            }
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    public void setTemplateVersion(TemplateVersion templateVersion) {
        this.templateVersion = templateVersion;
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

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public List<TemplateItem> getItems() {
        return items;
    }

    public void setItems(List<TemplateItem> items) {
        this.items = items;
    }
}

