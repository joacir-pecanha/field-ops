package com.fieldops.modules.sync.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entidade JPA para controle atômico de idempotência das mutações da Outbox (RF-02, RF-03, RT-01).
 */
@Entity
@Table(
    name = "processed_operations",
    indexes = {
        @Index(name = "idx_processed_operations_batch_id", columnList = "batch_id"),
        @Index(name = "idx_processed_operations_inspection_id", columnList = "inspection_id"),
        @Index(name = "idx_processed_operations_type", columnList = "operation_type"),
        @Index(name = "idx_processed_operations_server_ts", columnList = "server_timestamp")
    }
)
public class ProcessedOperation {

    @Id
    @Column(name = "operation_id", nullable = false, updatable = false)
    private UUID operationId;

    @Column(name = "batch_id", length = 120)
    private String batchId;

    @Column(name = "operation_type", nullable = false, length = 64)
    private String operationType;

    @Column(name = "entity_type", length = 64)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "inspection_id")
    private UUID inspectionId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "SUCCESS";

    @Column(name = "result_code", nullable = false, length = 64)
    private String resultCode = "PROCESSED";

    @Column(name = "result_message", length = 1000)
    private String resultMessage;

    @Column(name = "payload_json", columnDefinition = "text")
    private String payloadJson;

    @Column(name = "client_timestamp")
    private Instant clientTimestamp;

    @Column(name = "server_timestamp", nullable = false, updatable = false)
    private Instant serverTimestamp;

    public ProcessedOperation() {
    }

    @PrePersist
    protected void prePersist() {
        if (this.status == null) {
            this.status = "SUCCESS";
        }
        if (this.resultCode == null) {
            this.resultCode = "PROCESSED";
        }
        if (this.serverTimestamp == null) {
            this.serverTimestamp = Instant.now();
        }
    }

    public UUID getOperationId() {
        return operationId;
    }

    public void setOperationId(UUID operationId) {
        this.operationId = operationId;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getOperationType() {
        return operationType;
    }

    public void setOperationType(String operationType) {
        this.operationType = operationType;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public void setEntityId(UUID entityId) {
        this.entityId = entityId;
    }

    public UUID getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(UUID inspectionId) {
        this.inspectionId = inspectionId;
    }

    public UUID getActorId() {
        return actorId;
    }

    public void setActorId(UUID actorId) {
        this.actorId = actorId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getResultCode() {
        return resultCode;
    }

    public void setResultCode(String resultCode) {
        this.resultCode = resultCode;
    }

    public String getResultMessage() {
        return resultMessage;
    }

    public void setResultMessage(String resultMessage) {
        this.resultMessage = resultMessage;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public Instant getClientTimestamp() {
        return clientTimestamp;
    }

    public void setClientTimestamp(Instant clientTimestamp) {
        this.clientTimestamp = clientTimestamp;
    }

    public Instant getServerTimestamp() {
        return serverTimestamp;
    }

    public void setServerTimestamp(Instant serverTimestamp) {
        this.serverTimestamp = serverTimestamp;
    }
}
