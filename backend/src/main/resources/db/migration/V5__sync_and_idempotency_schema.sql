-- ============================================================================
-- FieldOps — V5: Schema de Sincronização em Lote, Idempotência, Respostas,
--                Não Conformidades e Armazenamento de Evidências
-- Referência: docs/modelo-de-dados.md (Seções 10.8.4, 10.9.1, 10.10.1),
--             SPEC-002 e TASK-018
-- ============================================================================

-- Colunas opcionais de geolocalização pontual de início e conclusão na inspeção (RN-061, RN-062)
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS start_latitude NUMERIC(10, 7);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS start_longitude NUMERIC(10, 7);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS start_accuracy NUMERIC(10, 2);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS complete_latitude NUMERIC(10, 7);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS complete_longitude NUMERIC(10, 7);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS complete_accuracy NUMERIC(10, 2);

-- 1. Registro atômico de operações processadas para idempotência absoluta (RF-02, RF-03, RT-01)
CREATE TABLE IF NOT EXISTS processed_operations (
    operation_id UUID PRIMARY KEY,
    batch_id VARCHAR(120),
    operation_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    inspection_id UUID,
    actor_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    result_code VARCHAR(64) NOT NULL DEFAULT 'PROCESSED',
    result_message VARCHAR(1000),
    payload_json TEXT,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_processed_operations_operation_id UNIQUE (operation_id),
    CONSTRAINT fk_processed_operations_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE SET NULL,
    CONSTRAINT fk_processed_operations_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_processed_operations_status CHECK (status IN ('SUCCESS', 'FAILED', 'CONFLICT'))
);

CREATE INDEX IF NOT EXISTS idx_processed_operations_batch_id ON processed_operations (batch_id);
CREATE INDEX IF NOT EXISTS idx_processed_operations_inspection_id ON processed_operations (inspection_id);
CREATE INDEX IF NOT EXISTS idx_processed_operations_type ON processed_operations (operation_type);
CREATE INDEX IF NOT EXISTS idx_processed_operations_server_ts ON processed_operations (server_timestamp);

-- 2. Respostas sincronizadas dos itens do checklist (10.8.4)
CREATE TABLE IF NOT EXISTS inspection_responses (
    id UUID PRIMARY KEY,
    inspection_id UUID NOT NULL,
    inspection_item_id UUID NOT NULL,
    value_raw TEXT,
    value_text TEXT,
    value_number NUMERIC(19, 4),
    value_boolean BOOLEAN,
    value_date DATE,
    value_json TEXT,
    observation VARCHAR(2000),
    conformity VARCHAR(32),
    is_non_conformity BOOLEAN NOT NULL DEFAULT FALSE,
    non_conformity_description VARCHAR(2000),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    accuracy NUMERIC(10, 2),
    answered_by UUID,
    answered_at_device TIMESTAMP WITH TIME ZONE,
    server_received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_inspection_responses_item UNIQUE (inspection_item_id),
    CONSTRAINT fk_inspection_responses_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_responses_item FOREIGN KEY (inspection_item_id) REFERENCES inspection_item_snapshots (id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_responses_answered_by FOREIGN KEY (answered_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_inspection_responses_conformity CHECK (
        conformity IS NULL OR conformity IN ('CONFORMING', 'NON_CONFORMING', 'NOT_APPLICABLE')
    )
);

CREATE INDEX IF NOT EXISTS idx_inspection_responses_inspection_id ON inspection_responses (inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_responses_answered_by ON inspection_responses (answered_by);

-- 3. Não conformidades sincronizadas pelo técnico (10.10.1)
CREATE TABLE IF NOT EXISTS non_conformities (
    id UUID PRIMARY KEY,
    inspection_id UUID NOT NULL,
    inspection_item_id UUID,
    response_id UUID,
    item_title VARCHAR(300),
    title VARCHAR(250) NOT NULL,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    canceled_reason VARCHAR(1000),
    created_by UUID,
    created_at_device TIMESTAMP WITH TIME ZONE,
    server_received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_non_conformities_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE,
    CONSTRAINT fk_non_conformities_item FOREIGN KEY (inspection_item_id) REFERENCES inspection_item_snapshots (id) ON DELETE SET NULL,
    CONSTRAINT fk_non_conformities_response FOREIGN KEY (response_id) REFERENCES inspection_responses (id) ON DELETE SET NULL,
    CONSTRAINT fk_non_conformities_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_non_conformities_severity CHECK (
        severity IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    CONSTRAINT ck_non_conformities_status CHECK (
        status IN ('OPEN', 'RESOLVED', 'CANCELED')
    )
);

CREATE INDEX IF NOT EXISTS idx_non_conformities_inspection_id ON non_conformities (inspection_id);
CREATE INDEX IF NOT EXISTS idx_non_conformities_item_id ON non_conformities (inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_non_conformities_response_id ON non_conformities (response_id);
CREATE INDEX IF NOT EXISTS idx_non_conformities_severity ON non_conformities (severity);
CREATE INDEX IF NOT EXISTS idx_non_conformities_status ON non_conformities (status);

-- 4. Metadados e rastreamento de arquivos de evidência fotográfica (10.9.1, RF-07, RT-03)
CREATE TABLE IF NOT EXISTS evidence_files (
    id UUID PRIMARY KEY,
    inspection_id UUID NOT NULL,
    inspection_item_id UUID,
    response_id UUID,
    non_conformity_id UUID,
    type VARCHAR(32) NOT NULL DEFAULT 'PHOTO',
    file_name VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(255),
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    checksum_sha256 VARCHAR(128) NOT NULL,
    width INTEGER,
    height INTEGER,
    description VARCHAR(1000),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    status VARCHAR(32) NOT NULL DEFAULT 'UPLOADED',
    error_message VARCHAR(1000),
    captured_at_device TIMESTAMP WITH TIME ZONE,
    server_received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_files_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_files_item FOREIGN KEY (inspection_item_id) REFERENCES inspection_item_snapshots (id) ON DELETE SET NULL,
    CONSTRAINT fk_evidence_files_response FOREIGN KEY (response_id) REFERENCES inspection_responses (id) ON DELETE SET NULL,
    CONSTRAINT fk_evidence_files_nc FOREIGN KEY (non_conformity_id) REFERENCES non_conformities (id) ON DELETE SET NULL,
    CONSTRAINT fk_evidence_files_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_evidence_files_status CHECK (
        status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'DELETED')
    )
);

CREATE INDEX IF NOT EXISTS idx_evidence_files_inspection_id ON evidence_files (inspection_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_item_id ON evidence_files (inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_response_id ON evidence_files (response_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_nc_id ON evidence_files (non_conformity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_checksum ON evidence_files (checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_evidence_files_uploaded_at ON evidence_files (uploaded_at);
