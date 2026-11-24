-- ============================================================================
-- FieldOps MVP — Seed Idempotente e Reexecutável para Demonstração E2E
-- Referência: TASK-022 (RF-01, RT-01, EX-01) e critério AC-RELEASE
-- Compatibilidade: PostgreSQL 15/16+ (Docker / AWS RDS) e H2 (MODE=PostgreSQL)
--
-- Credenciais padrão da massa de demonstração (BCrypt custo 12):
--   Senha única para todos os usuários de teste: FieldOps@123
--   - admin@fieldops.com      (ADMIN)
--   - supervisor@fieldops.com (SUPERVISOR)
--   - tecnico@fieldops.com    (TECHNICIAN)
--   - ana.tecnica@fieldops.com(TECHNICIAN)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Reset instantâneo de artefatos da inspeção de demonstração (EX-01)
--    Garante que qualquer execução parcial ou dado corrompido durante testes
--    seja restaurado ao estado limpo 'ATRIBUÍDA' ao reexecutar este script.
-- ----------------------------------------------------------------------------
DELETE FROM processed_operations WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM evidence_files       WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM non_conformities     WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM inspection_responses WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM inspection_reviews   WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM audit_logs           WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM inspection_item_snapshots WHERE inspection_id = '88888888-8888-4888-8888-888888888801';
DELETE FROM inspections          WHERE id            = '88888888-8888-4888-8888-888888888801';

-- ----------------------------------------------------------------------------
-- 1. Usuários de Demonstração (ADMIN, SUPERVISOR, TECHNICIAN)
--    Hash BCrypt(12) válido para 'FieldOps@123'
-- ----------------------------------------------------------------------------
UPDATE users
   SET name = 'Administrador FieldOps',
       password_hash = '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy',
       role = 'ADMIN',
       status = 'ACTIVE',
       phone = '+5511990000001',
       updated_at = CURRENT_TIMESTAMP
 WHERE LOWER(email) = 'admin@fieldops.com';

INSERT INTO users (id, name, email, password_hash, role, status, phone, created_at, updated_at, version)
SELECT '11111111-1111-4111-8111-111111111101', 'Administrador FieldOps', 'admin@fieldops.com',
       '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy', 'ADMIN', 'ACTIVE', '+5511990000001',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'admin@fieldops.com');

UPDATE users
   SET name = 'Supervisor Operacional',
       password_hash = '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy',
       role = 'SUPERVISOR',
       status = 'ACTIVE',
       phone = '+5511990000002',
       updated_at = CURRENT_TIMESTAMP
 WHERE LOWER(email) = 'supervisor@fieldops.com';

INSERT INTO users (id, name, email, password_hash, role, status, phone, created_at, updated_at, version)
SELECT '11111111-1111-4111-8111-111111111102', 'Supervisor Operacional', 'supervisor@fieldops.com',
       '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy', 'SUPERVISOR', 'ACTIVE', '+5511990000002',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'supervisor@fieldops.com');

UPDATE users
   SET name = 'Carlos Técnico',
       password_hash = '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy',
       role = 'TECHNICIAN',
       status = 'ACTIVE',
       phone = '+5511990000003',
       updated_at = CURRENT_TIMESTAMP
 WHERE LOWER(email) = 'tecnico@fieldops.com';

INSERT INTO users (id, name, email, password_hash, role, status, phone, created_at, updated_at, version)
SELECT '11111111-1111-4111-8111-111111111103', 'Carlos Técnico', 'tecnico@fieldops.com',
       '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy', 'TECHNICIAN', 'ACTIVE', '+5511990000003',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'tecnico@fieldops.com');

UPDATE users
   SET name = 'Ana Ribeiro Técnica',
       password_hash = '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy',
       role = 'TECHNICIAN',
       status = 'ACTIVE',
       phone = '+5511990000004',
       updated_at = CURRENT_TIMESTAMP
 WHERE LOWER(email) = 'ana.tecnica@fieldops.com';

INSERT INTO users (id, name, email, password_hash, role, status, phone, created_at, updated_at, version)
SELECT '11111111-1111-4111-8111-111111111104', 'Ana Ribeiro Técnica', 'ana.tecnica@fieldops.com',
       '$2a$12$Ya4XJrJLZlIrj7GpzApLae45xpTNBzeFNrQc8a85bAzpQ8HoNBAgy', 'TECHNICIAN', 'ACTIVE', '+5511990000004',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = 'ana.tecnica@fieldops.com');

-- ----------------------------------------------------------------------------
-- 2. Cliente (1) com 2 Locais Distintos (RF-01)
-- ----------------------------------------------------------------------------
UPDATE clients
   SET name = 'Indústria Alfa',
       legal_name = 'Indústria Alfa S.A.',
       document = '12.345.678/0001-90',
       email = 'operacoes@alfa.com.br',
       phone = '+551533334400',
       status = 'ACTIVE',
       active = TRUE,
       updated_at = CURRENT_TIMESTAMP
 WHERE code = 'CLI-ALFA';

INSERT INTO clients (id, code, name, legal_name, document, email, phone, status, active, created_at, updated_at, version)
SELECT '22222222-2222-4222-8222-222222222201', 'CLI-ALFA', 'Indústria Alfa', 'Indústria Alfa S.A.',
       '12.345.678/0001-90', 'operacoes@alfa.com.br', '+551533334400', 'ACTIVE', TRUE,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM clients WHERE code = 'CLI-ALFA');

-- Local 1: Planta Sorocaba
UPDATE sites
   SET client_id = (SELECT id FROM clients WHERE code = 'CLI-ALFA' LIMIT 1),
       name = 'Planta Sorocaba',
       description = 'Unidade fabril principal com subestação e utilidades.',
       address_line = 'Av. Industrial, 1200',
       city = 'Sorocaba',
       state = 'SP',
       postal_code = '18010-000',
       latitude = -23.5015300,
       longitude = -47.4525600,
       contact_name = 'Marcos Silva',
       contact_phone = '+5515999991111',
       status = 'ACTIVE',
       active = TRUE,
       updated_at = CURRENT_TIMESTAMP
 WHERE code = 'SITE-SOR-01';

INSERT INTO sites (id, client_id, code, name, description, address_line, city, state, postal_code, latitude, longitude, contact_name, contact_phone, status, active, created_at, updated_at, version)
SELECT '33333333-3333-4333-8333-333333333301',
       (SELECT id FROM clients WHERE code = 'CLI-ALFA' LIMIT 1),
       'SITE-SOR-01', 'Planta Sorocaba', 'Unidade fabril principal com subestação e utilidades.',
       'Av. Industrial, 1200', 'Sorocaba', 'SP', '18010-000', -23.5015300, -47.4525600,
       'Marcos Silva', '+5515999991111', 'ACTIVE', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'SITE-SOR-01');

-- Local 2: Centro de Distribuição Campinas
UPDATE sites
   SET client_id = (SELECT id FROM clients WHERE code = 'CLI-ALFA' LIMIT 1),
       name = 'Centro de Distribuição Campinas',
       description = 'Armazém refrigerado e docas de expedição.',
       address_line = 'Rod. Anhanguera, Km 98',
       city = 'Campinas',
       state = 'SP',
       postal_code = '13050-000',
       latitude = -22.9055600,
       longitude = -47.0608300,
       contact_name = 'Juliana Costa',
       contact_phone = '+5519999992222',
       status = 'ACTIVE',
       active = TRUE,
       updated_at = CURRENT_TIMESTAMP
 WHERE code = 'SITE-CMP-01';

INSERT INTO sites (id, client_id, code, name, description, address_line, city, state, postal_code, latitude, longitude, contact_name, contact_phone, status, active, created_at, updated_at, version)
SELECT '33333333-3333-4333-8333-333333333302',
       (SELECT id FROM clients WHERE code = 'CLI-ALFA' LIMIT 1),
       'SITE-CMP-01', 'Centro de Distribuição Campinas', 'Armazém refrigerado e docas de expedição.',
       'Rod. Anhanguera, Km 98', 'Campinas', 'SP', '13050-000', -22.9055600, -47.0608300,
       'Juliana Costa', '+5519999992222', 'ACTIVE', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM sites WHERE code = 'SITE-CMP-01');

-- ----------------------------------------------------------------------------
-- 3. Equipamentos (3) com Códigos e QR Codes Únicos (RF-01)
-- ----------------------------------------------------------------------------
UPDATE equipments
   SET site_id = (SELECT id FROM sites WHERE code = 'SITE-SOR-01' LIMIT 1),
       code = 'EQP-GD-001',
       name = 'Gerador Diesel GD-001',
       asset_number = 'PAT-2026-0001',
       serial_number = 'SN-CAT-9001',
       manufacturer = 'Caterpillar',
       model = 'C15-500kVA',
       description = 'Grupo gerador principal de emergência da Planta Sorocaba.',
       status = 'ACTIVE',
       active = TRUE,
       installed_at = DATE '2025-03-10',
       updated_at = CURRENT_TIMESTAMP
 WHERE qr_code = 'QR-FIELDOPS-GD001';

INSERT INTO equipments (id, site_id, code, name, asset_number, serial_number, manufacturer, model, description, qr_code, status, active, installed_at, created_at, updated_at, version)
SELECT '44444444-4444-4444-8444-444444444401',
       (SELECT id FROM sites WHERE code = 'SITE-SOR-01' LIMIT 1),
       'EQP-GD-001', 'Gerador Diesel GD-001', 'PAT-2026-0001', 'SN-CAT-9001', 'Caterpillar', 'C15-500kVA',
       'Grupo gerador principal de emergência da Planta Sorocaba.', 'QR-FIELDOPS-GD001',
       'ACTIVE', TRUE, DATE '2025-03-10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE qr_code = 'QR-FIELDOPS-GD001');

UPDATE equipments
   SET site_id = (SELECT id FROM sites WHERE code = 'SITE-SOR-01' LIMIT 1),
       code = 'EQP-CP-002',
       name = 'Compressor Parafuso CP-002',
       asset_number = 'PAT-2026-0002',
       serial_number = 'SN-ATL-8821',
       manufacturer = 'Atlas Copco',
       model = 'GA 55+',
       description = 'Compressor de ar comprimido da linha de utilidades.',
       status = 'ACTIVE',
       active = TRUE,
       installed_at = DATE '2025-06-20',
       updated_at = CURRENT_TIMESTAMP
 WHERE qr_code = 'QR-FIELDOPS-CP002';

INSERT INTO equipments (id, site_id, code, name, asset_number, serial_number, manufacturer, model, description, qr_code, status, active, installed_at, created_at, updated_at, version)
SELECT '44444444-4444-4444-8444-444444444402',
       (SELECT id FROM sites WHERE code = 'SITE-SOR-01' LIMIT 1),
       'EQP-CP-002', 'Compressor Parafuso CP-002', 'PAT-2026-0002', 'SN-ATL-8821', 'Atlas Copco', 'GA 55+',
       'Compressor de ar comprimido da linha de utilidades.', 'QR-FIELDOPS-CP002',
       'ACTIVE', TRUE, DATE '2025-06-20', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE qr_code = 'QR-FIELDOPS-CP002');

UPDATE equipments
   SET site_id = (SELECT id FROM sites WHERE code = 'SITE-CMP-01' LIMIT 1),
       code = 'EQP-TR-003',
       name = 'Transformador Subestação TR-003',
       asset_number = 'PAT-2026-0003',
       serial_number = 'SN-WEG-4410',
       manufacturer = 'WEG',
       model = '1500kVA-13.8kV',
       description = 'Transformador rebaixador da subestação de Campinas.',
       status = 'ACTIVE',
       active = TRUE,
       installed_at = DATE '2024-11-05',
       updated_at = CURRENT_TIMESTAMP
 WHERE qr_code = 'QR-FIELDOPS-TR003';

INSERT INTO equipments (id, site_id, code, name, asset_number, serial_number, manufacturer, model, description, qr_code, status, active, installed_at, created_at, updated_at, version)
SELECT '44444444-4444-4444-8444-444444444403',
       (SELECT id FROM sites WHERE code = 'SITE-CMP-01' LIMIT 1),
       'EQP-TR-003', 'Transformador Subestação TR-003', 'PAT-2026-0003', 'SN-WEG-4410', 'WEG', '1500kVA-13.8kV',
       'Transformador rebaixador da subestação de Campinas.', 'QR-FIELDOPS-TR003',
       'ACTIVE', TRUE, DATE '2024-11-05', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM equipments WHERE qr_code = 'QR-FIELDOPS-TR003');

-- ----------------------------------------------------------------------------
-- 4. Modelo de Inspeção Publicado Completo (Todos os tipos de resposta)
-- ----------------------------------------------------------------------------
UPDATE inspection_templates
   SET title = 'Checklist Preventivo de Gerador Diesel',
       description = 'Inspeção periódica de segurança, partida, níveis de fluidos e painel elétrico de grupos geradores.',
       category = 'MECANICA',
       status = 'PUBLISHED',
       active = TRUE,
       version = 1,
       current_version = 1,
       created_by = (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
       updated_at = CURRENT_TIMESTAMP
 WHERE code = 'TPL-GER-01';

INSERT INTO inspection_templates (id, code, title, description, category, status, active, version, current_version, created_by, created_at, updated_at, lock_version)
SELECT '55555555-5555-4555-8555-555555555501',
       'TPL-GER-01',
       'Checklist Preventivo de Gerador Diesel',
       'Inspeção periódica de segurança, partida, níveis de fluidos e painel elétrico de grupos geradores.',
       'MECANICA', 'PUBLISHED', TRUE, 1, 1,
       (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
 WHERE NOT EXISTS (SELECT 1 FROM inspection_templates WHERE code = 'TPL-GER-01');

UPDATE template_versions
   SET status = 'PUBLISHED',
       title_snapshot = 'Checklist Preventivo de Gerador Diesel',
       description_snapshot = 'Inspeção periódica de segurança, partida, níveis de fluidos e painel elétrico de grupos geradores.',
       category_snapshot = 'MECANICA',
       published_by = (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
       published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
       active_for_new_inspections = TRUE,
       updated_at = CURRENT_TIMESTAMP
 WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1)
   AND version_number = 1;

INSERT INTO template_versions (id, template_id, version_number, status, title_snapshot, description_snapshot, category_snapshot, published_by, published_at, active_for_new_inspections, created_at, updated_at)
SELECT '55555555-5555-4555-8555-555555555511',
       (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1),
       1, 'PUBLISHED',
       'Checklist Preventivo de Gerador Diesel',
       'Inspeção periódica de segurança, partida, níveis de fluidos e painel elétrico de grupos geradores.',
       'MECANICA',
       (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
       CURRENT_TIMESTAMP, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_versions
        WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1)
          AND version_number = 1
 );

-- Seção 1
INSERT INTO template_sections (id, template_version_id, title, description, order_index, created_at)
SELECT '66666666-6666-4666-8666-666666666601',
       (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1),
       'Inspeção Visual e Segurança',
       'Verificações iniciais antes da partida.',
       0, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_sections
        WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND order_index = 0
 );

-- Seção 2
INSERT INTO template_sections (id, template_version_id, title, description, order_index, created_at)
SELECT '66666666-6666-4666-8666-666666666602',
       (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1),
       'Medições e Evidências',
       'Leituras operacionais e registros obrigatórios.',
       1, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_sections
        WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND order_index = 1
 );

-- Itens da Seção 1 (CONFORMITY, BOOLEAN, SINGLE_CHOICE)
INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777701',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 0 LIMIT 1),
       'GER-01', 'Lacre e integridade externa do equipamento', 'Confirmar ausência de avarias na carenagem.',
       'CONFORMITY', TRUE, TRUE, TRUE, NULL, 0, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-01'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777702',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 0 LIMIT 1),
       'GER-02', 'Área ao redor livre de vazamentos de óleo ou combustível?', NULL,
       'BOOLEAN', TRUE, FALSE, FALSE, NULL, 1, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-02'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777703',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 0 LIMIT 1),
       'GER-03', 'Modo de operação selecionado no painel', NULL,
       'SINGLE_CHOICE', TRUE, FALSE, FALSE, CAST(JSON_ARRAY('Automático', 'Manual', 'Desligado') AS JSONB), 2, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-03'
 );

UPDATE template_items
   SET options_json = CAST(JSON_ARRAY('Automático', 'Manual', 'Desligado') AS JSONB)
 WHERE code = 'GER-03';

-- Itens da Seção 2 (NUMBER, DATE, PHOTO, TEXT_SHORT, TEXT_LONG)
INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777704',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 1 LIMIT 1),
       'GER-04', 'Horímetro atual (horas)', NULL,
       'NUMBER', TRUE, FALSE, FALSE, NULL, 0, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-04'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777705',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 1 LIMIT 1),
       'GER-05', 'Data da última troca de óleo', NULL,
       'DATE', FALSE, FALSE, FALSE, NULL, 1, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-05'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777706',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 1 LIMIT 1),
       'GER-06', 'Foto frontal do painel de controle', NULL,
       'PHOTO', TRUE, FALSE, FALSE, NULL, 2, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-06'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777707',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 1 LIMIT 1),
       'GER-07', 'Responsável local acompanhante', NULL,
       'TEXT_SHORT', FALSE, FALSE, FALSE, NULL, 3, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-07'
 );

INSERT INTO template_items (id, section_id, code, title, description, response_type, required, observation_required_on_failure, evidence_required_on_failure, options_json, order_index, created_at)
SELECT '77777777-7777-4777-8777-777777777708',
       (SELECT id FROM template_sections WHERE template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1) AND order_index = 1 LIMIT 1),
       'GER-08', 'Observações gerais de campo', NULL,
       'TEXT_LONG', FALSE, FALSE, FALSE, NULL, 4, CURRENT_TIMESTAMP
 WHERE NOT EXISTS (
       SELECT 1 FROM template_items ti
         JOIN template_sections ts ON ts.id = ti.section_id
        WHERE ts.template_version_id = (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1)
          AND ti.code = 'GER-08'
 );

-- ----------------------------------------------------------------------------
-- 5. Inspeção Atribuída de Demonstração pronta para download + Snapshots (RF-01)
-- ----------------------------------------------------------------------------
INSERT INTO inspections (
    id, template_id, template_version_id, template_version_number,
    client_id, site_id, equipment_id, technician_id, supervisor_id, created_by,
    title, instructions, priority, status, scheduled_for,
    created_at, updated_at, version, review_cycle
)
SELECT
    '88888888-8888-4888-8888-888888888801',
    (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1),
    (SELECT id FROM template_versions WHERE template_id = (SELECT id FROM inspection_templates WHERE code = 'TPL-GER-01' LIMIT 1) AND version_number = 1 LIMIT 1),
    1,
    (SELECT id FROM clients WHERE code = 'CLI-ALFA' LIMIT 1),
    (SELECT id FROM sites WHERE code = 'SITE-SOR-01' LIMIT 1),
    (SELECT id FROM equipments WHERE qr_code = 'QR-FIELDOPS-GD001' LIMIT 1),
    (SELECT id FROM users WHERE LOWER(email) = 'tecnico@fieldops.com' LIMIT 1),
    (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
    (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
    'Inspeção Preventiva — Gerador Diesel GD-001 (Demo E2E)',
    'Ler QR Code QR-FIELDOPS-GD001, responder todos os itens, anexar foto do painel e concluir mesmo em modo offline.',
    'ALTA',
    'ATRIBUÍDA',
    CURRENT_TIMESTAMP + INTERVAL '1' DAY,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    0,
    0;

INSERT INTO inspection_item_snapshots (
    id, inspection_id, source_template_item_id,
    section_title, section_description, section_order,
    item_code, item_title, item_description,
    response_type, required, observation_required_on_failure, evidence_required_on_failure,
    rules_json, options_json, item_order, created_at
)
VALUES
(
    '99999999-9999-4999-8999-999999999901',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-01' LIMIT 1),
    'Inspeção Visual e Segurança', 'Verificações iniciais antes da partida.', 0,
    'GER-01', 'Lacre e integridade externa do equipamento', 'Confirmar ausência de avarias na carenagem.',
    'CONFORMITY', TRUE, TRUE, TRUE,
    '{"observationRequiredOnFailure":true,"evidenceRequiredOnFailure":true}', NULL, 0, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999902',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-02' LIMIT 1),
    'Inspeção Visual e Segurança', 'Verificações iniciais antes da partida.', 0,
    'GER-02', 'Área ao redor livre de vazamentos de óleo ou combustível?', NULL,
    'BOOLEAN', TRUE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 1, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999903',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-03' LIMIT 1),
    'Inspeção Visual e Segurança', 'Verificações iniciais antes da partida.', 0,
    'GER-03', 'Modo de operação selecionado no painel', NULL,
    'SINGLE_CHOICE', TRUE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', CAST(JSON_ARRAY('Automático', 'Manual', 'Desligado') AS JSONB), 2, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999904',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-04' LIMIT 1),
    'Medições e Evidências', 'Leituras operacionais e registros obrigatórios.', 1,
    'GER-04', 'Horímetro atual (horas)', NULL,
    'NUMBER', TRUE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 0, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999905',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-05' LIMIT 1),
    'Medições e Evidências', 'Leituras operacionais e registros obrigatórios.', 1,
    'GER-05', 'Data da última troca de óleo', NULL,
    'DATE', FALSE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 1, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999906',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-06' LIMIT 1),
    'Medições e Evidências', 'Leituras operacionais e registros obrigatórios.', 1,
    'GER-06', 'Foto frontal do painel de controle', NULL,
    'PHOTO', TRUE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 2, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999907',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-07' LIMIT 1),
    'Medições e Evidências', 'Leituras operacionais e registros obrigatórios.', 1,
    'GER-07', 'Responsável local acompanhante', NULL,
    'TEXT_SHORT', FALSE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 3, CURRENT_TIMESTAMP
),
(
    '99999999-9999-4999-8999-999999999908',
    '88888888-8888-4888-8888-888888888801',
    (SELECT ti.id FROM template_items ti JOIN template_sections ts ON ts.id = ti.section_id JOIN template_versions tv ON tv.id = ts.template_version_id JOIN inspection_templates t ON t.id = tv.template_id WHERE t.code = 'TPL-GER-01' AND tv.version_number = 1 AND ti.code = 'GER-08' LIMIT 1),
    'Medições e Evidências', 'Leituras operacionais e registros obrigatórios.', 1,
    'GER-08', 'Observações gerais de campo', NULL,
    'TEXT_LONG', FALSE, FALSE, FALSE,
    '{"observationRequiredOnFailure":false,"evidenceRequiredOnFailure":false}', NULL, 4, CURRENT_TIMESTAMP
);

INSERT INTO audit_logs (
    id, inspection_id, actor_id, actor_email, action, entity_type, entity_id,
    previous_status, new_status, details, occurred_at
)
SELECT
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    '88888888-8888-4888-8888-888888888801',
    (SELECT id FROM users WHERE LOWER(email) = 'supervisor@fieldops.com' LIMIT 1),
    'supervisor@fieldops.com',
    'INSPECTION_CREATED',
    'INSPECTION',
    '88888888-8888-4888-8888-888888888801',
    NULL,
    'ATRIBUÍDA',
    'Inspeção de demonstração carregada pelo seed idempotente (R__demo_seed_data.sql).',
    CURRENT_TIMESTAMP;
