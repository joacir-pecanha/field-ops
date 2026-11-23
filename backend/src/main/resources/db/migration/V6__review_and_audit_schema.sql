-- ============================================================================
-- FieldOps — V6: Schema de Revisão Técnica, Histórico de Ciclos,
--                Ajustes Administrativos e Índices de Auditoria
-- Referência: docs/fluxo_geral.md (7.6), docs/modelo-de-dados.md (10.11, 10.12),
--             docs/regras-de-negocio.md (RN-079..RN-089) e TASK-019
-- ============================================================================

-- 1. Garantia da tabela audit_logs e índices compostos por entidade e timestamp (Passo 1, RT-02)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    inspection_id UUID,
    actor_id UUID,
    actor_email VARCHAR(255),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    previous_status VARCHAR(32),
    new_status VARCHAR(32),
    previous_value_json TEXT,
    new_value_json TEXT,
    metadata_json TEXT,
    details VARCHAR(1000),
    request_id VARCHAR(120),
    device_id VARCHAR(120),
    device_occurred_at TIMESTAMP WITH TIME ZONE,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_occurred_at
    ON audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_inspection_occurred_at
    ON audit_logs (inspection_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_occurred_at
    ON audit_logs (actor_id, occurred_at);

-- 2. Metadados do ciclo de revisão, aprovação e reprovação na tabela inspections
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS review_started_by UUID;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS review_comments VARCHAR(2000);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS rejected_by UUID;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(2000);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS review_cycle INTEGER NOT NULL DEFAULT 0;

ALTER TABLE inspections
    ADD CONSTRAINT fk_inspections_review_started_by
    FOREIGN KEY (review_started_by) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE inspections
    ADD CONSTRAINT fk_inspections_approved_by
    FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE inspections
    ADD CONSTRAINT fk_inspections_rejected_by
    FOREIGN KEY (rejected_by) REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_status_review
    ON inspections (status, submitted_at_server);

-- 3. Histórico completo de ciclos de revisão (docs/modelo-de-dados.md 10.11.1, RN-083)
CREATE TABLE IF NOT EXISTS inspection_reviews (
    id UUID PRIMARY KEY,
    inspection_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    decision VARCHAR(32) NOT NULL,
    reason VARCHAR(2000),
    comments VARCHAR(2000),
    reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    review_cycle INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inspection_reviews_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE,
    CONSTRAINT fk_inspection_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_inspection_reviews_decision CHECK (decision IN ('REVIEW_STARTED', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_inspection_reviews_inspection_id
    ON inspection_reviews (inspection_id, review_cycle);
CREATE INDEX IF NOT EXISTS idx_inspection_reviews_reviewer_id
    ON inspection_reviews (reviewer_id);

-- 4. Ajustes administrativos diferenciados sobre respostas do técnico (RF-07, RN-084, RN-085)
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS is_admin_adjusted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS admin_adjusted_value TEXT;
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS admin_adjustment_reason VARCHAR(1000);
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS admin_adjusted_by UUID;
ALTER TABLE inspection_responses ADD COLUMN IF NOT EXISTS admin_adjusted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE inspection_responses
    ADD CONSTRAINT fk_inspection_responses_admin_adjusted_by
    FOREIGN KEY (admin_adjusted_by) REFERENCES users (id) ON DELETE SET NULL;
