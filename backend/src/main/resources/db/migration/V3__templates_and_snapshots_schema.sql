-- ============================================================================
-- FieldOps — V3: Schema de Templates de Inspeção, Versionamento Imutável e Snapshots
-- Referência: docs/modelo-de-dados.md (Seção 10.7), docs/regras-de-negocio.md (RN-015..RN-023) e TASK-009
-- Nota: V1__init_auth_schema.sql (TASK-005) e V2__init_master_schema.sql (TASK-007) já existem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inspection_templates (
    id UUID PRIMARY KEY,
    code VARCHAR(60),
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    category VARCHAR(100) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 0,
    current_version INTEGER NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lock_version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_inspection_templates_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT uq_inspection_templates_code UNIQUE (code),
    CONSTRAINT ck_inspection_templates_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'INACTIVE')),
    CONSTRAINT ck_inspection_templates_version CHECK (version >= 0),
    CONSTRAINT ck_inspection_templates_current_version CHECK (current_version >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inspection_templates_title ON inspection_templates (title);
CREATE INDEX IF NOT EXISTS idx_inspection_templates_category ON inspection_templates (category);
CREATE INDEX IF NOT EXISTS idx_inspection_templates_status ON inspection_templates (status);
CREATE INDEX IF NOT EXISTS idx_inspection_templates_active ON inspection_templates (active);

CREATE TABLE IF NOT EXISTS template_versions (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    title_snapshot VARCHAR(200) NOT NULL,
    description_snapshot VARCHAR(1000),
    category_snapshot VARCHAR(100) NOT NULL,
    published_by UUID,
    published_at TIMESTAMP WITH TIME ZONE,
    active_for_new_inspections BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_template_versions_template FOREIGN KEY (template_id) REFERENCES inspection_templates (id) ON DELETE CASCADE,
    CONSTRAINT fk_template_versions_published_by FOREIGN KEY (published_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT uq_template_versions_template_version UNIQUE (template_id, version_number),
    CONSTRAINT ck_template_versions_number CHECK (version_number >= 1),
    CONSTRAINT ck_template_versions_status CHECK (status IN ('DRAFT', 'PUBLISHED'))
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions (template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_status ON template_versions (status);
CREATE INDEX IF NOT EXISTS idx_template_versions_active_new ON template_versions (active_for_new_inspections);

CREATE TABLE IF NOT EXISTS template_sections (
    id UUID PRIMARY KEY,
    template_version_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_template_sections_version FOREIGN KEY (template_version_id) REFERENCES template_versions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_sections_version_id ON template_sections (template_version_id);
CREATE INDEX IF NOT EXISTS idx_template_sections_version_order ON template_sections (template_version_id, order_index);

CREATE TABLE IF NOT EXISTS template_items (
    id UUID PRIMARY KEY,
    section_id UUID NOT NULL,
    code VARCHAR(60),
    title VARCHAR(300) NOT NULL,
    description VARCHAR(1000),
    response_type VARCHAR(32),
    required BOOLEAN NOT NULL DEFAULT TRUE,
    observation_required_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_required_on_failure BOOLEAN NOT NULL DEFAULT FALSE,
    options_json JSONB,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_template_items_section FOREIGN KEY (section_id) REFERENCES template_sections (id) ON DELETE CASCADE,
    CONSTRAINT ck_template_items_response_type CHECK (
        response_type IS NULL
        OR response_type IN (
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

CREATE INDEX IF NOT EXISTS idx_template_items_section_id ON template_items (section_id);
CREATE INDEX IF NOT EXISTS idx_template_items_section_order ON template_items (section_id, order_index);

