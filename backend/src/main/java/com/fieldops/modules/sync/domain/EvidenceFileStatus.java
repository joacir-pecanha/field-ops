package com.fieldops.modules.sync.domain;

/**
 * Estados individuais de rastreamento do arquivo de evidência (RF-07, RN-078).
 */
public enum EvidenceFileStatus {
    PENDING,
    UPLOADING,
    UPLOADED,
    FAILED,
    DELETED
}
