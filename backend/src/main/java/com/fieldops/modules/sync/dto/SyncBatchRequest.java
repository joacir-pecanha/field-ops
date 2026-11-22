package com.fieldops.modules.sync.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Payload de entrada para o endpoint de sincronização em lote da Outbox móvel (RF-01, RF-02, SPEC-002).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "Lote de mutações offline da Outbox enviado pelo aplicativo móvel")
public class SyncBatchRequest {

    @JsonProperty("batch_id")
    @JsonAlias({"batchId", "batch_id"})
    @Schema(description = "Identificador único do lote enviado pelo dispositivo", example = "550e8400-e29b-41d4-a716-446655440000")
    private String batchId;

    @Schema(description = "Lista de operações pendentes a serem processadas idempotentemente")
    private List<OperationItem> operations;

    public SyncBatchRequest() {
    }

    public SyncBatchRequest(String batchId, List<OperationItem> operations) {
        this.batchId = batchId;
        this.operations = operations;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public List<OperationItem> getOperations() {
        return operations;
    }

    public void setOperations(List<OperationItem> operations) {
        this.operations = operations;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Operação individual da fila Outbox com chave idempotente")
    public static class OperationItem {

        @JsonProperty("operation_id")
        @JsonAlias({"id", "operationId", "operation_id"})
        @Schema(description = "UUID idempotente único da mutação", requiredMode = Schema.RequiredMode.REQUIRED)
        private String operationId;

        @JsonProperty("operation_type")
        @JsonAlias({"operationType", "operation_type", "type"})
        @Schema(description = "Tipo da operação: START_INSPECTION, SAVE_RESPONSE, SUBMIT_RESPONSE, CREATE_NON_CONFORMITY, UPDATE_NON_CONFORMITY, CANCEL_NON_CONFORMITY, COMPLETE_INSPECTION", requiredMode = Schema.RequiredMode.REQUIRED)
        private String operationType;

        @JsonProperty("entity_type")
        @JsonAlias({"entityType", "entity_type"})
        private String entityType;

        @JsonProperty("global_id")
        @JsonAlias({"globalId", "global_id", "entity_id", "entityId"})
        private String globalId;

        @Schema(description = "Dados da mutação (string JSON serializada ou objeto JSON)")
        private Object payload;

        @JsonProperty("client_timestamp")
        @JsonAlias({"clientTimestamp", "client_timestamp", "created_at", "createdAt"})
        @Schema(description = "Timestamp ISO-8601 registrado pelo dispositivo no momento da ação offline")
        private String clientTimestamp;

        @JsonProperty("base_version")
        @JsonAlias({"baseVersion", "base_version", "version"})
        @Schema(description = "Versão otimista conhecida pelo dispositivo para detecção de conflitos")
        private Integer baseVersion;

        @JsonAlias({"dependency_ids", "dependencyIds", "dependencies"})
        private List<String> dependencies;

        public OperationItem() {
        }

        public String getOperationId() {
            return operationId;
        }

        public void setOperationId(String operationId) {
            this.operationId = operationId;
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

        public String getGlobalId() {
            return globalId;
        }

        public void setGlobalId(String globalId) {
            this.globalId = globalId;
        }

        public Object getPayload() {
            return payload;
        }

        public void setPayload(Object payload) {
            this.payload = payload;
        }

        public String getClientTimestamp() {
            return clientTimestamp;
        }

        public void setClientTimestamp(String clientTimestamp) {
            this.clientTimestamp = clientTimestamp;
        }

        public Integer getBaseVersion() {
            return baseVersion;
        }

        public void setBaseVersion(Integer baseVersion) {
            this.baseVersion = baseVersion;
        }

        public List<String> getDependencies() {
            return dependencies;
        }

        public void setDependencies(List<String> dependencies) {
            this.dependencies = dependencies;
        }
    }
}
