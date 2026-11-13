-- ============================================================================
-- FieldOps — V2: Schema de Cadastros Mestres (Clientes, Locais e Equipamentos)
-- Referência: docs/modelo-de-dados.md (Seções 10.5.1, 10.5.2, 10.5.3, 10.15) e TASK-007
-- Nota: A tabela users e seus índices base foram criados em V1__init_auth_schema.sql.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY,
    code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    document VARCHAR(32),
    email VARCHAR(255),
    phone VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_clients_code UNIQUE (code),
    CONSTRAINT ck_clients_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_document ON clients (document);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients (active);

CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL,
    code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    address_line VARCHAR(255),
    city VARCHAR(120),
    state VARCHAR(32),
    postal_code VARCHAR(20),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    contact_name VARCHAR(150),
    contact_phone VARCHAR(32),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_sites_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
    CONSTRAINT uq_sites_client_code UNIQUE (client_id, code),
    CONSTRAINT ck_sites_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_sites_client_id ON sites (client_id);
CREATE INDEX IF NOT EXISTS idx_sites_name ON sites (name);
CREATE INDEX IF NOT EXISTS idx_sites_code ON sites (code);
CREATE INDEX IF NOT EXISTS idx_sites_city ON sites (city);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites (status);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites (active);

CREATE TABLE IF NOT EXISTS equipments (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL,
    code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    asset_number VARCHAR(80),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(120),
    model VARCHAR(120),
    description VARCHAR(500),
    qr_code VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    installed_at DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_equipments_site FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE RESTRICT,
    CONSTRAINT uq_equipments_qr_code UNIQUE (qr_code),
    CONSTRAINT ck_equipments_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED'))
);

CREATE INDEX IF NOT EXISTS idx_equipments_site_id ON equipments (site_id);
CREATE INDEX IF NOT EXISTS idx_equipments_name ON equipments (name);
CREATE INDEX IF NOT EXISTS idx_equipments_code ON equipments (code);
CREATE INDEX IF NOT EXISTS idx_equipments_asset_number ON equipments (asset_number);
CREATE INDEX IF NOT EXISTS idx_equipments_serial_number ON equipments (serial_number);
CREATE INDEX IF NOT EXISTS idx_equipments_status ON equipments (status);
CREATE INDEX IF NOT EXISTS idx_equipments_active ON equipments (active);

