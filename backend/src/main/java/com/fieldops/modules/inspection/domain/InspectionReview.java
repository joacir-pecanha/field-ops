package com.fieldops.modules.inspection.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entidade JPA que preserva o histórico de cada ciclo de revisão técnica da inspeção
 * (docs/modelo-de-dados.md 10.11.1, RN-083, TASK-019).
 */
@Entity
@Table(
    name = "inspection_reviews",
    indexes = {
        @Index(name = "idx_inspection_reviews_inspection_id", columnList = "inspection_id, review_cycle"),
        @Index(name = "idx_inspection_reviews_reviewer_id", columnList = "reviewer_id")
    }
)
public class InspectionReview {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "inspection_id", nullable = false, updatable = false)
    private UUID inspectionId;

    @Column(name = "reviewer_id", nullable = false, updatable = false)
    private UUID reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, length = 32, updatable = false)
    private InspectionReviewDecision decision;

    @Column(name = "reason", length = 2000, updatable = false)
    private String reason;

    @Column(name = "comments", length = 2000, updatable = false)
    private String comments;

    @Column(name = "reviewed_at", nullable = false, updatable = false)
    private Instant reviewedAt;

    @Column(name = "review_cycle", nullable = false, updatable = false)
    private Integer reviewCycle = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public InspectionReview() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (this.reviewedAt == null) {
            this.reviewedAt = now;
        }
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.reviewCycle == null || this.reviewCycle < 1) {
            this.reviewCycle = 1;
        }
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

    public UUID getReviewerId() {
        return reviewerId;
    }

    public void setReviewerId(UUID reviewerId) {
        this.reviewerId = reviewerId;
    }

    public InspectionReviewDecision getDecision() {
        return decision;
    }

    public void setDecision(InspectionReviewDecision decision) {
        this.decision = decision;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public Integer getReviewCycle() {
        return reviewCycle;
    }

    public void setReviewCycle(Integer reviewCycle) {
        this.reviewCycle = reviewCycle;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
