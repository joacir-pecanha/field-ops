import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SQLiteDatabase } from 'expo-sqlite';
import './InspectionCard.test';
import './InspectionScreens.test';
import { createTestSqliteDb } from './sqliteTestDb';
import { runMigrations } from '../../../src/infrastructure/database/migrations';
import {
  InspectionRepository,
  resolveInspectionAction,
} from '../../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../../src/infrastructure/database/repositories/outboxRepository';
import {
  EMPTY_INSPECTIONS_MESSAGE,
  OFFLINE_REFRESH_SNACKBAR_MESSAGE,
  loadInspectionsFromLocal,
  refreshInspectionsFromRemote,
} from '../../../src/features/inspections/hooks/useInspectionList';
import {
  PERMISSION_DENIED_MESSAGE,
  loadInspectionDetails,
  refreshInspectionDetails,
} from '../../../src/features/inspections/hooks/useInspectionDetails';
import { NetworkMonitor } from '../../../src/infrastructure/sync/networkMonitor';

const REF_DATE = new Date('2026-11-14T12:00:00.000Z');

describe('InspectionRepository Queries, Hooks List & Details (TASK-013 Passos 1 e 2)', () => {
  let db: SQLiteDatabase;
  let inspectionRepo: InspectionRepository;
  let outboxRepo: OutboxRepository;
  let networkMonitor: NetworkMonitor;

  beforeEach(async () => {
    db = createTestSqliteDb();
    await runMigrations(db);
    inspectionRepo = new InspectionRepository(db);
    outboxRepo = new OutboxRepository(db);
    networkMonitor = new NetworkMonitor({ initialOnline: true });
    networkMonitor.setMockStatus(true);
  });

  async function seedSampleInspections() {
    await inspectionRepo.create({
      id: 'insp-1',
      remote_id: 'rem-1',
      template_id: 'tmpl-1',
      client_name: 'Indústria Alfa',
      site_name: 'Unidade Leste',
      site_address: 'Rua das Torres, 100 - Campinas/SP',
      equipment_name: 'Gerador G1',
      equipment_code: 'GEN-001',
      equipment_qr_code: 'QR-GEN-001',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      due_date: '2026-11-10T10:00:00.000Z', // Atrasada em relação a REF_DATE
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-1',
    });

    await inspectionRepo.create({
      id: 'insp-2',
      remote_id: 'rem-2',
      template_id: 'tmpl-1',
      client_name: 'Comercial Beta',
      site_name: 'Centro Logístico',
      site_address: 'Av. Brasil, 2000 - São Paulo/SP',
      equipment_name: 'Empilhadeira E2',
      equipment_code: 'EMP-002',
      equipment_qr_code: 'QR-EMP-002',
      status: 'EM_ANDAMENTO',
      priority: 'CRITICA',
      due_date: '2026-11-14T18:00:00.000Z', // Hoje
      sync_status: 'PENDENTE',
      technician_id: 'tech-1',
    });

    await inspectionRepo.create({
      id: 'insp-3',
      remote_id: 'rem-3',
      template_id: 'tmpl-2',
      client_name: 'Hospital Gama',
      site_name: 'Bloco B',
      site_address: 'Av. Saúde, 45 - Curitiba/PR',
      equipment_name: 'Nobreak N3',
      equipment_code: 'NBK-003',
      equipment_qr_code: 'QR-NBK-003',
      status: 'ENVIADA',
      priority: 'MEDIA',
      due_date: '2026-11-12T09:00:00.000Z',
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-1',
    });

    await inspectionRepo.create({
      id: 'insp-other',
      remote_id: 'rem-other',
      template_id: 'tmpl-2',
      client_name: 'Empresa Restrita',
      site_name: 'Filial Norte',
      equipment_name: 'Caldeira C9',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      due_date: '2026-11-15T10:00:00.000Z',
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-2',
    });
  }

  describe('Passo 1: Consultas Tipadas em InspectionRepository', () => {
    test('CA-01 & RF-01: findWithFilters ordena por data prevista e restringe ao técnico autenticado', async () => {
      await seedSampleInspections();

      const tech1All = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', status: 'TODAS' },
        REF_DATE
      );

      assert.equal(tech1All.length, 3);
      assert.deepEqual(
        tech1All.map((i) => i.id),
        ['insp-1', 'insp-3', 'insp-2']
      );
    });

    test('RF-04: findWithFilters aplica filtros de aba (PENDENTES, EM_ANDAMENTO, CONCLUÍDAS) e busca textual', async () => {
      await seedSampleInspections();

      const pendentes = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', status: 'PENDENTES' },
        REF_DATE
      );
      assert.deepEqual(
        pendentes.map((i) => i.id),
        ['insp-1']
      );

      const emAndamento = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', status: 'EM_ANDAMENTO' },
        REF_DATE
      );
      assert.deepEqual(
        emAndamento.map((i) => i.id),
        ['insp-2']
      );

      const concluidas = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', status: 'CONCLUÍDAS' },
        REF_DATE
      );
      assert.deepEqual(
        concluidas.map((i) => i.id),
        ['insp-3']
      );

      const byCode = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', searchQuery: 'EMP-002' },
        REF_DATE
      );
      assert.equal(byCode.length, 1);
      assert.equal(byCode[0].id, 'insp-2');

      const byAddress = await inspectionRepo.findWithFilters(
        { technicianId: 'tech-1', searchQuery: 'Campinas' },
        REF_DATE
      );
      assert.equal(byAddress.length, 1);
      assert.equal(byAddress[0].id, 'insp-1');
    });

    test('getSummaryMetrics calcula corretamente totais, hoje, atrasadas e pendentes de sincronização', async () => {
      await seedSampleInspections();
      await outboxRepo.create({
        id: 'op-sync-1',
        entity_type: 'INSPECTION',
        global_id: 'insp-2',
        operation_type: 'START_INSPECTION',
        payload: '{}',
        status: 'PENDING',
      });

      const metrics = await inspectionRepo.getSummaryMetrics('tech-1', REF_DATE);
      assert.equal(metrics.total, 3);
      assert.equal(metrics.today, 1);
      assert.equal(metrics.overdue, 1);
      assert.equal(metrics.delayed, 1);
      assert.equal(metrics.inProgress, 1);
      assert.equal(metrics.pending, 1);
      assert.equal(metrics.completed, 1);
      assert.equal(metrics.pendingSync, 1);
    });

    test('findByIdWithDetails carrega seções, itens, respostas, progresso e ação dinâmica', async () => {
      await seedSampleInspections();

      await db.runAsync(
        `INSERT INTO checklist_sections (id, inspection_id, title, order_index) VALUES (?, ?, ?, ?);`,
        ['sec-1', 'insp-2', 'Inspeção Visual', 0]
      );
      await db.runAsync(
        `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?);`,
        [
          'item-1',
          'sec-1',
          'insp-2',
          'Nível de óleo',
          'CONFORMITY',
          1,
          0,
          'item-2',
          'sec-1',
          'insp-2',
          'Observações gerais',
          'TEXT_SHORT',
          0,
          1,
        ]
      );
      await db.runAsync(
        `INSERT INTO checklist_responses (id, item_id, inspection_id, value, is_non_conformity, responded_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        ['resp-1', 'item-1', 'insp-2', 'NON_CONFORMING', 1, '2026-11-14T10:00:00.000Z']
      );

      const details = await inspectionRepo.findByIdWithDetails('insp-2', REF_DATE);
      assert.ok(details);
      assert.equal(details.sections.length, 1);
      assert.equal(details.items.length, 2);
      assert.equal(details.responses.length, 1);
      assert.equal(details.progress.totalItems, 2);
      assert.equal(details.progress.answeredItems, 1);
      assert.equal(details.progress.requiredItems, 1);
      assert.equal(details.progress.pendingRequiredItems, 0);
      assert.equal(details.progress.nonConformitiesCount, 1);
      assert.equal(details.progress.percentage, 50);
      assert.equal(details.isPendingSync, true);
      assert.equal(details.action.type, 'CONTINUE');
      assert.equal(details.action.label, 'Continuar Checklist');
    });

    test('CA-03: resolveInspectionAction altera ação entre Iniciar, Continuar e Consultar', () => {
      const start = resolveInspectionAction('ATRIBUÍDA');
      assert.equal(start.label, 'Iniciar Inspeção');
      assert.equal(start.shortLabel, 'Iniciar');
      assert.equal(start.isReadOnly, false);

      const cont = resolveInspectionAction('EM_ANDAMENTO');
      assert.equal(cont.label, 'Continuar Checklist');
      assert.equal(cont.shortLabel, 'Continuar');
      assert.equal(cont.isReadOnly, false);

      const view = resolveInspectionAction('ENVIADA');
      assert.equal(view.label, 'Consultar');
      assert.equal(view.shortLabel, 'Consultar');
      assert.equal(view.isReadOnly, true);
    });

    test('RT-03: upsertMany preserva inspeções com alterações locais pendentes na Outbox', async () => {
      await seedSampleInspections();
      await outboxRepo.create({
        id: 'op-local-progress',
        entity_type: 'INSPECTION',
        global_id: 'insp-2',
        operation_type: 'START_INSPECTION',
        payload: '{}',
        status: 'PENDING',
      });

      await inspectionRepo.upsertMany([
        {
          id: 'insp-1',
          remote_id: 'rem-1',
          template_id: 'tmpl-1',
          client_name: 'Indústria Alfa Atualizada',
          site_name: 'Unidade Leste',
          equipment_name: 'Gerador G1',
          status: 'ATRIBUÍDA',
          sync_status: 'SINCRONIZADO',
        },
        {
          id: 'insp-2',
          remote_id: 'rem-2',
          template_id: 'tmpl-1',
          client_name: 'Sobrescrita Indevida',
          site_name: 'Centro Logístico',
          equipment_name: 'Empilhadeira E2',
          status: 'ATRIBUÍDA', // Backend desatualizado não deve reverter EM_ANDAMENTO local pendente
          sync_status: 'SINCRONIZADO',
        },
      ]);

      const insp1 = await inspectionRepo.findById('insp-1');
      const insp2 = await inspectionRepo.findById('insp-2');
      assert.equal(insp1?.client_name, 'Indústria Alfa Atualizada');
      assert.equal(insp2?.status, 'EM_ANDAMENTO');
      assert.equal(insp2?.client_name, 'Comercial Beta');
    });

    test('syncRemoteSnapshots persiste seções/itens do backend e normaliza PHOTO para CHECK constraint v1', async () => {
      const result = await refreshInspectionsFromRemote({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor,
        referenceDate: REF_DATE,
        fetchRemoteAssigned: async () => [
          {
            id: 'rem-snap-1',
            templateId: 'tmpl-ger',
            clientName: 'Indústria Alfa',
            siteName: 'Planta Sorocaba',
            siteAddress: 'Av. Industrial, 1200',
            equipmentName: 'Gerador Diesel GD-001',
            equipmentCode: 'EQP-GD-001',
            equipmentQrCode: 'QR-FIELDOPS-GD001',
            status: 'ATRIBUÍDA',
            priority: 'ALTA',
            scheduledFor: '2026-11-20T09:00:00.000Z',
            technicianId: 'tech-1',
            items: [
              {
                id: 'snap-item-1',
                sectionTitle: 'Inspeção Visual',
                sectionOrder: 0,
                itemTitle: 'Integridade da carenagem',
                responseType: 'CONFORMITY',
                required: true,
                itemOrder: 0,
              },
              {
                id: 'snap-item-2',
                sectionTitle: 'Inspeção Visual',
                sectionOrder: 0,
                itemTitle: 'Modo de operação',
                responseType: 'SINGLE_CHOICE',
                options: ['Automático', 'Manual'],
                required: true,
                itemOrder: 1,
              },
              {
                id: 'snap-item-3',
                sectionTitle: 'Evidências',
                sectionOrder: 1,
                itemTitle: 'Foto do painel frontal',
                responseType: 'PHOTO',
                required: true,
                itemOrder: 0,
              },
            ],
          },
        ],
      });

      assert.equal(result.refreshedFromNetwork, true);

      const details = await inspectionRepo.findByIdWithDetails('rem-snap-1', REF_DATE);
      assert.ok(details);
      assert.equal(details.sections.length, 2);
      assert.equal(details.sections[0].title, 'Inspeção Visual');
      assert.equal(details.sections[1].title, 'Evidências');
      assert.equal(details.items.length, 3);
      assert.equal(details.progress.totalItems, 3);
      assert.equal(details.progress.requiredItems, 3);

      const choiceItem = details.items.find((i) => i.id === 'snap-item-2');
      assert.equal(choiceItem?.options_json, '["Automático","Manual"]');

      const photoNormalized = details.items.find((i) => i.id === 'snap-item-3');
      assert.equal(photoNormalized?.response_type, 'TEXT_SHORT');
    });
  });

  describe('Passo 2: Hook useInspectionList (Consulta Local e Refresh Resiliente)', () => {
    test('RT-02: Estado vazio retorna mensagem amigável sem erro', async () => {
      const result = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      assert.equal(result.isEmpty, true);
      assert.equal(result.emptyMessage, EMPTY_INSPECTIONS_MESSAGE);
      assert.equal(result.items.length, 0);
    });

    test('RF-06 & RT-01: Carrega inspeções 100% offline do SQLite sem depender da rede', async () => {
      await seedSampleInspections();
      networkMonitor.setMockStatus(false);

      const result = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        statusFilter: 'TODAS',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      assert.equal(result.isEmpty, false);
      assert.equal(result.items.length, 3);
      assert.equal(result.items[0].isOverdue, true);
      assert.equal(result.items[2].isPendingSync, true);
    });

    test('EX-02 & RT-03: Falha no pull-to-refresh mantém dados locais intactos e exibe snackbar discreto', async () => {
      await seedSampleInspections();

      const failedRefresh = await refreshInspectionsFromRemote({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor,
        referenceDate: REF_DATE,
        fetchRemoteAssigned: async () => {
          throw new Error('ECONNREFUSED');
        },
      });

      assert.equal(failedRefresh.refreshedFromNetwork, false);
      assert.equal(failedRefresh.items.length, 3);
      assert.equal(failedRefresh.snackbar?.visible, true);
      assert.equal(failedRefresh.snackbar?.message, OFFLINE_REFRESH_SNACKBAR_MESSAGE);

      // Também quando offline diretamente
      networkMonitor.setMockStatus(false);
      const offlineRefresh = await refreshInspectionsFromRemote({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });
      assert.equal(offlineRefresh.refreshedFromNetwork, false);
      assert.equal(offlineRefresh.items.length, 3);
      assert.equal(offlineRefresh.snackbar?.visible, true);
    });

    test('Refresh online bem-sucedido persiste novas inspeções remotas no SQLite', async () => {
      const result = await refreshInspectionsFromRemote({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor,
        referenceDate: REF_DATE,
        fetchRemoteAssigned: async () => [
          {
            id: 'rem-100',
            templateId: 'tmpl-5',
            clientName: 'Cliente Remoto',
            siteName: 'Planta Sul',
            siteAddress: 'Rod. BR-101, Km 12',
            equipmentName: 'Compressor C5',
            equipmentCode: 'CMP-05',
            equipmentQrCode: 'QR-CMP-05',
            status: 'ATRIBUÍDA',
            priority: 'ALTA',
            scheduledFor: '2026-11-20T09:00:00.000Z',
            technicianId: 'tech-1',
          },
        ],
      });

      assert.equal(result.refreshedFromNetwork, true);
      assert.equal(result.snackbar, null);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].client_name, 'Cliente Remoto');
      assert.equal(result.items[0].equipment_qr_code, 'QR-CMP-05');
    });
  });

  describe('Passo 2: Hook useInspectionDetails (Detalhes Offline e Controle de Acesso)', () => {
    test('RF-05 & RF-06: Carrega equipamento, código, QR Code, endereço e ação dinâmica offline', async () => {
      await seedSampleInspections();
      networkMonitor.setMockStatus(false);

      const details = await loadInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      assert.equal(details.isForbidden, false);
      assert.equal(details.notFound, false);
      assert.equal(details.equipment?.name, 'Gerador G1');
      assert.equal(details.equipment?.code, 'GEN-001');
      assert.equal(details.equipment?.qrCode, 'QR-GEN-001');
      assert.equal(details.site?.address, 'Rua das Torres, 100 - Campinas/SP');
      assert.equal(details.action.label, 'Iniciar Inspeção');

      const inProgressDetails = await loadInspectionDetails({
        inspectionId: 'insp-2',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });
      assert.equal(inProgressDetails.action.label, 'Continuar Checklist');
    });

    test('EX-01: Impede acesso a inspeção de outro usuário e dispara aviso de permissão negada', async () => {
      await seedSampleInspections();
      let deniedMsg: string | null = null;

      const forbidden = await loadInspectionDetails({
        inspectionId: 'insp-other',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        onPermissionDenied: (msg) => {
          deniedMsg = msg;
        },
      });

      assert.equal(forbidden.isForbidden, true);
      assert.equal(forbidden.permissionDeniedMessage, PERMISSION_DENIED_MESSAGE);
      assert.equal(forbidden.inspection, null);
      assert.equal(deniedMsg, PERMISSION_DENIED_MESSAGE);

      let remoteDeniedMsg: string | null = null;
      const remoteForbidden = await loadInspectionDetails({
        inspectionId: 'insp-remote-403',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        fetchRemoteById: async () => {
          const err: any = new Error('Forbidden');
          err.status = 403;
          throw err;
        },
        onPermissionDenied: (msg) => {
          remoteDeniedMsg = msg;
        },
      });
      assert.equal(remoteForbidden.isForbidden, true);
      assert.equal(remoteForbidden.permissionDeniedMessage, PERMISSION_DENIED_MESSAGE);
      assert.equal(remoteDeniedMsg, PERMISSION_DENIED_MESSAGE);
    });

    test('EX-02 & RT-03: Falha no refresh de detalhes preserva dados do SQLite e exibe snackbar', async () => {
      await seedSampleInspections();

      const result = await refreshInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
        fetchRemoteById: async () => {
          throw new Error('Network timeout');
        },
      });

      assert.equal(result.isForbidden, false);
      assert.equal(result.inspection?.id, 'insp-1');
      assert.equal(result.snackbar?.visible, true);
      assert.equal(result.snackbar?.message, OFFLINE_REFRESH_SNACKBAR_MESSAGE);
    });
  });
});
