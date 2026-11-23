import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createTestSqliteDb } from './sqliteTestDb';
import { runMigrations } from '../../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../../src/infrastructure/database/repositories/outboxRepository';
import { NetworkMonitor } from '../../../src/infrastructure/sync/networkMonitor';
import { useAuthStore } from '@/features/auth/store';
import { useSyncStore } from '@/features/sync/useSyncStatus';
import {
  EMPTY_FILTERED_INSPECTIONS_MESSAGE,
  EMPTY_INSPECTIONS_MESSAGE,
  OFFLINE_REFRESH_SNACKBAR_MESSAGE,
  loadInspectionsFromLocal,
  refreshInspectionsFromRemote,
} from '../../../src/features/inspections/hooks/useInspectionList';
import {
  PERMISSION_DENIED_MESSAGE,
  loadInspectionDetails,
  refreshInspectionDetails,
  useInspectionDetails,
} from '../../../src/features/inspections/hooks/useInspectionDetails';
import HomeScreen from '../../../src/app/(protected)/(tabs)/index';
import InspectionsScreen from '../../../src/app/(protected)/(tabs)/inspections';
import InspectionDetailsScreen from '../../../src/app/(protected)/inspections/[inspectionId]/index';

const REF_DATE = new Date('2026-11-14T12:00:00.000Z');

describe('Telas de Inspeções Mobile — Renderização & Fluxos Offline (TASK-013 Passo 7)', () => {
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

    useAuthStore.setState({
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: 'tech-1',
        name: 'Ana Técnica',
        email: 'ana.tecnica@fieldops.com',
        role: 'TECHNICIAN',
        status: 'ACTIVE',
      },
    });

    useSyncStore.setState({
      pendingCount: 0,
      syncedCount: 0,
      errorCount: 0,
      isSyncing: false,
      isOnline: true,
      lastSyncAt: null,
      lastSyncResult: null,
      lastSyncMessage: null,
      operations: [],
    });
  });

  afterEach(async () => {
    await db.closeAsync();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
    });
  });

  async function seedScreensFixtureData() {
    await inspectionRepo.create({
      id: 'insp-1',
      remote_id: 'rem-1',
      template_id: 'tmpl-1',
      title: 'Manutenção Preventiva de Gerador',
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
      technician_name: 'Ana Técnica',
      instructions: 'Verificar nível de óleo e tensão das baterias antes da partida.',
    });

    await inspectionRepo.create({
      id: 'insp-2',
      remote_id: 'rem-2',
      template_id: 'tmpl-1',
      title: 'Inspeção Diária de Empilhadeira',
      client_name: 'Comercial Beta',
      site_name: 'Centro Logístico',
      site_address: 'Av. Brasil, 2000 - São Paulo/SP',
      equipment_name: 'Empilhadeira E2',
      equipment_code: 'EMP-002',
      equipment_qr_code: 'QR-EMP-002',
      status: 'EM_ANDAMENTO',
      priority: 'CRITICA',
      due_date: '2026-11-14T18:00:00.000Z', // Para hoje em REF_DATE
      sync_status: 'PENDENTE',
      technician_id: 'tech-1',
    });

    await inspectionRepo.create({
      id: 'insp-3',
      remote_id: 'rem-3',
      template_id: 'tmpl-2',
      title: 'Checklist de Nobreak Crítico',
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

    await db.runAsync(
      `INSERT INTO checklist_sections (id, inspection_id, title, order_index) VALUES (?, ?, ?, ?);`,
      ['sec-1', 'insp-1', 'Inspeção Visual', 0]
    );

    await db.runAsync(
      `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?);`,
      [
        'item-1',
        'sec-1',
        'insp-1',
        'Nível de óleo',
        'CONFORMITY',
        1,
        0,
        'item-2',
        'sec-1',
        'insp-1',
        'Observações gerais',
        'TEXT_SHORT',
        0,
        1,
      ]
    );

    await db.runAsync(
      `INSERT INTO checklist_responses (id, item_id, inspection_id, value, is_non_conformity, responded_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['resp-1', 'item-1', 'insp-1', 'NON_CONFORMING', 1, '2026-11-14T10:00:00.000Z']
    );

    await outboxRepo.create({
      id: 'op-pending-2',
      entity_type: 'INSPECTION',
      global_id: 'insp-2',
      operation_type: 'START_INSPECTION',
      payload: '{}',
      status: 'PENDING',
    });
  }

  describe('HomeScreen ((tabs)/index.tsx — Passo 4)', () => {
    test('1. Renderiza saudação, badge de rede, 4 contadores do SQLite, botão de sincronizar e cards prioritários', async () => {
      await seedScreensFixtureData();

      const localData = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      useSyncStore.setState({
        pendingCount: localData.metrics.pendingSync,
        isOnline: true,
      });

      const html = renderToStaticMarkup(
        React.createElement(HomeScreen, {
          user: { name: 'Ana Técnica' },
          listOptions: {
            autoLoad: false,
            initialData: {
              ...localData,
              isOnline: true,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('Olá, Ana'));
      assert.ok(html.includes('data-testid="home-network-badge"'));
      assert.ok(html.includes('Online'));

      // Contadores em tempo real (Para hoje=1, Atrasadas=1, Em andamento=1, Pendentes de envio=1)
      assert.ok(html.includes('data-testid="metric-today-card"'));
      assert.ok(html.includes('Para hoje'));
      assert.ok(html.includes('data-testid="metric-overdue-card"'));
      assert.ok(html.includes('Atrasadas'));
      assert.ok(html.includes('data-testid="metric-in-progress-card"'));
      assert.ok(html.includes('Em andamento'));
      assert.ok(html.includes('data-testid="metric-pending-sync-card"'));
      assert.ok(html.includes('Pendentes de envio'));

      // Botões de ação rápida
      assert.ok(html.includes('data-testid="home-sync-button"'));
      assert.ok(html.includes('Sincronizar Dados'));
      assert.ok(html.includes('Ver Todas as Inspeções (3)'));

      // Prioridades ativas (atrasada insp-1 e em andamento insp-2; concluída insp-3 e outro técnico não entram)
      assert.ok(html.includes('Indústria Alfa'));
      assert.ok(html.includes('Comercial Beta'));
      assert.ok(!html.includes('Empresa Restrita'));
    });

    test('2. RT-02: Renderiza estado vazio amigável quando SQLite local está sem inspeções', async () => {
      const emptyData = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(HomeScreen, {
          listOptions: {
            autoLoad: false,
            initialData: {
              ...emptyData,
              isOnline: true,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="home-empty-state"'));
      assert.ok(html.includes(EMPTY_INSPECTIONS_MESSAGE));
      assert.ok(html.includes('Ver Todas as Inspeções (0)'));
    });

    test('3. EX-02 & RT-03: Renderiza snackbar discreto preservando dados locais quando sincronização falha sem rede', async () => {
      await seedScreensFixtureData();
      networkMonitor.setMockStatus(false);

      const offlineRefresh = await refreshInspectionsFromRemote({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(HomeScreen, {
          listOptions: {
            autoLoad: false,
            initialData: {
              ...offlineRefresh,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="home-offline-snackbar"'));
      assert.ok(html.includes(OFFLINE_REFRESH_SNACKBAR_MESSAGE));
      assert.ok(html.includes('Offline'));
      assert.ok(html.includes('Indústria Alfa'));
      assert.ok(html.includes('Comercial Beta'));
    });
  });

  describe('InspectionsScreen ((tabs)/inspections.tsx — Passo 5)', () => {
    test('4. CA-01, RF-01..RF-06: Renderiza busca, abas com contadores, chips e lista ordenada do SQLite', async () => {
      await seedScreensFixtureData();

      const localData = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        statusFilter: 'TODAS',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(InspectionsScreen, {
          listOptions: {
            autoLoad: false,
            initialData: {
              ...localData,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      // Busca, abas e chips
      assert.ok(html.includes('data-testid="inspections-search-input"'));
      assert.ok(html.includes('data-testid="inspections-tab-TODAS"'));
      assert.ok(html.includes('Todas'));
      assert.ok(html.includes('data-testid="inspections-tab-PENDENTES"'));
      assert.ok(html.includes('Pendentes'));
      assert.ok(html.includes('data-testid="inspections-tab-EM_ANDAMENTO"'));
      assert.ok(html.includes('Em andamento'));
      assert.ok(html.includes('data-testid="inspections-tab-CONCLUÍDAS"'));
      assert.ok(html.includes('Concluídas'));
      assert.ok(html.includes('data-testid="inspections-chip-overdue"'));
      assert.ok(html.includes('Atrasadas (1)'));
      assert.ok(html.includes('data-testid="inspections-chip-today"'));
      assert.ok(html.includes('Para hoje (1)'));

      // Lista ordenada por due_date ASC (insp-1 -> insp-3 -> insp-2) e apenas tech-1
      const idx1 = html.indexOf('Indústria Alfa');
      const idx3 = html.indexOf('Hospital Gama');
      const idx2 = html.indexOf('Comercial Beta');
      assert.ok(idx1 !== -1 && idx3 !== -1 && idx2 !== -1);
      assert.ok(idx1 < idx3 && idx3 < idx2);
      assert.ok(!html.includes('Empresa Restrita'));

      // Diferenciação visual de status e pendência de envio
      assert.ok(html.includes('EM ATRASO'));
      assert.ok(html.includes('EM EXECUÇÃO'));
      assert.ok(html.includes('Pendente de envio'));

      // Filtro aplicado por aba EM_ANDAMENTO
      const filteredInProgress = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        statusFilter: 'EM_ANDAMENTO',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      const filteredHtml = renderToStaticMarkup(
        React.createElement(InspectionsScreen, {
          listOptions: {
            autoLoad: false,
            initialStatusFilter: 'EM_ANDAMENTO',
            initialData: {
              ...filteredInProgress,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(filteredHtml.includes('Comercial Beta'));
      assert.ok(!filteredHtml.includes('Indústria Alfa'));
    });

    test('5. RT-02 & RF-04: Renderiza estado vazio amigável no banco vazio e botão Limpar Filtros em filtro sem correspondência', async () => {
      const emptyData = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      const emptyHtml = renderToStaticMarkup(
        React.createElement(InspectionsScreen, {
          listOptions: {
            autoLoad: false,
            initialData: {
              ...emptyData,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(emptyHtml.includes('data-testid="inspections-empty-state"'));
      assert.ok(emptyHtml.includes(EMPTY_INSPECTIONS_MESSAGE));
      assert.ok(emptyHtml.includes('data-testid="inspections-refresh-btn"'));

      await seedScreensFixtureData();
      const noMatchFilter = await loadInspectionsFromLocal({
        technicianId: 'tech-1',
        searchQuery: 'EquipamentoInexistenteXYZ',
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        referenceDate: REF_DATE,
      });

      const noMatchHtml = renderToStaticMarkup(
        React.createElement(InspectionsScreen, {
          listOptions: {
            autoLoad: false,
            initialSearchQuery: 'EquipamentoInexistenteXYZ',
            initialData: {
              ...noMatchFilter,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(noMatchHtml.includes('data-testid="inspections-empty-state"'));
      assert.ok(noMatchHtml.includes(EMPTY_FILTERED_INSPECTIONS_MESSAGE));
      assert.ok(noMatchHtml.includes('data-testid="inspections-clear-filters-btn"'));
      assert.ok(noMatchHtml.includes('Limpar Filtros'));
    });

    test('6. EX-02 & RT-03: Mantém inspeções renderizadas e exibe snackbar discreto quando pull-to-refresh falha offline', async () => {
      await seedScreensFixtureData();

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

      const html = renderToStaticMarkup(
        React.createElement(InspectionsScreen, {
          listOptions: {
            autoLoad: false,
            initialData: {
              ...failedRefresh,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="inspections-offline-snackbar"'));
      assert.ok(html.includes(OFFLINE_REFRESH_SNACKBAR_MESSAGE));
      assert.ok(html.includes('Indústria Alfa'));
      assert.ok(html.includes('Comercial Beta'));
    });
  });

  describe('InspectionDetailsScreen (inspections/[inspectionId]/index.tsx — Passo 6)', () => {
    test('7. RF-05, RF-06 & CA-02: Renderiza equipamento, código, QR Code, endereço, prazos, progresso e alerta de atraso 100% offline', async () => {
      await seedScreensFixtureData();
      networkMonitor.setMockStatus(false);

      const detailsResult = await loadInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-1',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...detailsResult,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="details-overdue-banner"'));
      assert.ok(html.includes('Prazo limite ultrapassado'));
      assert.ok(html.includes('Indústria Alfa'));
      assert.ok(html.includes('Manutenção Preventiva de Gerador'));
      assert.ok(html.includes('data-testid="details-equipment-name"'));
      assert.ok(html.includes('Gerador G1'));
      assert.ok(html.includes('data-testid="details-equipment-code"'));
      assert.ok(html.includes('GEN-001'));
      assert.ok(html.includes('data-testid="details-equipment-qrcode"'));
      assert.ok(html.includes('QR-GEN-001'));
      assert.ok(html.includes('data-testid="details-site-name"'));
      assert.ok(html.includes('Unidade Leste'));
      assert.ok(html.includes('data-testid="details-site-address"'));
      assert.ok(html.includes('Rua das Torres, 100 - Campinas/SP'));
      assert.ok(html.includes('data-testid="details-checklist-card"'));
      assert.ok(html.includes('50%'));
      assert.ok(html.includes('1/2'));
      assert.ok(html.includes('Inspeção Visual (2)'));
      assert.ok(html.includes('Nível de óleo *'));
    });

    test('8. CA-03: Botão de ação dinâmico alterna de "Iniciar Inspeção" para "Continuar Checklist" ao iniciar e "Consultar" quando concluída', async () => {
      await seedScreensFixtureData();

      // Status inicial ATRIBUÍDA -> "Iniciar Inspeção"
      const assignedResult = await loadInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const startHtml = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-1',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...assignedResult,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(startHtml.includes('data-testid="inspection-action-button"'));
      assert.ok(startHtml.includes('Iniciar Inspeção'));

      // Atualiza no SQLite para EM_ANDAMENTO e recarrega -> "Continuar Checklist"
      await inspectionRepo.update('insp-1', {
        status: 'EM_ANDAMENTO',
        started_at: REF_DATE.toISOString(),
        sync_status: 'PENDENTE',
      });

      const startedResult = await loadInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const continueHtml = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-1',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...startedResult,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(continueHtml.includes('Continuar Checklist'));
      assert.ok(!continueHtml.includes('Iniciar Inspeção'));

      // Status ENVIADA -> "Consultar"
      const completedResult = await loadInspectionDetails({
        inspectionId: 'insp-3',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const viewHtml = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-3',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...completedResult,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(viewHtml.includes('Consultar'));
    });

    test('9. EX-01: Exibe tela de Permissão Negada sem vazar dados quando inspeção pertence a outro técnico', async () => {
      await seedScreensFixtureData();

      const forbiddenResult = await loadInspectionDetails({
        inspectionId: 'insp-other',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-other',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...forbiddenResult,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="inspection-forbidden-view"'));
      assert.ok(html.includes('Permissão Negada'));
      assert.ok(html.includes(PERMISSION_DENIED_MESSAGE));
      assert.ok(html.includes('data-testid="inspection-forbidden-back-btn"'));
      assert.ok(html.includes('Voltar para Minhas Inspeções'));
      assert.ok(!html.includes('Empresa Restrita'));
      assert.ok(!html.includes('Caldeira C9'));
      assert.ok(!html.includes('data-testid="inspection-action-button"'));
    });

    test('10. EX-02 & RT-03: Preserva dados locais nos detalhes e exibe snackbar discreto quando refresh falha offline', async () => {
      await seedScreensFixtureData();
      networkMonitor.setMockStatus(false);

      const offlineDetailsResult = await refreshInspectionDetails({
        inspectionId: 'insp-1',
        technicianId: 'tech-1',
        userRole: 'TECHNICIAN',
        inspectionRepository: inspectionRepo,
        networkMonitor,
        referenceDate: REF_DATE,
      });

      const html = renderToStaticMarkup(
        React.createElement(InspectionDetailsScreen, {
          inspectionId: 'insp-1',
          detailsOptions: {
            autoLoad: false,
            initialData: {
              ...offlineDetailsResult,
              isOnline: false,
              isLoading: false,
            },
          },
        })
      );

      assert.ok(html.includes('data-testid="details-offline-snackbar"'));
      assert.ok(html.includes(OFFLINE_REFRESH_SNACKBAR_MESSAGE));
      assert.ok(html.includes('Gerador G1'));
      assert.ok(html.includes('QR-GEN-001'));
      assert.ok(html.includes('Unidade Leste'));
    });

    test('11. Regressão: useInspectionDetails retorna arrays vazios referencialmente estáveis quando details é null', () => {
      const snapshots: Array<ReturnType<typeof useInspectionDetails>> = [];

      function HookProbe() {
        const state = useInspectionDetails(null, {
          autoLoad: false,
          inspectionRepository: inspectionRepo,
          networkMonitor,
        });
        snapshots.push(state);
        return React.createElement('span', null, String(state.items.length));
      }

      renderToStaticMarkup(React.createElement(HookProbe));
      renderToStaticMarkup(React.createElement(HookProbe));

      assert.equal(snapshots.length, 2);
      assert.equal(snapshots[0].sections, snapshots[1].sections);
      assert.equal(snapshots[0].items, snapshots[1].items);
      assert.equal(snapshots[0].responses, snapshots[1].responses);
      assert.equal(snapshots[0].evidences, snapshots[1].evidences);
      assert.equal(snapshots[0].pendingOperations, snapshots[1].pendingOperations);
      assert.equal(snapshots[0].progress, snapshots[1].progress);
    });
  });
});
