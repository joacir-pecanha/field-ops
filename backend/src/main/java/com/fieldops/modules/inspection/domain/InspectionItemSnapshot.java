package com.fieldops.modules.inspection.domain;

import com.fieldops.modules.template.domain.ResponseType;
import com.fieldops.modules.template.domain.TemplateJsonSupport;
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
 * Cópia imutável de cada item de checklist no momento do agendamento da inspeção
 * (docs/modelo-de-dados.md 10.8.3, RN-021, RF-06).
 */
@Entity
@Table(
    name = "inspection_item_snapshots",
    indexes = {
        @Index(name = "idx_snapshots_inspection_id", columnList = "inspection_id"),
        @Index(name = "idx_snapshots_inspection_order", columnList = "inspection_id, section_order, item_order")
    }
)
public class InspectionItemSnapshot {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inspection_id", nullable = false, updatable = false)
    private Inspection inspection;

    @Column(name = "source_template_item_id", updatable = false)
    private UUID sourceTemplateItemId;

    @Column(name = "section_title", nullable = false, length = 200, updatable = false)
    private String sectionTitle;

    @Column(name = "section_description", length = 500, updatable = false)
    private String sectionDescription;

    @Column(name = "section_order", nullable = false, updatable = false)
    private Integer sectionOrder = 0;

    @Column(name = "item_code", length = 60, updatable = false)
    private String itemCode;

    @Column(name = "item_title", nullable = false, length = 300, updatable = false)
    private String itemTitle;

    @Column(name = "item_description", length = 1000, updatable = false)
    private String itemDescription;

    @Enumerated(EnumType.STRING)
    @Column(name = "response_type", nullable = false, length = 32, updatable = false)
    private ResponseType responseType;

    @Column(name = "required", nullable = false, updatable = false)
    private boolean required = true;

    @Column(name = "observation_required_on_failure", nullable = false, updatable = false)
    private boolean observationRequiredOnFailure = false;

    @Column(name = "evidence_required_on_failure", nullable = false, updatable = false)
    private boolean evidenceRequiredOnFailure = false;

    @Column(name = "rules_json", columnDefinition = "text", updatable = false)
    private String rulesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options_json", columnDefinition = "jsonb", updatable = false)
    private List<String> options;

    @Column(name = "item_order", nullable = false, updatable = false)
    private Integer itemOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public InspectionItemSnapshot() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
        if (this.sectionOrder == null) {
            this.sectionOrder = 0;
        }
        if (this.itemOrder == null) {
            this.itemOrder = 0;
        }
        if (this.rulesJson == null) {
            this.rulesJson = TemplateJsonSupport.buildRulesJson(
                    this.observationRequiredOnFailure,
                    this.evidenceRequiredOnFailure
            );
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

    public Inspection getInspection() {
        return inspection;
    }

    public void setInspection(Inspection inspection) {
        this.inspection = inspection;
    }

    public UUID getSourceTemplateItemId() {
        return sourceTemplateItemId;
    }

    public void setSourceTemplateItemId(UUID sourceTemplateItemId) {
        this.sourceTemplateItemId = sourceTemplateItemId;
    }

    public String getSectionTitle() {
        return sectionTitle;
    }

    public void setSectionTitle(String sectionTitle) {
        this.sectionTitle = sectionTitle;
    }

    public String getSectionDescription() {
        return sectionDescription;
    }

    public void setSectionDescription(String sectionDescription) {
        this.sectionDescription = sectionDescription;
    }

    public Integer getSectionOrder() {
        return sectionOrder;
    }

    public void setSectionOrder(Integer sectionOrder) {
        this.sectionOrder = sectionOrder;
    }

    public String getItemCode() {
        return itemCode;
    }

    public void setItemCode(String itemCode) {
        this.itemCode = itemCode;
    }

    public String getItemTitle() {
        return itemTitle;
    }

    public void setItemTitle(String itemTitle) {
        this.itemTitle = itemTitle;
    }

    public String getItemDescription() {
        return itemDescription;
    }

    public void setItemDescription(String itemDescription) {
        this.itemDescription = itemDescription;
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

    public String getRulesJson() {
        return rulesJson;
    }

    public void setRulesJson(String rulesJson) {
        this.rulesJson = rulesJson;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public Integer getItemOrder() {
        return itemOrder;
    }

    public void setItemOrder(Integer itemOrder) {
        this.itemOrder = itemOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
