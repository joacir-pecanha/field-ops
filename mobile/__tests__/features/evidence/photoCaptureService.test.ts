import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { createTestSqliteDb } from '../inspections/sqliteTestDb';
import { runMigrations } from '../../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../../src/infrastructure/database/repositories/outboxRepository';
import { useAuthStore } from '../../../src/features/auth/store';
import {
  EVIDENCES_DIR_NAME,
  InsufficientStorageError,
  assertNotCacheDirectory,
  clearWebEvidenceStorage,
  ensureEvidencesDirectory,
} from '../../../src/features/evidence/services/photoStorageService';
import {
  MAX_PHOTO_HEIGHT,
  MAX_PHOTO_WIDTH,
  PHOTO_JPEG_QUALITY,
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_MAX_WIDTH,
  calculateTargetDimensions,
  captureAndSaveEvidence,
  deleteEvidencePhoto,
  ensureCameraPermission,
  ensureEvidenceFilesTable,
  listInspectionEvidences,
  processAndCompressPhoto,
  sanitizePhotoMetadata,
  type EvidenceRecord,
} from '../../../src/features/evidence/services/photoCaptureService';
import { PhotoPreviewModal } from '../../../src/features/evidence/components/PhotoPreviewModal';
import { EvidenceGallery } from '../../../src/features/evidence/components/EvidenceGallery';
import CaptureEvidenceScreen from '../../../src/app/(protected)/evidence/capture';
import { DynamicItemRenderer } from '../../../src/features/checklist/components/DynamicItemRenderer';
import { ConformityState } from '../../../src/features/checklist/schemas/checklistSchema';
import InspectionDetailsScreen from '../../../src/app/(protected)/inspections/[inspectionId]/index';
import InspectionSummaryScreen from '../../../src/app/(protected)/inspections/[inspectionId]/summary';
import { loadInspectionDetails } from '../../../src/features/inspections/hooks/useInspectionDetails';
import { NetworkMonitor } from '../../../src/infrastructure/sync/networkMonitor';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('TASK-016: Evidências Fotográficas (Armazenamento, Compressão, UI e Persistência SQLite)', () => {
  let db: SQLiteDatabase;
  let inspectionRepo: InspectionRepository;
  let outboxRepo: OutboxRepository;

  beforeEach(async () => {
    (LegacyFileSystem as any).__resetMockFileSystem?.();
    clearWebEvidenceStorage();

    db = createTestSqliteDb();
    await runMigrations(db);
    inspectionRepo = new InspectionRepository(db);
    outboxRepo = new OutboxRepository(db);

    await inspectionRepo.create({
      id: 'insp-ev-1',
      remote_id: 'rem-ev-1',
      template_id: 'tmpl-ger-01',
      client_name: 'Indústria Alfa',
      site_name: 'Planta Sorocaba',
      site_address: 'Av. Industrial, 1200',
      equipment_name: 'Gerador Diesel GD-001',
      equipment_code: 'EQP-GD-001',
      equipment_qr_code: 'QR-FIELDOPS-GD001',
      status: 'EM_ANDAMENTO',
      priority: 'ALTA',
      due_date: '2026-11-20T12:00:00.000Z',
      started_at: '2026-11-17T09:00:00.000Z',
      sync_status: 'SINCRONIZADO',
      technician_id: 'tech-carlos',
      technician_name: 'Carlos Técnico',
    });

    await db.runAsync(
      'INSERT INTO checklist_sections (id, inspection_id, title, order_index) VALUES (?, ?, ?, ?);',
      ['sec-ev-1', 'insp-ev-1', 'Inspeção Visual', 0]
    );

    await db.runAsync(
      `INSERT INTO checklist_items (id, section_id, inspection_id, title, response_type, required, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        'item-ev-1',
        'sec-ev-1',
        'insp-ev-1',
        'Lacre e integridade externa do equipamento',
        'CONFORMITY',
        1,
        0,
      ]
    );

    useAuthStore.setState({
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: 'tech-carlos',
        name: 'Carlos Técnico',
        email: 'tecnico@fieldops.com',
        role: 'TECHNICIAN',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    await db.closeAsync();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    clearWebEvidenceStorage();
  });

  test('Passo 1 & RT-02: cria pasta permanente documentDirectory + evidences/ e bloqueia cacheDirectory', async () => {
    const evidencesDir = await ensureEvidencesDirectory();
    assert.equal(
      evidencesDir,
      `${LegacyFileSystem.documentDirectory}${EVIDENCES_DIR_NAME}`
    );

    const dirInfo = await LegacyFileSystem.getInfoAsync(evidencesDir);
    assert.equal(dirInfo.exists, true);
    assert.equal(dirInfo.isDirectory, true);

    assert.throws(
      () =>
        assertNotCacheDirectory(
          `${LegacyFileSystem.cacheDirectory}evidences/test.jpg`,
          LegacyFileSystem.cacheDirectory,
          LegacyFileSystem.documentDirectory
        ),
      /cacheDirectory|permanente/i
    );
  });

  test('RF-01: solicita permissão de câmera antes da captura e trata recusa/bloqueio', async () => {
    let requestedCount = 0;
    const grantedResult = await ensureCameraPermission({
      getCameraPermissionsAsync: async () => ({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
      }),
      requestCameraPermissionsAsync: async () => {
        requestedCount += 1;
        return {
          status: 'granted',
          granted: true,
          canAskAgain: true,
        };
      },
    });

    assert.equal(requestedCount, 1);
    assert.equal(grantedResult.granted, true);
    assert.equal(grantedResult.status, 'granted');

    const blockedResult = await ensureCameraPermission({
      getCameraPermissionsAsync: async () => ({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      }),
      requestCameraPermissionsAsync: async () => ({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      }),
    });

    assert.equal(blockedResult.granted, false);
    assert.equal(blockedResult.status, 'blocked');
    assert.equal(blockedResult.canAskAgain, false);
  });

  test('Passo 2 (RT-01, RT-03): redimensiona para máx 1920x1080 px, comprime JPEG 0.8 e gera miniatura leve', async () => {
    const landscape = calculateTargetDimensions(4000, 3000, MAX_PHOTO_WIDTH, MAX_PHOTO_HEIGHT);
    assert.equal(landscape.shouldResize, true);
    assert.ok(landscape.width <= MAX_PHOTO_WIDTH);
    assert.ok(landscape.height <= MAX_PHOTO_HEIGHT);
    assert.equal(landscape.width, 1440);
    assert.equal(landscape.height, 1080);

    const small = calculateTargetDimensions(1280, 720, MAX_PHOTO_WIDTH, MAX_PHOTO_HEIGHT);
    assert.equal(small.shouldResize, false);
    assert.equal(small.width, 1280);
    assert.equal(small.height, 720);

    const calls: Array<{ uri: string; actions: any[]; saveOptions: any }> = [];
    const processed = await processAndCompressPhoto(
      {
        sourceUri: `${LegacyFileSystem.cacheDirectory}camera_raw.jpg`,
        originalWidth: 3840,
        originalHeight: 2160,
      },
      {
        manipulateAsync: async (uri, actions = [], saveOptions = {}) => {
          calls.push({ uri, actions, saveOptions });
          const resizeAction = (actions.find((a: any) => a && 'resize' in a) as any)?.resize;
          return {
            uri: `${LegacyFileSystem.cacheDirectory}out_${calls.length}.jpg`,
            width: resizeAction?.width ?? 1920,
            height: resizeAction?.height ?? 1080,
          };
        },
      }
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0].saveOptions.compress, PHOTO_JPEG_QUALITY);
    assert.equal(calls[0].saveOptions.format, 'jpeg');
    assert.equal(calls[0].actions[0].resize.width, 1920);
    assert.equal(calls[0].actions[0].resize.height, 1080);

    assert.ok(processed.width <= MAX_PHOTO_WIDTH);
    assert.ok(processed.height <= MAX_PHOTO_HEIGHT);
    assert.ok(processed.thumbnailWidth <= THUMBNAIL_MAX_WIDTH);
    assert.ok(processed.thumbnailHeight <= THUMBNAIL_MAX_HEIGHT);
    assert.equal(calls[1].saveOptions.format, 'jpeg');
  });

  test('RT-04: sanitiza metadados sensíveis (EXIF, GPS, serial e nome original do arquivo)', () => {
    const sanitized = sanitizePhotoMetadata(
      {
        exif: { GPSLatitude: -23.5, GPSLongitude: -47.4, Make: 'Samsung' },
        GPSLatitude: -23.5,
        GPSLongitude: -47.4,
        Make: 'Samsung',
        Model: 'Galaxy S24',
        SerialNumber: 'SN-SECRET-999',
        OwnerName: 'Técnico Privado',
        originalFileName: 'DCIM_2026_PRIVATE.jpg',
        localPath: '/storage/emulated/0/DCIM/Camera/DCIM_2026_PRIVATE.jpg',
      },
      {
        uuid: '11111111-1111-4111-8111-111111111111',
        width: 1920,
        height: 1080,
        thumbnailWidth: 320,
        thumbnailHeight: 180,
        capturedAt: '2026-11-17T10:00:00.000Z',
      }
    );

    const serialized = JSON.stringify(sanitized);
    assert.equal(sanitized.exifStripped, true);
    assert.equal(sanitized.uuid, '11111111-1111-4111-8111-111111111111');
    assert.equal(sanitized.mimeType, 'image/jpeg');
    assert.equal(sanitized.compressionQuality, 0.8);
    assert.equal(serialized.includes('GPSLatitude'), false);
    assert.equal(serialized.includes('SerialNumber'), false);
    assert.equal(serialized.includes('Samsung'), false);
    assert.equal(serialized.includes('DCIM_2026_PRIVATE'), false);
  });

  test('RF-03, RF-04, RF-05, RF-06, CA-01, CA-03, CA-04: salva foto com UUID em documentDirectory/evidences, grava evidence_files PENDING + Outbox e preserva após reabrir', async () => {
    const rawCachePhoto = `${LegacyFileSystem.cacheDirectory}raw_cam_photo.jpg`;
    (LegacyFileSystem as any).__seedMockFile(rawCachePhoto, 'raw-camera-payload', 450000);

    const result = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        nonConformityId: 'nc-ev-1',
        sourceUri: rawCachePhoto,
        originalWidth: 3840,
        originalHeight: 2160,
        rawMetadata: {
          GPSLatitude: -23.501,
          GPSLongitude: -47.452,
          SerialNumber: 'DEVICE-999',
          originalFileName: 'IMG_001.jpg',
        },
        technicianId: 'tech-carlos',
        userRole: 'TECHNICIAN',
      },
      {
        db,
        inspectionRepo,
        outboxRepo,
        now: () => new Date('2026-11-17T14:00:00.000Z'),
      }
    );

    assert.equal(result.success, true);
    assert.equal(result.code, 'CAPTURED');
    assert.ok(result.evidence);

    const evidenceId = result.evidence!.id;
    assert.match(evidenceId, UUID_V4_REGEX);
    assert.equal(result.evidence!.file_name, `${evidenceId}.jpg`);
    assert.equal(result.evidence!.status, 'PENDING');
    assert.ok(
      result.evidence!.local_uri.startsWith(
        `${LegacyFileSystem.documentDirectory}evidences/`
      )
    );
    assert.ok(
      result.evidence!.thumbnail_uri!.startsWith(
        `${LegacyFileSystem.documentDirectory}evidences/${evidenceId}_thumb.jpg`
      )
    );
    assert.equal(result.evidence!.local_uri.includes('/cache/'), false);

    // Arquivos físicos gravados na pasta permanente
    const savedPhotoInfo = await LegacyFileSystem.getInfoAsync(result.evidence!.local_uri);
    const savedThumbInfo = await LegacyFileSystem.getInfoAsync(result.evidence!.thumbnail_uri!);
    assert.equal(savedPhotoInfo.exists, true);
    assert.equal(savedThumbInfo.exists, true);

    // Registro em `evidence_files` com status PENDING (RF-05, CA-04)
    const dbFileRow = await db.getFirstAsync<Record<string, any>>(
      'SELECT * FROM evidence_files WHERE id = ?;',
      [evidenceId]
    );
    assert.ok(dbFileRow);
    assert.equal(dbFileRow.status, 'PENDING');
    assert.equal(dbFileRow.item_id, 'item-ev-1');
    assert.equal(dbFileRow.non_conformity_id, 'nc-ev-1');
    assert.equal(dbFileRow.sanitized_metadata_json.includes('DEVICE-999'), false);

    // Registro compatível em `inspection_evidences` e `outbox_operations`
    const legacyRow = await db.getFirstAsync<Record<string, any>>(
      'SELECT * FROM inspection_evidences WHERE id = ?;',
      [evidenceId]
    );
    assert.ok(legacyRow);
    assert.equal(legacyRow.status, 'PENDING');

    assert.ok(result.outboxOperation);
    assert.equal(result.outboxOperation?.entity_type, 'EVIDENCE');
    assert.equal(result.outboxOperation?.operation_type, 'UPLOAD_EVIDENCE');
    assert.equal(result.outboxOperation?.global_id, evidenceId);
    assert.equal(result.outboxOperation?.status, 'PENDING');

    // CA-03: Simula reabertura do aplicativo consultando nova instância do repositório offline
    const netMonitor = new NetworkMonitor({ initialOnline: false });
    netMonitor.setMockStatus(false);
    const reloadedDetails = await loadInspectionDetails({
      inspectionId: 'insp-ev-1',
      technicianId: 'tech-carlos',
      userRole: 'TECHNICIAN',
      inspectionRepository: new InspectionRepository(db),
      networkMonitor: netMonitor,
    });
    const persistedEvidences = await listInspectionEvidences('insp-ev-1', { db });

    assert.equal(reloadedDetails.details?.evidences.length, 1);
    assert.equal(reloadedDetails.details?.evidences[0].id, evidenceId);
    assert.equal(persistedEvidences.length, 1);
    assert.equal(persistedEvidences[0].thumbnail_uri, result.evidence!.thumbnail_uri);
  });

  test('EX-01: falha por falta de espaço no dispositivo emite alerta e não fecha o app', async () => {
    (LegacyFileSystem as any).__setMockFreeDiskStorage(1024); // Apenas 1 KB disponível

    let capturedAlertTitle = '';
    let capturedAlertMessage = '';

    const lowDiskResult = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        sourceUri: `${LegacyFileSystem.cacheDirectory}large.jpg`,
        originalWidth: 1920,
        originalHeight: 1080,
        technicianId: 'tech-carlos',
        onStorageAlert: (title, message) => {
          capturedAlertTitle = title;
          capturedAlertMessage = message;
        },
      },
      { db, inspectionRepo, outboxRepo }
    );

    assert.equal(lowDiskResult.success, false);
    assert.equal(lowDiskResult.code, 'INSUFFICIENT_STORAGE');
    assert.ok(capturedAlertTitle.includes('Armazenamento'));
    assert.ok(capturedAlertMessage.includes('espaço suficiente'));

    // Também captura exceção ENOSPC durante escrita
    (LegacyFileSystem as any).__setMockFreeDiskStorage(500 * 1024 * 1024);
    (LegacyFileSystem as any).__setMockForcedWriteError(
      new Error('ENOSPC: no space left on device')
    );

    const enospcResult = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        sourceUri: `${LegacyFileSystem.cacheDirectory}large2.jpg`,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );

    assert.equal(enospcResult.success, false);
    assert.equal(enospcResult.code, 'INSUFFICIENT_STORAGE');
    assert.equal(
      new InsufficientStorageError().code,
      'INSUFFICIENT_STORAGE'
    );

    const savedCount = await listInspectionEvidences('insp-ev-1', { db });
    assert.equal(savedCount.length, 0);
  });

  test('EX-02: permite excluir foto local antes do envio e bloqueia exclusão em inspeção APROVADA ou foto já enviada', async () => {
    const first = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        sourceUri: `${LegacyFileSystem.cacheDirectory}p1.jpg`,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(first.success, true);

    // Exclusão local permitida enquanto PENDING e inspeção EM_ANDAMENTO
    const deleted = await deleteEvidencePhoto(
      {
        inspectionId: 'insp-ev-1',
        evidenceId: first.evidence!.id,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(deleted.success, true);
    assert.equal(deleted.code, 'DELETED');

    const afterDelete = await listInspectionEvidences('insp-ev-1', { db });
    assert.equal(afterDelete.length, 0);
    const outboxAfterDelete = await outboxRepo.findByEntity('EVIDENCE', first.evidence!.id);
    assert.equal(outboxAfterDelete.length, 0);
    const deletedFileInfo = await LegacyFileSystem.getInfoAsync(first.evidence!.local_uri);
    assert.equal(deletedFileInfo.exists, false);

    // Captura nova foto, marca como UPLOADED -> deve bloquear exclusão
    const second = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        sourceUri: `${LegacyFileSystem.cacheDirectory}p2.jpg`,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    await db.runAsync('UPDATE evidence_files SET status = ? WHERE id = ?;', [
      'UPLOADED',
      second.evidence!.id,
    ]);

    const blockedUploaded = await deleteEvidencePhoto(
      {
        inspectionId: 'insp-ev-1',
        evidenceId: second.evidence!.id,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(blockedUploaded.success, false);
    assert.equal(blockedUploaded.code, 'READ_ONLY_EVIDENCE');

    // Captura terceira foto e muda inspeção para APROVADA -> estritamente somente leitura
    const third = await captureAndSaveEvidence(
      {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        sourceUri: `${LegacyFileSystem.cacheDirectory}p3.jpg`,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    await inspectionRepo.update('insp-ev-1', { status: 'APROVADA' });

    const blockedApproved = await deleteEvidencePhoto(
      {
        inspectionId: 'insp-ev-1',
        evidenceId: third.evidence!.id,
        technicianId: 'tech-carlos',
      },
      { db, inspectionRepo, outboxRepo }
    );
    assert.equal(blockedApproved.success, false);
    assert.equal(blockedApproved.code, 'READ_ONLY_EVIDENCE');
    assert.ok(blockedApproved.message.includes('somente leitura'));
  });

  test('Passos 3, 4 & 5: Renderiza PhotoPreviewModal, EvidenceGallery, CaptureEvidenceScreen e integração no Checklist', async () => {
    const previewHtml = renderToStaticMarkup(
      React.createElement(PhotoPreviewModal, {
        visible: true,
        photoUri: 'file:///tmp/preview.jpg',
        width: 2560,
        height: 1440,
        itemTitle: 'Lacre e integridade externa',
        isNonConformity: true,
        onConfirm: () => {},
        onRetake: () => {},
      })
    );

    assert.ok(previewHtml.includes('data-testid="photo-preview-modal"'));
    assert.ok(previewHtml.includes('Pré-visualização da Evidência'));
    assert.ok(previewHtml.includes('EVIDÊNCIA DE NÃO CONFORMIDADE'));
    assert.ok(previewHtml.includes('Confirmar e Salvar Foto'));
    assert.ok(previewHtml.includes('Refazer / Descartar'));

    const sampleEvidences: EvidenceRecord[] = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        inspection_id: 'insp-ev-1',
        item_id: 'item-ev-1',
        non_conformity_id: 'nc-1',
        local_uri: `${LegacyFileSystem.documentDirectory}evidences/22222222-2222-4222-8222-222222222222.jpg`,
        thumbnail_uri: `${LegacyFileSystem.documentDirectory}evidences/22222222-2222-4222-8222-222222222222_thumb.jpg`,
        file_name: '22222222-2222-4222-8222-222222222222.jpg',
        file_size: 84200,
        width: 1920,
        height: 1080,
        status: 'PENDING',
        created_at: '2026-11-17T14:10:00.000Z',
      },
    ];

    const editableGalleryHtml = renderToStaticMarkup(
      React.createElement(EvidenceGallery, {
        evidences: sampleEvidences,
        readOnly: false,
        initialExpandedId: sampleEvidences[0].id,
        onDeleteEvidence: () => {},
      })
    );
    assert.ok(editableGalleryHtml.includes('data-testid="evidence-gallery"'));
    assert.ok(
      editableGalleryHtml.includes(
        'data-testid="evidence-thumb-22222222-2222-4222-8222-222222222222"'
      )
    );
    assert.ok(
      editableGalleryHtml.includes(
        'data-testid="evidence-delete-btn-22222222-2222-4222-8222-222222222222"'
      )
    );
    assert.ok(editableGalleryHtml.includes('data-testid="evidence-expanded-modal"'));
    assert.ok(editableGalleryHtml.includes('22222222-2222-4222-8222-222222222222'));

    const readOnlyGalleryHtml = renderToStaticMarkup(
      React.createElement(EvidenceGallery, {
        evidences: sampleEvidences,
        readOnly: true,
        onDeleteEvidence: () => {},
      })
    );
    assert.ok(readOnlyGalleryHtml.includes('Somente leitura'));
    assert.equal(readOnlyGalleryHtml.includes('evidence-delete-btn-'), false);

    // Renderização da tela de captura em consent gate e câmera ativa
    const consentCaptureHtml = renderToStaticMarkup(
      React.createElement(CaptureEvidenceScreen, {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        itemTitle: 'Lacre e integridade externa',
        autoCheckPermission: false,
        initialPermissionState: {
          status: 'undetermined',
          granted: false,
          hasExplicitConsent: false,
        },
      })
    );
    assert.ok(consentCaptureHtml.includes('data-testid="evidence-consent-card"'));
    assert.ok(consentCaptureHtml.includes('Autorizar Câmera e Fotografar'));

    const activeCaptureHtml = renderToStaticMarkup(
      React.createElement(CaptureEvidenceScreen, {
        inspectionId: 'insp-ev-1',
        itemId: 'item-ev-1',
        itemTitle: 'Lacre e integridade externa',
        autoCheckPermission: false,
        initialPermissionState: {
          status: 'granted',
          granted: true,
          hasExplicitConsent: true,
        },
      })
    );
    assert.ok(activeCaptureHtml.includes('data-expo-camera-view="true"'));
    assert.ok(activeCaptureHtml.includes('data-testid="evidence-shutter-btn"'));

    // Integração com DynamicItemRenderer (botão de foto na Não Conformidade)
    const rendererHtml = renderToStaticMarkup(
      React.createElement(DynamicItemRenderer, {
        item: {
          id: 'item-ev-1',
          section_id: 'sec-ev-1',
          inspection_id: 'insp-ev-1',
          title: 'Lacre e integridade externa',
          response_type: 'CONFORMITY',
          required: 1,
          order_index: 0,
        },
        value: ConformityState.NON_CONFORMING,
        nonConformityDescription: 'Lacre rompido',
        onChange: () => {},
        onCapturePhoto: () => {},
      })
    );
    assert.ok(rendererHtml.includes('Anexar Foto da Não Conformidade'));

    // Integração em InspectionDetailsScreen e InspectionSummaryScreen
    await ensureEvidenceFilesTable(db);
    await db.runAsync(
      `INSERT INTO evidence_files (
        id, inspection_id, item_id, non_conformity_id, local_uri, thumbnail_uri,
        file_name, file_size, mime_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        '33333333-3333-4333-8333-333333333333',
        'insp-ev-1',
        'item-ev-1',
        null,
        `${LegacyFileSystem.documentDirectory}evidences/33333333-3333-4333-8333-333333333333.jpg`,
        `${LegacyFileSystem.documentDirectory}evidences/33333333-3333-4333-8333-333333333333_thumb.jpg`,
        '33333333-3333-4333-8333-333333333333.jpg',
        51200,
        'image/jpeg',
        'PENDING',
      ]
    );
    await db.runAsync(
      `INSERT INTO inspection_evidences (id, inspection_id, item_id, local_uri, status)
       VALUES (?, ?, ?, ?, ?);`,
      [
        '33333333-3333-4333-8333-333333333333',
        'insp-ev-1',
        'item-ev-1',
        `${LegacyFileSystem.documentDirectory}evidences/33333333-3333-4333-8333-333333333333.jpg`,
        'PENDING',
      ]
    );

    const netMonitor = new NetworkMonitor({ initialOnline: false });
    netMonitor.setMockStatus(false);
    const detailsRes = await loadInspectionDetails({
      inspectionId: 'insp-ev-1',
      technicianId: 'tech-carlos',
      userRole: 'TECHNICIAN',
      inspectionRepository: inspectionRepo,
      networkMonitor: netMonitor,
    });

    const detailsHtml = renderToStaticMarkup(
      React.createElement(InspectionDetailsScreen, {
        inspectionId: 'insp-ev-1',
        detailsOptions: {
          autoLoad: false,
          initialData: {
            ...detailsRes,
            isOnline: false,
            isLoading: false,
          },
        },
      })
    );
    assert.ok(detailsHtml.includes('data-testid="checklist-item-evidences-item-ev-1"'));
    assert.ok(detailsHtml.includes('33333333-3333-4333-8333-333333333333'));

    const summaryHtml = renderToStaticMarkup(
      React.createElement(InspectionSummaryScreen, {
        inspectionId: 'insp-ev-1',
        detailsOptions: {
          autoLoad: false,
          initialData: {
            ...detailsRes,
            isOnline: false,
            isLoading: false,
          },
        },
        initialLocations: { startLocation: null, completeLocation: null, records: [] },
      })
    );
    assert.ok(summaryHtml.includes('data-testid="summary-evidences-card"'));
    assert.ok(summaryHtml.includes('data-testid="summary-evidence-gallery"'));
  });
});
