-- ============================================================================
-- FieldOps — V4: Schema de Inspeções Agendadas, Snapshots Imutáveis e Auditoria
-- Referência: docs/modelo-de-dados.md (Seções 10.8, 10.12, 10.15), docs/regras-de-negocio.md e TASK-011
-- ============================================================================

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL,
    template_version_id UUID NOT NULL,
    template_version_number INTEGER NOT NULL,
    client_id UUID NOT NULL,
    site_id UUID NOT NULL,
    equipment_id UUID,
    technician_id UUID NOT NULL,
    supervisor_id UUID,
    created_by UUID,
    title VARCHAR(250) NOT NULL,
    instructions VARCHAR(2000),
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIA',
    status VARCHAR(32) NOT NULL DEFAULT 'ATRIBUÍDA',
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    started_at_device TIMESTAMP WITH TIME ZONE,
    started_at_server TIMESTAMP WITH TIME ZONE,
    completed_at_device TIMESTAMP WITH TIME ZONE,
    submitted_at_server TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    canceled_by UUID,
    canceled_reason VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_inspections_template FOREIGN KEY (template_id) REFERENCES inspection_templates (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_template_version FOREIGN KEY (template_version_id) REFERENCES template_versions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_site FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_equipment FOREIGN KEY (equipment_id) REFERENCES equipments (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_technician FOREIGN KEY (technician_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_supervisor FOREIGN KEY (supervisor_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inspections_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_inspections_canceled_by FOREIGN KEY (canceled_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT ck_inspections_priority CHECK (
        priority IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE', 'CRITICA', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),
    CONSTRAINT ck_inspections_status CHECK (
        status IN ('RASCUNHO', 'ATRIBUÍDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISÃO', 'APROVADA', 'REPROVADA', 'CANCELADA')
    )
);

CREATE INDEX IF NOT EXISTS idx_inspections_technician_status ON inspections (technician_id, status);
CREATE INDEX IF NOT EXISTS idx_inspections_supervisor_status ON inspections (supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_inspections_client_id ON inspections (client_id);
CREATE INDEX IF NOT EXISTS idx_inspections_site_id ON inspections (site_id);
CREATE INDEX IF NOT EXISTS idx_inspections_equipment_id ON inspections (equipment_id);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled_for ON inspections (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_inspections_status_scheduled ON inspections (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_inspections_template_version ON inspections (template_version_id);

CREATE TABLE IF NOT EXISTS inspection_item_snapshots (
    id UUID PRIMARY KEY,
    inspection_id UUID NOT NULL,
    source_template_item_id UUID,
    section_title VARCHAR(200) NOT NULL,
    section_description VARCHAR(500),
    section_order INTEGER NOT NULL DEFAULT 0,
    item_code VARCHAR(60),
    item_title VARCHAR(300) NOT NULL,
    item_description VARCHAR(1000),
    response_type VARCHAR(32) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    observation_required_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_required_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
    rules_json TEXT,
    options_json JSONB,
    item_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_snapshots_inspection FOREIGN KEY (inspection_id) REFERENCES inspections (id) ON DELETE CASCADE,
    CONSTRAINT fk_snapshots_source_item FOREIGN KEY (source_template_item_id) REFERENCES template_items (id) ON DELETE SET NULL,
    CONSTRAINT ck_snapshots_response_type CHECK (
        response_type IN (
            'TEXT_SHORT',
            'TEXT_LONG',
            'NUMBER',
            'BOOLEAN',
            'CONFORMITY',
            'SINGLE_CHOICE',
            'DATE',
            'PHOTO'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_snapshots_inspection_id ON inspection_item_snapshots (inspection_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_inspection_order ON inspection_item_snapshots (inspection_id, section_order, item_order);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_inspection_id ON audit_logs (inspection_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
