import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createTestSqliteDb } from '../inspections/sqliteTestDb';
import { runMigrations } from '../../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../../src/infrastructure/database/repositories/outboxRepository';
import { useAuthStore } from '../../../src/features/auth/store';
import {
  CRITICAL_PHOTO_REQUIRED_MESSAGE,
  NonConformityFormModal,
  NonConformityRepository,
  READ_ONLY_NON_CONFORMITY_MESSAGE,
  useNonConformityDraftStore,
  type NonConformity,
} from '../../../src/features/nonconformity';
import NonConformitiesScreen from '../../../src/app/(protected)/inspections/[inspectionId]/non-conformities';
import { loadInspectionDetails } from '../../../src/features/inspections/hooks/useInspectionDetails';
import { __resetMockRouter } from '../../mocks/expo-router.mjs';

describe('TASK-017 Passos 2-5: Repositório SQLite, Fluxo de Câmera e Tela Agrupada por Gravidade', () => {
  let db: SQLiteDatabase;
  let inspectionRepo: InspectionRepository;
  let outboxRepo: OutboxRepository;
  let ncRepo: NonConformityRepository;

  beforeEach(async () => {
    __resetMockRouter();
    useNonConformityDraftStore.getState().clearDraft();

    db = createTestSqliteDb();
    await runMigrations(db);
    inspectionRepo = new InspectionRepository(db);
    outboxRepo = new OutboxRepository(db);
    ncRepo = new NonConformityRepository({ db, inspectionRepo, outboxRepo });

    await inspectionRepo.create({
      id: 'insp-nc-1',
      remote_id: 'rem-nc-1',
      template_id: 'tmpl-1',
      client_name: 'Indústria Ômega',
      site_name: 'Unidade Norte',
      equipment_name: 'Compressor C-10',
      equipment_code: 'CMP-10',
      status: 'EM_ANDAMENTO',
      priority: 'ALTA',
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-1',
      technician_name: 'Ana Técnica',
    });

    await db.runAsync(
      'INSERT INTO checklist_sections (id, inspection_id, title, order_index) VALUES (?, ?, ?, ?);',
      ['sec-nc-1', 'insp-nc-1', 'Sistema Pneumático', 0]
    );
    await db.runAsync(
      `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['item-nc-1', 'sec-nc-1', 'insp-nc-1', 'Mangueira de alta pressão', 'CONFORMITY', 1, 0]
    );

    useAuthStore.setState({
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: 'tech-1',
        name: 'Ana Técnica',
        email: 'ana@fieldops.com',
        role: 'TECHNICIAN',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    useNonConformityDraftStore.getState().clearDraft();
    await db.closeAsync();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    });
  });

  test('CA-01 / CA-03: cria não conformidades no SQLite, gera outbox CREATE_NON_CONFORMITY e agrupa por gravidade decrescente', async () => {
    const lowRes = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Pintura descascando na carenagem',
      severity: 'BAIXA',
      technicianId: 'tech-1',
    });
    assert.equal(lowRes.success, true);

    const critRes = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      item_id: 'item-nc-1',
      title: 'Rompimento parcial na mangueira',
      description: 'Fissura longitudinal detectada sob pressão nominal de 8 bar.',
      severity: 'CRITICA',
      evidence_uris: ['file:///documents/evidences/crit-1.jpg'],
      evidence_ids: ['ev-crit-1'],
      technicianId: 'tech-1',
    });
    assert.equal(critRes.success, true);
    assert.ok(critRes.outboxOperationId);

    const highRes = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Válvula de alívio travada',
      description: 'Válvula não respondeu ao teste manual de despressurização.',
      severity: 'ALTA',
      evidence_uris: ['file:///documents/evidences/high-1.jpg'],
      technicianId: 'tech-1',
    });
    assert.equal(highRes.success, true);

    const grouped = await ncRepo.findGroupedBySeverity('insp-nc-1');
    assert.deepEqual(
      grouped.map((g) => g.severity),
      ['CRITICA', 'ALTA', 'BAIXA']
    );
    assert.equal(grouped[0].items[0].item_title, 'Mangueira de alta pressão');

    const outboxOps = await outboxRepo.findByEntity('NON_CONFORMITY', critRes.nonConformity!.id);
    assert.equal(outboxOps.length, 1);
    assert.equal(outboxOps[0].operation_type, 'CREATE_NON_CONFORMITY');
  });

  test('CA-02 / EX-01 / EX-02: bloqueia CRITICA sem foto no repositório e bloqueia edição em inspeção APROVADA', async () => {
    const invalidCrit = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Falha crítica sem foto',
      description: 'Descrição longa o suficiente com mais de dez caracteres.',
      severity: 'CRITICA',
      evidence_uris: [],
      technicianId: 'tech-1',
    });
    assert.equal(invalidCrit.success, false);
    assert.equal(invalidCrit.code, 'VALIDATION_ERROR');
    assert.equal(invalidCrit.message, CRITICAL_PHOTO_REQUIRED_MESSAGE);

    const validMed = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Ruído leve no rolamento',
      severity: 'MEDIA',
      technicianId: 'tech-1',
    });
    assert.equal(validMed.success, true);

    await inspectionRepo.update('insp-nc-1', { status: 'APROVADA' });

    const blockedUpdate = await ncRepo.update(validMed.nonConformity!.id, {
      title: 'Tentativa após aprovação',
      technicianId: 'tech-1',
    });
    assert.equal(blockedUpdate.success, false);
    assert.equal(blockedUpdate.code, 'READ_ONLY_INSPECTION');
    assert.equal(blockedUpdate.message, READ_ONLY_NON_CONFORMITY_MESSAGE);
  });

  test('RT-03: exclui fisicamente antes do envio e converte em CANCELED com CANCEL_NON_CONFORMITY após sincronizada', async () => {
    const localOnly = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Apontamento ainda não enviado',
      severity: 'BAIXA',
      technicianId: 'tech-1',
    });
    const delLocal = await ncRepo.deleteOrCancel(localOnly.nonConformity!.id, {
      technicianId: 'tech-1',
    });
    assert.equal(delLocal.success, true);
    assert.equal(delLocal.code, 'DELETED');
    assert.equal(await ncRepo.findById(localOnly.nonConformity!.id), null);

    const syncedNc = await ncRepo.create({
      inspection_id: 'insp-nc-1',
      title: 'Apontamento já sincronizado',
      severity: 'MEDIA',
      technicianId: 'tech-1',
    });
    await db.runAsync(
      "UPDATE non_conformities SET sync_status = 'SINCRONIZADO', remote_id = 'rem-nc-item-1' WHERE id = ?;",
      [syncedNc.nonConformity!.id]
    );

    const cancelAudit = await ncRepo.deleteOrCancel(syncedNc.nonConformity!.id, {
      technicianId: 'tech-1',
      reason: 'Registro duplicado em campo',
    });
    assert.equal(cancelAudit.success, true);
    assert.equal(cancelAudit.code, 'CANCELED_AUDIT');
    assert.equal(cancelAudit.audited, true);
    assert.equal(cancelAudit.nonConformity?.status, 'CANCELED');

    const ops = await outboxRepo.findByEntity('NON_CONFORMITY', syncedNc.nonConformity!.id);
    assert.ok(ops.some((op) => op.operation_type === 'CANCEL_NON_CONFORMITY'));
  });

  test('Passo 4: useNonConformityDraftStore preserva rascunho e anexa foto capturada da câmera', () => {
    const store = useNonConformityDraftStore.getState();
    store.saveDraft({
      inspectionId: 'insp-nc-1',
      editingNonConformityId: null,
      itemId: 'item-nc-1',
      itemTitle: 'Mangueira de alta pressão',
      title: 'Vazamento na conexão',
      description: 'Vazamento contínuo observado sob carga.',
      severity: 'CRITICA',
      evidenceUris: [],
      evidenceIds: [],
      returnRoute: 'non-conformities',
    });

    store.appendCapturedEvidence(
      'insp-nc-1',
      'file:///documents/evidences/cam-001.jpg',
      'cam-uuid-001'
    );

    const restored = store.consumeDraft('insp-nc-1', 'non-conformities');
    assert.ok(restored);
    assert.equal(restored.readyToRestore, true);
    assert.equal(restored.severity, 'CRITICA');
    assert.deepEqual(restored.evidenceUris, ['file:///documents/evidences/cam-001.jpg']);
    assert.deepEqual(restored.evidenceIds, ['cam-uuid-001']);
    assert.equal(store.consumeDraft('insp-nc-1'), null);
  });

  test('Passos 3 & 5: renderização SSR do modal crítico e da tela non-conformities.tsx agrupada por gravidade', async () => {
    const modalHtml = renderToStaticMarkup(
      React.createElement(NonConformityFormModal, {
        visible: true,
        inspectionId: 'insp-nc-1',
        itemId: 'item-nc-1',
        itemTitle: 'Mangueira de alta pressão',
        initialSeverity: 'CRITICA',
        initialTitle: 'Ruptura de mangueira',
        initialDescription: 'Pressão caindo rapidamente com vazamento visível.',
        initialEvidenceUris: [],
        onClose: () => {},
        onSubmit: () => {},
        onAttachPhoto: () => {},
      })
    );
    assert.match(modalHtml, /Itens críticos exigem ao menos uma fotografia como evidência/);
    assert.match(modalHtml, /Capturar Fotografia de Evidência/);

    const loaded = await loadInspectionDetails({
      inspectionId: 'insp-nc-1',
      technicianId: 'tech-1',
      userRole: 'TECHNICIAN',
      inspectionRepository: inspectionRepo,
    });
    const ncCrit: NonConformity = {
      id: 'nc-ssr-1',
      inspection_id: 'insp-nc-1',
      item_id: 'item-nc-1',
      item_title: 'Mangueira de alta pressão',
      title: 'Ruptura crítica na mangueira',
      description: 'Vazamento severo com risco de acidente.',
      severity: 'CRITICA',
      status: 'OPEN',
      evidence_uris: ['file:///documents/evidences/crit.jpg'],
      evidence_ids: ['ev-1'],
      sync_status: 'PENDENTE',
      created_at: '2026-11-22T12:00:00.000Z',
      updated_at: '2026-11-22T12:00:00.000Z',
    };
    const ncLow: NonConformity = {
      id: 'nc-ssr-2',
      inspection_id: 'insp-nc-1',
      item_id: null,
      item_title: null,
      title: 'Pintura arranhada na base',
      description: '',
      severity: 'BAIXA',
      status: 'OPEN',
      evidence_uris: [],
      evidence_ids: [],
      sync_status: 'SINCRONIZADO',
      created_at: '2026-11-22T12:05:00.000Z',
      updated_at: '2026-11-22T12:05:00.000Z',
    };

    const screenHtml = renderToStaticMarkup(
      React.createElement(NonConformitiesScreen, {
        inspectionId: 'insp-nc-1',
        detailsOptions: {
          autoLoad: false,
          initialData: {
            ...loaded,
            isLoading: false,
            notFound: false,
            isForbidden: false,
          },
        },
        initialCounts: {
          total: 2,
          open: 2,
          critical: 1,
          high: 0,
          medium: 0,
          low: 1,
          pendingSync: 1,
        },
        initialGroups: [
          {
            severity: 'CRITICA',
            meta: {
              severity: 'CRITICA',
              label: 'Crítica',
              shortLabel: 'Crítica',
              description: 'Risco severo/imediato • Exige descrição detalhada e foto',
              accentColor: '#DC2626',
              badgeBg: '#FEE2E2',
              badgeBorder: '#EF4444',
              badgeText: '#991B1B',
              icon: 'gpp-bad',
              requiresDetailedDescription: true,
              requiresPhotoEvidence: true,
              orderWeight: 4,
            },
            items: [ncCrit],
          },
          {
            severity: 'BAIXA',
            meta: {
              severity: 'BAIXA',
              label: 'Baixa',
              shortLabel: 'Baixa',
              description: 'Desvio leve sem impacto imediato',
              accentColor: '#0284C7',
              badgeBg: '#E0F2FE',
              badgeBorder: '#7DD3FC',
              badgeText: '#0369A1',
              icon: 'info-outline',
              requiresDetailedDescription: false,
              requiresPhotoEvidence: false,
              orderWeight: 1,
            },
            items: [ncLow],
          },
        ],
      })
    );

    assert.match(screenHtml, /Gravidade CRÍTICA/);
    assert.match(screenHtml, /Gravidade BAIXA/);
    assert.match(screenHtml, /Ruptura crítica na mangueira/);
    assert.match(screenHtml, /Pintura arranhada na base/);
  });
});
