import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createTestSqliteDb } from './sqliteTestDb';
import { runMigrations } from '../../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../../src/infrastructure/database/repositories/outboxRepository';
import type {
  ChecklistItem,
  ChecklistResponse,
  ChecklistSection,
  InspectionEvidence,
} from '../../../src/infrastructure/database/types';
import { useAuthStore } from '@/features/auth/store';
import {
  OsmLeafletMap,
  buildOsmLeafletHtml,
  captureCurrentLocation,
  type LocationProviderAdapter,
} from '../../../src/features/location/services/locationService';
import { calculateInspectionProgress } from '../../../src/features/inspections/hooks/useInspectionProgress';
import {
  AWAITING_SYNC_LABEL,
  InspectionLifecycleError,
  completeInspection,
  getInspectionLocations,
  isInspectionReadOnly,
  saveChecklistResponse,
  startInspection,
} from '../../../src/features/inspections/services/inspectionLifecycleService';
import { PendingItemsModal } from '../../../src/features/inspections/components/PendingItemsModal';
import InspectionSummaryScreen from '../../../src/app/(protected)/inspections/[inspectionId]/summary';
import { loadInspectionDetails } from '../../../src/features/inspections/hooks/useInspectionDetails';
import { NetworkMonitor } from '../../../src/infrastructure/sync/networkMonitor';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createGrantedLocationProvider(
  lat = -23.50153,
  lng = -47.45256,
  accuracy = 14
): LocationProviderAdapter {
  return {
    getForegroundPermissionsAsync: async () => ({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    }),
    requestForegroundPermissionsAsync: async () => ({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => ({
      coords: { latitude: lat, longitude: lng, accuracy },
      timestamp: Date.parse('2026-11-15T14:30:00.000Z'),
    }),
  };
}

function createDeniedLocationProvider(): LocationProviderAdapter {
  return {
    getForegroundPermissionsAsync: async () => ({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
    }),
    requestForegroundPermissionsAsync: async () => ({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => {
      throw new Error('Should not call getCurrentPositionAsync when denied');
    },
  };
}

function createSlowLocationProvider(): LocationProviderAdapter {
  return {
    getForegroundPermissionsAsync: async () => ({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    }),
    requestForegroundPermissionsAsync: async () => ({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: () =>
      new Promise(() => {
        // Simula sinal GPS travado até timeout
      }),
  };
}

describe('TASK-015 Passo 1: locationService (expo-location pontual + OpenStreetMap/Leaflet)', () => {
  test('captura coordenadas pontuais com precisão e timestamp quando permissão é concedida (RF-02, RT-01, RT-02)', async () => {
    const result = await captureCurrentLocation({
      locationProvider: createGrantedLocationProvider(-23.55052, -46.633308, 9.4),
      now: () => new Date('2026-11-15T14:30:00.000Z'),
    });

    assert.equal(result.captured, true);
    assert.equal(result.status, 'CAPTURED');
    assert.equal(result.permissionStatus, 'granted');
    assert.equal(result.latitude, -23.55052);
    assert.equal(result.longitude, -46.633308);
    assert.equal(result.accuracy, 9.4);
    assert.equal(result.timestamp, '2026-11-15T14:30:00.000Z');
  });

  test('EX-01: permissão negada não trava aplicação e retorna ausência de coordenadas', async () => {
    const result = await captureCurrentLocation({
      locationProvider: createDeniedLocationProvider(),
      now: () => new Date('2026-11-15T14:35:00.000Z'),
    });

    assert.equal(result.captured, false);
    assert.equal(result.status, 'PERMISSION_DENIED');
    assert.equal(result.permissionStatus, 'denied');
    assert.equal(result.latitude, null);
    assert.equal(result.longitude, null);
    assert.equal(result.coordinates, null);
    assert.ok(result.message.includes('Permissão de localização negada'));
  });

  test('EX-01: timeout seguro quando GPS não responde dentro do limite configurado', async () => {
    const result = await captureCurrentLocation({
      locationProvider: createSlowLocationProvider(),
      timeoutMs: 25,
      now: () => new Date('2026-11-15T14:40:00.000Z'),
    });

    assert.equal(result.captured, false);
    assert.equal(result.status, 'TIMEOUT');
    assert.equal(result.latitude, null);
    assert.equal(result.longitude, null);
    assert.ok(result.message.includes('Tempo limite'));
  });

  test('gera HTML e componente OpenStreetMap + Leaflet sem chave Google Maps', () => {
    const html = buildOsmLeafletHtml({
      latitude: -23.50153,
      longitude: -47.45256,
      accuracy: 15,
      title: 'Planta Sorocaba',
    });

    assert.ok(html.includes('tile.openstreetmap.org'));
    assert.ok(html.includes('leaflet'));
    assert.ok(html.includes('-23.50153'));
    assert.ok(html.includes('-47.45256'));
    assert.equal(html.toLowerCase().includes('maps.googleapis.com'), false);

    const mapMarkup = renderToStaticMarkup(
      React.createElement(OsmLeafletMap, {
        latitude: -23.50153,
        longitude: -47.45256,
        accuracy: 15,
        title: 'Local da Inspeção',
      })
    );

    assert.ok(mapMarkup.includes('data-testid="osm-leaflet-map"'));
    assert.ok(mapMarkup.includes('-23.501530, -47.452560'));
    assert.ok(mapMarkup.includes('OpenStreetMap'));
    assert.ok(mapMarkup.includes('Leaflet'));
  });
});

describe('TASK-015 Passo 2: calculateInspectionProgress (itens aplicáveis, respondidos e pendências obrigatórias)', () => {
  const sections: ChecklistSection[] = [
    { id: 'sec-1', inspection_id: 'insp-1', title: 'Segurança', order_index: 0 },
    { id: 'sec-2', inspection_id: 'insp-1', title: 'Medições', order_index: 1 },
  ];

  const items: ChecklistItem[] = [
    {
      id: 'item-1',
      section_id: 'sec-1',
      inspection_id: 'insp-1',
      title: 'Lacre íntegro',
      response_type: 'CONFORMITY',
      required: 1,
      order_index: 0,
    },
    {
      id: 'item-2',
      section_id: 'sec-2',
      inspection_id: 'insp-1',
      title: 'Horímetro',
      response_type: 'NUMBER',
      required: 1,
      order_index: 0,
    },
    {
      id: 'item-3',
      section_id: 'sec-2',
      inspection_id: 'insp-1',
      title: 'Observação opcional',
      response_type: 'TEXT_SHORT',
      required: 0,
      order_index: 1,
    },
    {
      id: 'item-inactive',
      section_id: 'sec-2',
      inspection_id: 'insp-1',
      title: 'Item desativado',
      response_type: 'TEXT_SHORT',
      required: 1,
      order_index: 2,
      status: 'INACTIVE',
    },
  ];

  test('RF-04 & RF-05: calcula progresso considerando itens aplicáveis e lista pendências obrigatórias', () => {
    const responses: ChecklistResponse[] = [
      {
        id: 'resp-1',
        item_id: 'item-1',
        inspection_id: 'insp-1',
        value: 'NON_CONFORMING',
        is_non_conformity: 1,
        responded_at: '2026-11-15T12:00:00.000Z',
      },
    ];
    const evidences: InspectionEvidence[] = [
      {
        id: 'ev-1',
        inspection_id: 'insp-1',
        item_id: 'item-1',
        local_uri: 'file:///tmp/photo.jpg',
        status: 'PENDING',
      },
    ];

    const summary = calculateInspectionProgress({ items, responses, sections, evidences });

    assert.equal(summary.totalItems, 4);
    assert.equal(summary.applicableItems, 3);
    assert.equal(summary.answeredItems, 1);
    assert.equal(summary.requiredItems, 2);
    assert.equal(summary.answeredRequiredItems, 1);
    assert.equal(summary.pendingRequiredCount, 1);
    assert.equal(summary.pendingRequiredItems[0].itemId, 'item-2');
    assert.equal(summary.pendingRequiredItems[0].sectionTitle, 'Medições');
    assert.equal(summary.nonConformitiesCount, 1);
    assert.equal(summary.evidencesCount, 1);
    assert.equal(summary.percentage, 33);
    assert.equal(summary.canComplete, false);
  });
});

describe('TASK-015 Passos 3 & 6: inspectionLifecycleService (Início, Bloqueio Obrigatório, Conclusão e Outbox)', () => {
  let db: SQLiteDatabase;
  let inspectionRepo: InspectionRepository;
  let outboxRepo: OutboxRepository;

  beforeEach(async () => {
    db = createTestSqliteDb();
    await runMigrations(db);
    inspectionRepo = new InspectionRepository(db);
    outboxRepo = new OutboxRepository(db);

    await inspectionRepo.create({
      id: 'insp-life-1',
      remote_id: 'rem-life-1',
      template_id: 'tmpl-ger-01',
      client_name: 'Indústria Alfa',
      site_name: 'Planta Sorocaba',
      site_address: 'Av. Industrial, 1200',
      equipment_name: 'Gerador Diesel GD-001',
      equipment_code: 'EQP-GD-001',
      equipment_qr_code: 'QR-FIELDOPS-GD001',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      due_date: '2026-11-20T12:00:00.000Z',
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-carlos',
      technician_name: 'Carlos Técnico',
    });

    await db.runAsync(
      'INSERT INTO checklist_sections (id, inspection_id, title, order_index) VALUES (?, ?, ?, ?);',
      ['sec-life-1', 'insp-life-1', 'Inspeção Visual', 0]
    );

    await db.runAsync(
      `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?);`,
      [
        'item-req-1',
        'sec-life-1',
        'insp-life-1',
        'Lacre externo íntegro',
        'CONFORMITY',
        1,
        0,
        'item-req-2',
        'sec-life-1',
        'insp-life-1',
        'Horímetro atual',
        'NUMBER',
        1,
        1,
        'item-opt-3',
        'sec-life-1',
        'insp-life-1',
        'Observação adicional',
        'TEXT_SHORT',
        0,
        2,
      ]
    );
  });

  afterEach(async () => {
    await db.closeAsync();
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  test('RF-01: bloqueia início de inspeção atribuída a outro técnico ou já concluída', async () => {
    const forbidden = await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-outro', userRole: 'TECHNICIAN' },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(forbidden.success, false);
    assert.equal(forbidden.code, 'FORBIDDEN_TECHNICIAN');

    await inspectionRepo.update('insp-life-1', { status: 'APROVADA' });
    const invalidStatus = await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos', userRole: 'TECHNICIAN' },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(invalidStatus.success, false);
    assert.equal(invalidStatus.code, 'INVALID_STATUS');
  });

  test('CA-01 & CA-04: startInspection altera para EM_ANDAMENTO, grava started_at, GPS no SQLite e START_INSPECTION com UUID na Outbox', async () => {
    const fixedNow = new Date('2026-11-15T15:00:00.000Z');
    const result = await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos', userRole: 'TECHNICIAN' },
      {
        db,
        inspectionRepo,
        outboxRepo,
        locationProvider: createGrantedLocationProvider(-23.50153, -47.45256, 11),
        now: () => fixedNow,
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.code, 'STARTED');
    assert.equal(result.inspection?.status, 'EM_ANDAMENTO');
    assert.equal(result.inspection?.sync_status, 'PENDENTE');
    assert.equal(result.inspection?.started_at, fixedNow.toISOString());

    // RT-02 & CA-04: Coordenadas gravadas no SQLite
    const locs = await getInspectionLocations('insp-life-1', { db, inspectionRepo, outboxRepo });
    assert.ok(locs.startLocation);
    assert.equal(locs.startLocation?.available, true);
    assert.equal(locs.startLocation?.latitude, -23.50153);
    assert.equal(locs.startLocation?.longitude, -47.45256);
    assert.equal(locs.startLocation?.accuracy, 11);
    assert.equal(locs.startLocation?.captured_at, '2026-11-15T14:30:00.000Z');

    // RT-04 & CA-01: Operação START_INSPECTION na Outbox com UUID v4 idempotente
    const ops = await outboxRepo.findByEntity('INSPECTION', 'insp-life-1');
    assert.equal(ops.length, 1);
    assert.equal(ops[0].operation_type, 'START_INSPECTION');
    assert.match(ops[0].id, UUID_V4_REGEX);
    const payload = JSON.parse(ops[0].payload);
    assert.equal(payload.startedAt, fixedNow.toISOString());
    assert.equal(payload.location.latitude, -23.50153);
  });

  test('CA-02, RF-05 & RF-06: completeInspection bloqueia conclusão quando existe item obrigatório pendente', async () => {
    await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      { db, inspectionRepo, outboxRepo, locationProvider: createGrantedLocationProvider() }
    );

    // Responde apenas item-req-1, deixando item-req-2 obrigatório pendente
    await saveChecklistResponse(
      {
        inspectionId: 'insp-life-1',
        item: {
          id: 'item-req-1',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Lacre externo íntegro',
          response_type: 'CONFORMITY',
          required: 1,
          order_index: 0,
        },
        value: 'CONFORMING',
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );

    const blocked = await completeInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      { db, inspectionRepo, outboxRepo, locationProvider: createGrantedLocationProvider() }
    );

    assert.equal(blocked.success, false);
    assert.equal(blocked.blockedByPendingItems, true);
    assert.equal(blocked.code, 'PENDING_REQUIRED_ITEMS');
    assert.equal(blocked.pendingItems.length, 1);
    assert.equal(blocked.pendingItems[0].itemId, 'item-req-2');
    assert.equal(blocked.pendingItems[0].sectionTitle, 'Inspeção Visual');
    assert.equal(blocked.outboxOperation, null);

    const persisted = await inspectionRepo.findById('insp-life-1');
    assert.equal(persisted?.status, 'EM_ANDAMENTO');
    assert.equal(persisted?.completed_at, null);
  });

  test('CA-03, RF-07, EX-02 & RT-04: conclui inspeção válida, bloqueia edições posteriores e enfileira COMPLETE_INSPECTION com dependências', async () => {
    await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      { db, inspectionRepo, outboxRepo, locationProvider: createGrantedLocationProvider(-23.501, -47.452, 10) }
    );

    await saveChecklistResponse(
      {
        inspectionId: 'insp-life-1',
        item: {
          id: 'item-req-1',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Lacre externo íntegro',
          response_type: 'CONFORMITY',
          required: 1,
          order_index: 0,
        },
        value: 'NON_CONFORMING',
        nonConformityDescription: 'Lacre rompido no painel lateral',
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );

    await saveChecklistResponse(
      {
        inspectionId: 'insp-life-1',
        item: {
          id: 'item-req-2',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Horímetro atual',
          response_type: 'NUMBER',
          required: 1,
          order_index: 1,
        },
        value: 1480,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );

    const completeNow = new Date('2026-11-15T16:10:00.000Z');
    const result = await completeInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      {
        db,
        inspectionRepo,
        outboxRepo,
        locationProvider: createGrantedLocationProvider(-23.502, -47.453, 8),
        now: () => completeNow,
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.blockedByPendingItems, false);
    assert.equal(result.code, 'COMPLETED');
    assert.equal(result.isReadOnly, true);
    assert.equal(result.syncDisplayLabel, AWAITING_SYNC_LABEL);
    assert.equal(result.inspection?.status, 'ENVIADA');
    assert.equal(result.inspection?.sync_status, 'PENDENTE');
    assert.equal(result.inspection?.completed_at, completeNow.toISOString());
    assert.equal(isInspectionReadOnly(result.inspection?.status), true);

    // GPS de conclusão persistido no SQLite (RT-02 / CA-04)
    const locs = await getInspectionLocations('insp-life-1', { db, inspectionRepo, outboxRepo });
    assert.equal(locs.completeLocation?.available, true);
    assert.equal(locs.completeLocation?.latitude, -23.502);
    assert.equal(locs.completeLocation?.longitude, -47.453);
    assert.equal(locs.completeLocation?.accuracy, 8);

    // Outbox COMPLETE_INSPECTION gerada com UUID v4 e dependências anteriores (RT-04 / SPEC-002)
    assert.ok(result.outboxOperation);
    assert.equal(result.outboxOperation?.operation_type, 'COMPLETE_INSPECTION');
    assert.match(result.outboxOperation!.id, UUID_V4_REGEX);
    assert.ok((result.outboxOperation?.dependencies as string[]).length >= 3);

    // CA-03 & EX-02: Bloqueia qualquer edição posterior após conclusão
    await assert.rejects(
      () =>
        saveChecklistResponse(
          {
            inspectionId: 'insp-life-1',
            item: {
              id: 'item-opt-3',
              section_id: 'sec-life-1',
              inspection_id: 'insp-life-1',
              title: 'Observação adicional',
              response_type: 'TEXT_SHORT',
              required: 0,
              order_index: 2,
            },
            value: 'Tentativa tardia',
            technicianId: 'tech-carlos',
          },
          { db, inspectionRepo, outboxRepo }
        ),
      (err: unknown) =>
        err instanceof InspectionLifecycleError && err.code === 'READ_ONLY_INSPECTION'
    );
  });

  test('EX-01: permite iniciar e concluir mesmo quando GPS tem permissão negada ou timeout, sem travar', async () => {
    const startRes = await startInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      { db, inspectionRepo, outboxRepo, locationProvider: createDeniedLocationProvider() }
    );
    assert.equal(startRes.success, true);
    assert.equal(startRes.location?.status, 'PERMISSION_DENIED');

    await saveChecklistResponse(
      {
        inspectionId: 'insp-life-1',
        item: {
          id: 'item-req-1',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Lacre externo íntegro',
          response_type: 'CONFORMITY',
          required: 1,
          order_index: 0,
        },
        value: 'CONFORMING',
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    await saveChecklistResponse(
      {
        inspectionId: 'insp-life-1',
        item: {
          id: 'item-req-2',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Horímetro atual',
          response_type: 'NUMBER',
          required: 1,
          order_index: 1,
        },
        value: 500,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );

    const completeRes = await completeInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      {
        db,
        inspectionRepo,
        outboxRepo,
        locationProvider: createSlowLocationProvider(),
        locationTimeoutMs: 20,
      }
    );

    assert.equal(completeRes.success, true);
    assert.equal(completeRes.inspection?.status, 'ENVIADA');
    assert.equal(completeRes.location?.status, 'TIMEOUT');

    const locs = await getInspectionLocations('insp-life-1', { db, inspectionRepo, outboxRepo });
    assert.equal(locs.startLocation?.available, false);
    assert.equal(locs.startLocation?.latitude, null);
    assert.equal(locs.completeLocation?.available, false);
    assert.equal(locs.completeLocation?.latitude, null);
  });

  test('Passos 4 & 5: Renderiza PendingItemsModal e summary.tsx com contadores, mapa OpenStreetMap e estado Aguardando Sincronização', async () => {
    const progress = calculateInspectionProgress({
      sections: [{ id: 'sec-life-1', inspection_id: 'insp-life-1', title: 'Inspeção Visual', order_index: 0 }],
      items: [
        {
          id: 'item-req-1',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Lacre externo íntegro',
          response_type: 'CONFORMITY',
          required: 1,
          order_index: 0,
        },
        {
          id: 'item-req-2',
          section_id: 'sec-life-1',
          inspection_id: 'insp-life-1',
          title: 'Horímetro atual',
          response_type: 'NUMBER',
          required: 1,
          order_index: 1,
        },
      ],
      responses: [
        {
          id: 'resp-1',
          item_id: 'item-req-1',
          inspection_id: 'insp-life-1',
          value: 'NON_CONFORMING',
          is_non_conformity: 1,
        },
      ],
      evidences: [
        {
          id: 'ev-1',
          inspection_id: 'insp-life-1',
          item_id: 'item-req-1',
          local_uri: 'file:///tmp/1.jpg',
          status: 'PENDING',
        },
      ],
    });

    const modalHtml = renderToStaticMarkup(
      React.createElement(PendingItemsModal, {
        visible: true,
        pendingItems: progress.pendingRequiredItems,
        onClose: () => {},
        onSelectItem: () => {},
      })
    );

    assert.ok(modalHtml.includes('data-testid="pending-items-modal"'));
    assert.ok(modalHtml.includes('Conclusão Bloqueada'));
    assert.ok(modalHtml.includes('Horímetro atual'));
    assert.ok(modalHtml.includes('data-testid="pending-item-shortcut-item-req-2"'));

    // Conclui no SQLite e renderiza summary.tsx em estado ENVIADA + PENDENTE (EX-02)
    await db.runAsync(
      `INSERT INTO checklist_responses (id, item_id, inspection_id, value, is_non_conformity, responded_at)
       VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?);`,
      [
        'r1',
        'item-req-1',
        'insp-life-1',
        'NON_CONFORMING',
        1,
        '2026-11-15T15:00:00.000Z',
        'r2',
        'item-req-2',
        'insp-life-1',
        '1200',
        0,
        '2026-11-15T15:05:00.000Z',
      ]
    );
    await db.runAsync(
      `INSERT INTO inspection_evidences (id, inspection_id, item_id, local_uri, status)
       VALUES (?, ?, ?, ?, ?);`,
      ['ev-1', 'insp-life-1', 'item-req-1', 'file:///tmp/1.jpg', 'PENDING']
    );

    await completeInspection(
      { inspectionId: 'insp-life-1', technicianId: 'tech-carlos' },
      { db, inspectionRepo, outboxRepo, locationProvider: createGrantedLocationProvider(-23.50153, -47.45256, 12) }
    );

    const netMonitor = new NetworkMonitor({ initialOnline: false });
    netMonitor.setMockStatus(false);

    const detailsResult = await loadInspectionDetails({
      inspectionId: 'insp-life-1',
      technicianId: 'tech-carlos',
      userRole: 'TECHNICIAN',
      inspectionRepository: inspectionRepo,
      networkMonitor: netMonitor,
    });
    const locs = await getInspectionLocations('insp-life-1', { db, inspectionRepo, outboxRepo });

    const summaryHtml = renderToStaticMarkup(
      React.createElement(InspectionSummaryScreen, {
        inspectionId: 'insp-life-1',
        detailsOptions: {
          autoLoad: false,
          initialData: {
            ...detailsResult,
            isOnline: false,
            isLoading: false,
          },
        },
        initialLocations: locs,
      })
    );

    assert.ok(summaryHtml.includes('data-testid="summary-awaiting-sync-banner"'));
    assert.ok(summaryHtml.includes(AWAITING_SYNC_LABEL));
    assert.ok(summaryHtml.includes('data-testid="summary-counters-card"'));
    assert.ok(summaryHtml.includes('67%'));
    assert.ok(summaryHtml.includes('2/3'));
    assert.ok(summaryHtml.includes('data-testid="summary-osm-map"'));
    assert.ok(summaryHtml.includes('-23.501530, -47.452560'));
    assert.ok(summaryHtml.includes('OpenStreetMap'));
  });
});
