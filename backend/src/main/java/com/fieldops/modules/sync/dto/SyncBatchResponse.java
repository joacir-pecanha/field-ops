package com.fieldops.modules.sync.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

/**
 * DTO de resposta do processamento em lote com status individual por operation_id (RF-03, RF-05, RF-06).
 */
@Schema(description = "Resultado consolidado e individual por operação do lote de sincronização")
public record SyncBatchResponse(
        @JsonProperty("batch_id")
        String batchId,

        String status,

        @JsonProperty("total_operations")
        int totalOperations,

        @JsonProperty("succeeded_count")
        int succeededCount,

        @JsonProperty("failed_count")
        int failedCount,

        @JsonProperty("server_timestamp")
        Instant serverTimestamp,

        List<ProcessedItem> processed
) {

    @Schema(description = "Resultado individual de uma operação da Outbox")
    public record ProcessedItem(
            @JsonProperty("operation_id")
            String operationId,

            @JsonProperty("operation_type")
            String operationType,

            @JsonProperty("entity_id")
            String entityId,

            boolean success,

            String status,

            @JsonProperty("error_code")
            String errorCode,

            String message,

            @JsonProperty("client_timestamp")
            Instant clientTimestamp,

            @JsonProperty("server_timestamp")
            Instant serverTimestamp
    ) {
    }
}
