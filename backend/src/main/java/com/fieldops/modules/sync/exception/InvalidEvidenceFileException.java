package com.fieldops.modules.sync.exception;

import org.springframework.http.HttpStatus;

import java.util.UUID;

/**
 * Exceção lançada quando um upload de evidência possui formato inválido, arquivo corrompido,
 * tamanho acima do limite ou conflito de estado (EX-02: HTTP 415 Unsupported Media Type).
 */
public class InvalidEvidenceFileException extends RuntimeException {

    private final HttpStatus httpStatus;
    private final String code;
    private final UUID evidenceId;
    private final String originalFileName;
    private final String mimeType;
    private final String fileStatus;

    public InvalidEvidenceFileException(
            HttpStatus httpStatus,
            String code,
            String message,
            UUID evidenceId,
            String originalFileName,
            String mimeType
    ) {
        super(message);
        this.httpStatus = httpStatus;
        this.code = code;
        this.evidenceId = evidenceId;
        this.originalFileName = originalFileName;
        this.mimeType = mimeType;
        this.fileStatus = "FAILED";
    }

    public static InvalidEvidenceFileException unsupportedMediaType(
            String code,
            String message,
            UUID evidenceId,
            String originalFileName,
            String mimeType
    ) {
        return new InvalidEvidenceFileException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                code,
                message,
                evidenceId,
                originalFileName,
                mimeType
        );
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public String getCode() {
        return code;
    }

    public UUID getEvidenceId() {
        return evidenceId;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public String getMimeType() {
        return mimeType;
    }

    public String getFileStatus() {
        return fileStatus;
    }
}
