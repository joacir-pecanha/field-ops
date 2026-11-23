package com.fieldops.modules.sync.exception;

/**
 * Exceção interna de processamento individual de operação em lote (CONFLICT ou FAILED).
 */
public class SyncOperationException extends RuntimeException {

    private final String code;
    private final String resultStatus;

    public SyncOperationException(String code, String resultStatus, String message) {
        super(message);
        this.code = code;
        this.resultStatus = resultStatus;
    }

    public static SyncOperationException conflict(String message) {
        return new SyncOperationException("CONFLICT", "CONFLICT", message);
    }

    public static SyncOperationException failed(String code, String message) {
        return new SyncOperationException(code, "FAILED", message);
    }

    public String getCode() {
        return code;
    }

    public String getResultStatus() {
        return resultStatus;
    }
}
