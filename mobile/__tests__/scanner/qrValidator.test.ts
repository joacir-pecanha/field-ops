import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestSqliteDb } from '../features/inspections/sqliteTestDb';
import { runMigrations } from '../../src/infrastructure/database/migrations';
import { InspectionRepository } from '../../src/infrastructure/database/repositories/inspectionRepository';
import { OutboxRepository } from '../../src/infrastructure/database/repositories/outboxRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  CONSENT_PROMPT_MESSAGE,
  PERMISSION_BLOCKED_GUIDANCE,
  PERMISSION_DENIED_GUIDANCE,
  resolveCameraPermissionState,
} from '../../src/features/scanner/hooks/useCameraPermission';
import {
  CameraScannerOverlay,
} from '../../src/features/scanner/components/CameraScannerOverlay';
import {
  DivergenceModal,
} from '../../src/features/scanner/components/DivergenceModal';
import {
  ManualCodeModal,
} from '../../src/features/scanner/components/ManualCodeModal';
import {
  UNRECOGNIZED_QR_MESSAGE,
  clearEquipmentVerificationRecords,
  confirmEquipmentVerification,
  createQrScanDebounceController,
  getEquipmentVerificationRecord,
  validateScannedQrCode,
} from '../../src/features/scanner/services/qrValidator';
import ScannerScreen from '../../src/app/(protected)/scanner';

describe('TASK-014 Passo 1: Permissão de câmera com consentimento explícito e tratamento negado/bloqueado', () => {
  test('exige consentimento explícito antes de considerar a câmera liberada (RF-01 / RN-058)', () => {
    const stateWithoutConsent = resolveCameraPermissionState(
      { status: 'granted', granted: true, canAskAgain: true },
      false
    );

    assert.equal(stateWithoutConsent.hasExplicitConsent, false);
    assert.equal(stateWithoutConsent.granted, false);
    assert.equal(stateWithoutConsent.status, 'undetermined');
    assert.equal(stateWithoutConsent.guidanceMessage, CONSENT_PROMPT_MESSAGE);
  });

  test('libera câmera somente após consentimento explícito e permissão granted', () => {
    const stateGranted = resolveCameraPermissionState(
      { status: 'granted', granted: true, canAskAgain: true },
      true
    );

    assert.equal(stateGranted.hasExplicitConsent, true);
    assert.equal(stateGranted.granted, true);
    assert.equal(stateGranted.status, 'granted');
    assert.equal(stateGranted.guidanceMessage, null);
  });

  test('identifica status denied (pode perguntar) vs blocked (bloqueado no SO) com orientação adequada (RF-02 / RN-059)', () => {
    const denied = resolveCameraPermissionState(
      { status: 'denied', granted: false, canAskAgain: true },
      true
    );
    assert.equal(denied.status, 'denied');
    assert.equal(denied.canAskAgain, true);
    assert.equal(denied.guidanceMessage, PERMISSION_DENIED_GUIDANCE);

    const blocked = resolveCameraPermissionState(
      { status: 'denied', granted: false, canAskAgain: false },
      true
    );
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.canAskAgain, false);
    assert.equal(blocked.guidanceMessage, PERMISSION_BLOCKED_GUIDANCE);
  });
});

describe('TASK-014 Passo 3: Debounce e Lock de leitura única (RF-03)', () => {
  test('impede disparos repetidos no mesmo ciclo e aplica janela de debounce após unlock', () => {
    const guard = createQrScanDebounceController(1500);

    // Primeira leitura no t=1000 deve ser aceita e travar o ciclo
    assert.equal(guard.tryAcquire('qr-fieldops-gd001', 1000), true);
    assert.equal(guard.isLocked(), true);

    // Enquanto travado, mesmo códigos diferentes são bloqueados no ciclo ativo
    assert.equal(guard.tryAcquire('QR-FIELDOPS-GD001', 1020), false);
    assert.equal(guard.tryAcquire('QR-FIELDOPS-CP002', 1050), false);

    // Ao destravar no t=1200, o MESMO código ainda está na janela de 1500ms -> bloqueado
    guard.unlock();
    assert.equal(guard.isLocked(), false);
    assert.equal(guard.tryAcquire('QR-FIELDOPS-GD001', 1500), false);

    // Um código DIFERENTE após unlock é aceito normalmente
    assert.equal(guard.tryAcquire('QR-FIELDOPS-CP002', 1600), true);

    // Após reset + janela vencida (>= 1500ms), o código original volta a ser aceito
    guard.reset();
    assert.equal(guard.tryAcquire('QR-FIELDOPS-GD001', 2600), true);
  });
});

describe('TASK-014 Passos 3 & 6: Validação Offline SQLite (Match, Divergência, Escopo e Manual)', () => {
  let db: SQLiteDatabase;
  let inspectionRepo: InspectionRepository;
  let outboxRepo: OutboxRepository;

  beforeEach(async () => {
    clearEquipmentVerificationRecords();
    db = createTestSqliteDb();
    await runMigrations(db);
    inspectionRepo = new InspectionRepository(db);
    outboxRepo = new OutboxRepository(db);

    await inspectionRepo.create({
      id: 'insp-carlos-gd001',
      remote_id: 'remote-carlos-gd001',
      template_id: 'tmpl-gerador',
      client_name: 'Indústria Alfa',
      site_name: 'Planta Sorocaba',
      equipment_name: 'Gerador Diesel GD-001',
      equipment_code: 'EQP-GD-001',
      equipment_qr_code: 'QR-FIELDOPS-GD001',
      status: 'ATRIBUÍDA',
      priority: 'ALTA',
      technician_id: 'tech-carlos',
      technician_name: 'Carlos Técnico',
    });

    await inspectionRepo.create({
      id: 'insp-ana-cp002',
      remote_id: 'remote-ana-cp002',
      template_id: 'tmpl-compressor',
      client_name: 'Indústria Alfa',
      site_name: 'Planta Sorocaba',
      equipment_name: 'Compressor Parafuso CP-002',
      equipment_code: 'EQP-CP-002',
      equipment_qr_code: 'QR-FIELDOPS-CP002',
      status: 'ATRIBUÍDA',
      priority: 'MÉDIA',
      technician_id: 'tech-ana',
      technician_name: 'Ana Ribeiro',
    });
  });

  test('confirma correspondência exata do QR Code e libera avanço para checklist (RF-04 / CA-01)', async () => {
    const result = await validateScannedQrCode(
      {
        scannedCode: '  qr-fieldops-gd001  ',
        inspectionId: 'insp-carlos-gd001',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(result.outcome, 'MATCH');
    assert.equal(result.allowedToAdvance, true);
    assert.equal(result.requiresJustification, false);
    assert.equal(result.normalizedCode, 'QR-FIELDOPS-GD001');
    assert.equal(result.matchedInspection?.id, 'insp-carlos-gd001');
    assert.equal(result.expectedEquipment?.name, 'Gerador Diesel GD-001');
  });

  test('localiza inspeção atribuída ao técnico na leitura rápida pela Home (sem inspectionId)', async () => {
    const result = await validateScannedQrCode(
      {
        scannedCode: 'QR-FIELDOPS-GD001',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(result.outcome, 'MATCH');
    assert.equal(result.allowedToAdvance, true);
    assert.equal(result.matchedInspection?.id, 'insp-carlos-gd001');
  });

  test('detecta divergência e retorna dados do equipamento esperado vs lido exigindo justificativa (RF-06 / CA-02)', async () => {
    const result = await validateScannedQrCode(
      {
        scannedCode: 'QR-FIELDOPS-CP002',
        inspectionId: 'insp-carlos-gd001',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(result.outcome, 'DIVERGENCE');
    assert.equal(result.allowedToAdvance, false);
    assert.equal(result.requiresJustification, true);
    assert.equal(result.expectedEquipment?.code, 'EQP-GD-001');
    assert.equal(result.expectedEquipment?.qrCode, 'QR-FIELDOPS-GD001');
    assert.equal(result.scannedEquipment?.code, 'EQP-CP-002');
    assert.equal(result.scannedEquipment?.qrCode, 'QR-FIELDOPS-CP002');
  });

  test('impede acesso a equipamento fora do escopo atribuído ao técnico (RF-07 / RN-063)', async () => {
    // Leitura rápida sem inspectionId de equipamento atribuído a outro técnico
    const quickScanResult = await validateScannedQrCode(
      {
        scannedCode: 'QR-FIELDOPS-CP002',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(quickScanResult.outcome, 'OUT_OF_SCOPE');
    assert.equal(quickScanResult.allowedToAdvance, false);
    assert.equal(quickScanResult.matchedInspection, undefined);

    // Tentativa direcionada passando inspectionId de outro técnico
    const targetedResult = await validateScannedQrCode(
      {
        scannedCode: 'QR-FIELDOPS-CP002',
        inspectionId: 'insp-ana-cp002',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(targetedResult.outcome, 'OUT_OF_SCOPE');
    assert.equal(targetedResult.allowedToAdvance, false);
  });

  test('produz mensagem exata quando QR Code não é reconhecido no catálogo FieldOps (EX-02)', async () => {
    const result = await validateScannedQrCode(
      {
        scannedCode: 'ETIQUETA-EXTERNA-9999',
        inspectionId: 'insp-carlos-gd001',
        technicianId: 'tech-carlos',
        source: 'CAMERA',
      },
      { inspectionRepo }
    );

    assert.equal(result.outcome, 'UNRECOGNIZED');
    assert.equal(result.allowedToAdvance, false);
    assert.equal(result.message, UNRECOGNIZED_QR_MESSAGE);
    assert.equal(result.message, 'Código QR não identificado no FieldOps');
  });

  test('permite identificação manual pelo código do equipamento ou patrimônio (RF-02 / EX-01 / CA-03)', async () => {
    const byPatrimony = await validateScannedQrCode(
      {
        scannedCode: 'pat-2026-0001',
        inspectionId: 'insp-carlos-gd001',
        technicianId: 'tech-carlos',
        source: 'MANUAL',
      },
      { inspectionRepo }
    );
    assert.equal(byPatrimony.outcome, 'MATCH');
    assert.equal(byPatrimony.allowedToAdvance, true);

    const byEquipmentCode = await validateScannedQrCode(
      {
        scannedCode: 'EQP-GD-001',
        inspectionId: 'insp-carlos-gd001',
        technicianId: 'tech-carlos',
        source: 'MANUAL',
      },
      { inspectionRepo }
    );
    assert.equal(byEquipmentCode.outcome, 'MATCH');
    assert.equal(byEquipmentCode.allowedToAdvance, true);
  });

  test('persiste transição para EM_ANDAMENTO e outbox START_INSPECTION ao confirmar verificação e exige justificativa mínima em divergência', async () => {
    await assert.rejects(
      () =>
        confirmEquipmentVerification(
          {
            inspectionId: 'insp-carlos-gd001',
            scannedCode: 'QR-FIELDOPS-CP002',
            source: 'CAMERA',
            mode: 'DIVERGENCE_OVERRIDE',
            justification: 'curta',
            technicianId: 'tech-carlos',
          },
          { inspectionRepo, outboxRepo }
        ),
      /10 caracteres/
    );

    const record = await confirmEquipmentVerification(
      {
        inspectionId: 'insp-carlos-gd001',
        scannedCode: 'QR-FIELDOPS-GD001',
        source: 'CAMERA',
        mode: 'MATCH',
        technicianId: 'tech-carlos',
      },
      { inspectionRepo, outboxRepo }
    );

    assert.equal(record.inspectionId, 'insp-carlos-gd001');
    assert.equal(getEquipmentVerificationRecord('insp-carlos-gd001')?.mode, 'MATCH');

    const updated = await inspectionRepo.findById('insp-carlos-gd001');
    assert.equal(updated?.status, 'EM_ANDAMENTO');
    assert.equal(updated?.sync_status, 'PENDENTE');
    assert.ok(updated?.started_at, 'started_at deve ser preenchido');

    const outboxOps = await outboxRepo.findByEntity('INSPECTION', 'insp-carlos-gd001');
    assert.equal(outboxOps.length, 1);
    assert.equal(outboxOps[0].operation_type, 'START_INSPECTION');
  });
});

describe('TASK-014 Passos 2, 4 & 5: Renderização SSR dos componentes e tela do Scanner', () => {
  test('renderiza CameraScannerOverlay com mira, botão de lanterna, fallback manual e mensagem EX-02', () => {
    const html = renderToStaticMarkup(
      React.createElement(CameraScannerOverlay, {
        expectedEquipment: {
          name: 'Gerador Diesel GD-001',
          code: 'EQP-GD-001',
          qrCode: 'QR-FIELDOPS-GD001',
          source: 'INSPECTION_SNAPSHOT',
        },
        overlayStatus: 'unrecognized',
        statusMessage: UNRECOGNIZED_QR_MESSAGE,
        torchEnabled: false,
        onToggleTorch: () => {},
        onOpenManualEntry: () => {},
        onRetryScan: () => {},
      })
    );

    assert.ok(html.includes('Scanner de QR Code'));
    assert.ok(html.includes('Esperado: Gerador Diesel GD-001'));
    assert.ok(html.includes('Código QR não identificado no FieldOps'));
    assert.ok(html.includes('QR Code danificado ou ilegível?'));
  });

  test('renderiza DivergenceModal exibindo equipamento esperado vs lido e justificativa obrigatória', () => {
    const html = renderToStaticMarkup(
      React.createElement(DivergenceModal, {
        visible: true,
        scannedCode: 'QR-FIELDOPS-CP002',
        expectedEquipment: {
          name: 'Gerador Diesel GD-001',
          code: 'EQP-GD-001',
          qrCode: 'QR-FIELDOPS-GD001',
          source: 'INSPECTION_SNAPSHOT',
        },
        scannedEquipment: {
          name: 'Compressor Parafuso CP-002',
          code: 'EQP-CP-002',
          qrCode: 'QR-FIELDOPS-CP002',
          source: 'KNOWN_CATALOG',
        },
        onCancel: () => {},
        onConfirmOverride: () => {},
      })
    );

    assert.ok(html.includes('Divergência de Equipamento'));
    assert.ok(html.includes('EQUIPAMENTO ESPERADO'));
    assert.ok(html.includes('Gerador Diesel GD-001'));
    assert.ok(html.includes('QR CODE LIDO NO CAMPO'));
    assert.ok(html.includes('Compressor Parafuso CP-002'));
    assert.ok(html.includes('Confirmar com Justificativa'));
  });

  test('renderiza ManualCodeModal com motivos (câmera/danificado) e confirmação explícita', () => {
    const html = renderToStaticMarkup(
      React.createElement(ManualCodeModal, {
        visible: true,
        defaultReason: 'DAMAGED_QR',
        expectedEquipment: {
          name: 'Gerador Diesel GD-001',
          code: 'EQP-GD-001',
          qrCode: 'QR-FIELDOPS-GD001',
          assetTag: 'PAT-2026-0001',
          source: 'INSPECTION_SNAPSHOT',
        },
        onCancel: () => {},
        onSubmit: () => {},
      })
    );

    assert.ok(html.includes('Identificação Manual do Equipamento'));
    assert.ok(html.includes('QR danificado / ilegível'));
    assert.ok(html.includes('PAT-2026-0001'));
    assert.ok(html.includes('Confirmo explicitamente'));
  });

  test('renderiza ScannerScreen nos estados de consentimento, permissão negada e câmera ativa', () => {
    const consentHtml = renderToStaticMarkup(
      React.createElement(ScannerScreen, {
        autoCheckPermission: false,
        initialPermissionState: {
          status: 'undetermined',
          granted: false,
          canAskAgain: true,
          hasExplicitConsent: false,
          isLoading: false,
          guidanceMessage: CONSENT_PROMPT_MESSAGE,
        },
      })
    );
    assert.ok(consentHtml.includes('Permissão para Uso da Câmera'));
    assert.ok(consentHtml.includes('Autorizar e Abrir Câmera'));
    assert.equal(consentHtml.includes('data-expo-camera-view'), false);

    const deniedHtml = renderToStaticMarkup(
      React.createElement(ScannerScreen, {
        autoCheckPermission: false,
        initialPermissionState: {
          status: 'denied',
          granted: false,
          canAskAgain: true,
          hasExplicitConsent: true,
          isLoading: false,
          guidanceMessage: PERMISSION_DENIED_GUIDANCE,
        },
      })
    );
    assert.ok(deniedHtml.includes('Permissão de Câmera Negada'));
    assert.ok(deniedHtml.includes('Digitar Código do Equipamento'));
    assert.equal(deniedHtml.includes('data-expo-camera-view'), false);

    const cameraHtml = renderToStaticMarkup(
      React.createElement(ScannerScreen, {
        autoCheckPermission: false,
        initialPermissionState: {
          status: 'granted',
          granted: true,
          canAskAgain: true,
          hasExplicitConsent: true,
          isLoading: false,
          guidanceMessage: null,
        },
      })
    );
    assert.ok(cameraHtml.includes('data-expo-camera-view="true"'));
    assert.ok(cameraHtml.includes('Scanner de QR Code'));
  });
});
