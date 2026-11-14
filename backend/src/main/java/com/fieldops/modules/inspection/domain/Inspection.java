package com.fieldops.modules.inspection.domain;

import com.fieldops.modules.master.domain.Client;
import com.fieldops.modules.master.domain.Equipment;
import com.fieldops.modules.master.domain.Site;
import com.fieldops.modules.master.domain.User;
import com.fieldops.modules.template.domain.InspectionTemplate;
import com.fieldops.modules.template.domain.TemplateVersion;
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
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entidade JPA mestre que representa uma inspeção agendada para execução em campo
 * (docs/modelo-de-dados.md 10.8.1 e TASK-011).
 */
@Entity
@Table(
    name = "inspections",
    indexes = {
        @Index(name = "idx_inspections_technician_status", columnList = "technician_id, status"),
        @Index(name = "idx_inspections_supervisor_status", columnList = "supervisor_id, status"),
        @Index(name = "idx_inspections_client_id", columnList = "client_id"),
        @Index(name = "idx_inspections_site_id", columnList = "site_id"),
        @Index(name = "idx_inspections_equipment_id", columnList = "equipment_id"),
        @Index(name = "idx_inspections_scheduled_for", columnList = "scheduled_for"),
        @Index(name = "idx_inspections_status_scheduled", columnList = "status, scheduled_for"),
        @Index(name = "idx_inspections_template_version", columnList = "template_version_id")
    }
)
public class Inspection {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private InspectionTemplate template;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false)
    private TemplateVersion templateVersion;

    @Column(name = "template_version_number", nullable = false)
    private Integer templateVersionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_id")
    private Equipment equipment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "technician_id", nullable = false)
    private User technician;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id")
    private User supervisor;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "title", nullable = false, length = 250)
    private String title;

    @Column(name = "instructions", length = 2000)
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 32)
    private InspectionPriority priority = InspectionPriority.MEDIA;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private InspectionStatus status = InspectionStatus.ATRIBUÍDA;

    @Column(name = "scheduled_for", nullable = false)
    private Instant scheduledFor;

    @Column(name = "started_at_device")
    private Instant startedAtDevice;

    @Column(name = "started_at_server")
    private Instant startedAtServer;

    @Column(name = "completed_at_device")
    private Instant completedAtDevice;

    @Column(name = "submitted_at_server")
    private Instant submittedAtServer;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "canceled_at")
    private Instant canceledAt;

    @Column(name = "canceled_by")
    private UUID canceledBy;

    @Column(name = "canceled_reason", length = 1000)
    private String canceledReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    @OneToMany(mappedBy = "inspection", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sectionOrder ASC, itemOrder ASC")
    private List<InspectionItemSnapshot> itemSnapshots = new ArrayList<>();

    public Inspection() {
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
        if (this.version == null) {
            this.version = 0;
        }
        if (this.priority == null) {
            this.priority = InspectionPriority.MEDIA;
        }
        if (this.status == null) {
            this.status = InspectionStatus.ATRIBUÍDA;
        }
    }

    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public void addItemSnapshot(InspectionItemSnapshot snapshot) {
        snapshot.setInspection(this);
        this.itemSnapshots.add(snapshot);
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

    public TemplateVersion getTemplateVersion() {
        return templateVersion;
    }

    public void setTemplateVersion(TemplateVersion templateVersion) {
        this.templateVersion = templateVersion;
    }

    public Integer getTemplateVersionNumber() {
        return templateVersionNumber;
    }

    public void setTemplateVersionNumber(Integer templateVersionNumber) {
        this.templateVersionNumber = templateVersionNumber;
    }

    public Client getClient() {
        return client;
    }

    public void setClient(Client client) {
        this.client = client;
    }

    public Site getSite() {
        return site;
    }

    public void setSite(Site site) {
        this.site = site;
    }

    public Equipment getEquipment() {
        return equipment;
    }

    public void setEquipment(Equipment equipment) {
        this.equipment = equipment;
    }

    public User getTechnician() {
        return technician;
    }

    public void setTechnician(User technician) {
        this.technician = technician;
    }

    public User getSupervisor() {
        return supervisor;
    }

    public void setSupervisor(User supervisor) {
        this.supervisor = supervisor;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public InspectionPriority getPriority() {
        return priority;
    }

    public void setPriority(InspectionPriority priority) {
        this.priority = priority != null ? priority : InspectionPriority.MEDIA;
    }

    public InspectionStatus getStatus() {
        return status;
    }

    public void setStatus(InspectionStatus status) {
        this.status = status;
    }

    public Instant getScheduledFor() {
        return scheduledFor;
    }

    public void setScheduledFor(Instant scheduledFor) {
        this.scheduledFor = scheduledFor;
    }

    public Instant getStartedAtDevice() {
        return startedAtDevice;
    }

    public void setStartedAtDevice(Instant startedAtDevice) {
        this.startedAtDevice = startedAtDevice;
    }

    public Instant getStartedAtServer() {
        return startedAtServer;
    }

    public void setStartedAtServer(Instant startedAtServer) {
        this.startedAtServer = startedAtServer;
    }

    public Instant getCompletedAtDevice() {
        return completedAtDevice;
    }

    public void setCompletedAtDevice(Instant completedAtDevice) {
        this.completedAtDevice = completedAtDevice;
    }

    public Instant getSubmittedAtServer() {
        return submittedAtServer;
    }

    public void setSubmittedAtServer(Instant submittedAtServer) {
        this.submittedAtServer = submittedAtServer;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(Instant approvedAt) {
        this.approvedAt = approvedAt;
    }

    public Instant getCanceledAt() {
        return canceledAt;
    }

    public void setCanceledAt(Instant canceledAt) {
        this.canceledAt = canceledAt;
    }

    public UUID getCanceledBy() {
        return canceledBy;
    }

    public void setCanceledBy(UUID canceledBy) {
        this.canceledBy = canceledBy;
    }

    public String getCanceledReason() {
        return canceledReason;
    }

    public void setCanceledReason(String canceledReason) {
        this.canceledReason = canceledReason;
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

    public List<InspectionItemSnapshot> getItemSnapshots() {
        return itemSnapshots;
    }

    public void setItemSnapshots(List<InspectionItemSnapshot> itemSnapshots) {
        this.itemSnapshots = itemSnapshots;
    }
}
