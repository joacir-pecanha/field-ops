package com.fieldops.modules.template.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Entidade JPA que representa um item individual de pergunta/verificação do checklist (docs/modelo-de-dados.md 10.7.4).
 */
@Entity
@Table(
    name = "template_items",
    indexes = {
        @Index(name = "idx_template_items_section_id", columnList = "section_id"),
        @Index(name = "idx_template_items_section_order", columnList = "section_id, order_index")
    }
)
public class TemplateItem {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "section_id", nullable = false)
    private TemplateSection section;

    @Column(name = "code", length = 60)
    private String code;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "response_type", length = 32)
    private ResponseType responseType;

    @Column(name = "required", nullable = false)
    private boolean required = true;

    @Column(name = "observation_required_on_failure", nullable = false)
    private boolean observationRequiredOnFailure = false;

    @Column(name = "evidence_required_on_failure", nullable = false)
    private boolean evidenceRequiredOnFailure = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options_json", columnDefinition = "jsonb")
    private List<String> options;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public TemplateItem() {
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

    public String getOptionsJson() {
        return TemplateJsonSupport.toJsonStringArray(this.options);
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public TemplateSection getSection() {
        return section;
    }

    public void setSection(TemplateSection section) {
        this.section = section;
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

    public ResponseType getResponseType() {
        return responseType;
    }

    public void setResponseType(ResponseType responseType) {
        this.responseType = responseType;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public boolean isObservationRequiredOnFailure() {
        return observationRequiredOnFailure;
    }

    public void setObservationRequiredOnFailure(boolean observationRequiredOnFailure) {
        this.observationRequiredOnFailure = observationRequiredOnFailure;
    }

    public boolean isEvidenceRequiredOnFailure() {
        return evidenceRequiredOnFailure;
    }

    public void setEvidenceRequiredOnFailure(boolean evidenceRequiredOnFailure) {
        this.evidenceRequiredOnFailure = evidenceRequiredOnFailure;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
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
}

