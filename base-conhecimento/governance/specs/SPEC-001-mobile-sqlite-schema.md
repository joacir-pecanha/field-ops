# SPEC-001: Modelagem e Schema do SQLite Local (Offline-First)

## 1. Metadados
- **ID:** SPEC-001
- **Módulo:** Mobile / Persistência Local
- **Status:** APPROVED
- **Responsável Humano:** Joacir Peçanha
- **Autor:** Planner Agent
- **Documentos de Referência:** [docs/arquitetura.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/arquitetura.md), [docs/aplicativo_mobile.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/aplicativo_mobile.md), [docs/fluxo_geral.md](file:///c:/Users/Joacir/Desktop/field-ops/docs/fluxo_geral.md)

---

## 2. Visão Geral
O banco SQLite local no aplicativo mobile é a **Fonte Única da Verdade Operacional (SSOT)** para o técnico em campo. Ele armazena as inspeções atribuídas, os itens de checklist dinâmicos, as respostas do técnico, os registros de não conformidades, os metadados de fotos capturadas e a fila de operações Outbox para envio ao backend.

---

## 3. Modelo de Tabelas DDL

```sql
-- 1. Usuário / Sessão Local
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Inspeções Atribuídas
CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    remote_id TEXT UNIQUE,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL DEFAULT 1,
    client_name TEXT NOT NULL,
    site_name TEXT NOT NULL,
    site_address TEXT,
    equipment_name TEXT NOT NULL,
    equipment_code TEXT,
    equipment_qr_code TEXT,
    status TEXT NOT NULL CHECK(status IN ('RASCUNHO', 'ATRIBUÍDA', 'EM_ANDAMENTO', 'ENVIADA', 'EM_REVISÃO', 'APROVADA', 'REPROVADA', 'CANCELADA')),
    priority TEXT DEFAULT 'MEDIA',
    due_date TEXT,
    started_at TEXT,
    completed_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'SINCRONIZADO' CHECK(sync_status IN ('SINCRONIZADO', 'PENDENTE', 'SINCRONIZANDO', 'ERRO', 'CONFLITO')),
    rejection_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_sync ON inspections(sync_status);

-- 3. Seções do Checklist
CREATE TABLE IF NOT EXISTS checklist_sections (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 4. Itens do Checklist
CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL,
    inspection_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    response_type TEXT NOT NULL CHECK(response_type IN ('TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'BOOLEAN', 'CONFORMITY', 'SINGLE_CHOICE', 'DATE')),
    options_json TEXT, -- Opções para SINGLE_CHOICE em formato JSON array
    required INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(section_id) REFERENCES checklist_sections(id) ON DELETE CASCADE,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 5. Respostas do Checklist
CREATE TABLE IF NOT EXISTS checklist_responses (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL UNIQUE,
    inspection_id TEXT NOT NULL,
    value TEXT, -- Serialização da resposta (texto, número, boolean ou valor selecionado)
    observation TEXT,
    is_non_conformity INTEGER NOT NULL DEFAULT 0,
    non_conformity_description TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    responded_at TEXT,
    FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE CASCADE,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

-- 6. Evidências Fotográficas
CREATE TABLE IF NOT EXISTS inspection_evidences (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    item_id TEXT,
    local_uri TEXT NOT NULL,
    remote_key TEXT,
    remote_url TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/jpeg',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')),
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE SET NULL
);

-- 7. Fila de Operações Outbox
CREATE TABLE IF NOT EXISTS outbox_operations (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'INSPECTION' | 'CHECKLIST_RESPONSE' | 'EVIDENCE'
    global_id TEXT NOT NULL,
    operation_type TEXT NOT NULL, -- 'START_INSPECTION' | 'SUBMIT_RESPONSE' | 'UPLOAD_EVIDENCE' | 'COMPLETE_INSPECTION'
    payload TEXT NOT NULL,
    dependencies TEXT, -- JSON array de IDs de operações pré-requisito
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    retries INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_operations(status, created_at);
```

---

## 4. Políticas de Migração
- As migrações devem ser versionadas em sequência (`001_initial_schema.sql`, `002_...`).
- O sistema deve verificar a versão atual no SQLite (`PRAGMA user_version`) e aplicar migrações sequencialmente dentro de transações atômicas.

---

## 5. Tarefas Associadas
- [TASK-001](file:///c:/Users/Joacir/Desktop/field-ops/governance/tasks/backlog/TASK-001-setup-sqlite-migrations.md): Setup de SQLite e migrações no Expo 57.
