import {
  InspectionRepository,
  inspectionRepository,
  isInspectionAssignedToTechnician,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  OutboxRepository,
  outboxRepository,
} from '@/infrastructure/database/repositories/outboxRepository';
import type { Inspection } from '@/infrastructure/database/types';
import { generateUUID } from '@/infrastructure/sync/uuid';

export const UNRECOGNIZED_QR_MESSAGE = 'Código QR não identificado no FieldOps';
export const OUT_OF_SCOPE_QR_MESSAGE =
  'Acesso negado: este equipamento está fora do escopo de inspeções atribuído ao técnico atual.';
export const DEFAULT_SCAN_DEBOUNCE_MS = 1800;
export const MIN_DIVERGENCE_JUSTIFICATION_LENGTH = 10;

export type QrInputSource = 'CAMERA' | 'MANUAL';

export type QrValidationOutcome =
  | 'MATCH'
  | 'DIVERGENCE'
  | 'OUT_OF_SCOPE'
  | 'UNRECOGNIZED'
  | 'INVALID_INPUT';

export type VerificationConfirmationMode =
  | 'MATCH'
  | 'DIVERGENCE_OVERRIDE'
  | 'MANUAL_DAMAGED_OVERRIDE';

export interface KnownEquipmentCatalogEntry {
  qrCode: string;
  equipmentCode: string;
  assetTag?: string;
  equipmentName: string;
  siteName?: string;
}

/**
 * Catálogo offline de referência para reconhecimento de ativos do FieldOps
 * mesmo antes de existir uma inspeção local correspondente no dispositivo (EX-02 / RF-06).
 */
export const FIELDOPS_KNOWN_EQUIPMENT_CATALOG: readonly KnownEquipmentCatalogEntry[] = [
  {
    qrCode: 'QR-FIELDOPS-GD001',
    equipmentCode: 'EQP-GD-001',
    assetTag: 'PAT-2026-0001',
    equipmentName: 'Gerador Diesel GD-001',
    siteName: 'Planta Sorocaba',
  },
  {
    qrCode: 'QR-FIELDOPS-CP002',
    equipmentCode: 'EQP-CP-002',
    assetTag: 'PAT-2026-0002',
    equipmentName: 'Compressor Parafuso CP-002',
    siteName: 'Planta Sorocaba',
  },
  {
    qrCode: 'QR-FIELDOPS-TR003',
    equipmentCode: 'EQP-TR-003',
    assetTag: 'PAT-2026-0003',
    equipmentName: 'Transformador Subestação TR-003',
    siteName: 'Centro de Distribuição Campinas',
  },
];

export interface EquipmentSummary {
  inspectionId?: string;
  name: string;
  code: string;
  qrCode: string;
  assetTag?: string;
  siteName?: string;
  source: 'INSPECTION_SNAPSHOT' | 'LOCAL_INSPECTION' | 'KNOWN_CATALOG';
}

export interface QrValidationRequest {
  scannedCode: string;
  inspectionId?: string | null;
  technicianId?: string | null;
  source?: QrInputSource;
}

export interface QrValidatorDependencies {
  inspectionRepo?: Pick<InspectionRepository, 'findAll' | 'findById' | 'findByRemoteId'>;
  catalog?: readonly KnownEquipmentCatalogEntry[];
}

export interface QrValidationResult {
  outcome: QrValidationOutcome;
  allowedToAdvance: boolean;
  requiresJustification: boolean;
  scannedCode: string;
  normalizedCode: string;
  source: QrInputSource;
  message: string;
  matchedInspection?: Inspection;
  expectedEquipment?: EquipmentSummary;
  scannedEquipment?: EquipmentSummary;
}

export interface EquipmentVerificationConfirmation {
  inspectionId: string;
  scannedCode: string;
  source: QrInputSource;
  mode: VerificationConfirmationMode;
  justification?: string;
  technicianId?: string | null;
}

export interface EquipmentVerificationRecord {
  inspectionId: string;
  scannedCode: string;
  source: QrInputSource;
  mode: VerificationConfirmationMode;
  justification?: string;
  verifiedAt: string;
}

export interface ConfirmVerificationDependencies {
  inspectionRepo?: Pick<InspectionRepository, 'findById' | 'findByRemoteId' | 'update'>;
  outboxRepo?: Pick<OutboxRepository, 'findByEntity' | 'create'>;
}

export interface QrScanDebounceController {
  canScan(rawCode: string, now?: number): boolean;
  tryAcquire(rawCode: string, now?: number): boolean;
  lock(): void;
  unlock(): void;
  isLocked(): boolean;
  reset(): void;
}

const verifiedByInspectionMap = new Map<string, EquipmentVerificationRecord>();

export function getEquipmentVerificationRecord(
  inspectionId?: string | null
): EquipmentVerificationRecord | null {
  if (!inspectionId) return null;
  return verifiedByInspectionMap.get(inspectionId) ?? null;
}

export function clearEquipmentVerificationRecords(): void {
  verifiedByInspectionMap.clear();
}

export function normalizeQrCodeValue(rawCode: string | null | undefined): string {
  if (typeof rawCode !== 'string') {
    return '';
  }
  return rawCode.trim().toUpperCase();
}

/**
 * Guarda de leitura única com debounce e bloqueio de ciclo ativo (RF-03).
 * Impede múltiplos disparos do CameraView a ~30fps e ignora leituras repetidas
 * do mesmo QR Code dentro da janela de debounce após desbloqueio.
 */
export class QrScanSessionGuard implements QrScanDebounceController {
  private readonly debounceMs: number;
  private locked = false;
  private lastAcceptedCode = '';
  private lastAcceptedAt: number | null = null;

  constructor(debounceMs = DEFAULT_SCAN_DEBOUNCE_MS) {
    this.debounceMs = Math.max(0, debounceMs);
  }

  canScan(rawCode: string, now = Date.now()): boolean {
    const normalized = normalizeQrCodeValue(rawCode);
    if (!normalized) {
      return false;
    }
    if (this.locked) {
      return false;
    }
    if (
      this.debounceMs > 0 &&
      this.lastAcceptedAt !== null &&
      this.lastAcceptedCode === normalized &&
      now - this.lastAcceptedAt < this.debounceMs
    ) {
      return false;
    }
    return true;
  }

  tryAcquire(rawCode: string, now = Date.now()): boolean {
    if (!this.canScan(rawCode, now)) {
      return false;
    }
    this.locked = true;
    this.lastAcceptedCode = normalizeQrCodeValue(rawCode);
    this.lastAcceptedAt = now;
    return true;
  }

  lock(): void {
    this.locked = true;
  }

  unlock(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }

  reset(): void {
    this.locked = false;
    this.lastAcceptedCode = '';
    this.lastAcceptedAt = null;
  }
}

export function createQrScanDebounceController(
  debounceMs = DEFAULT_SCAN_DEBOUNCE_MS
): QrScanDebounceController {
  return new QrScanSessionGuard(debounceMs);
}

function findCatalogEntryByEquipmentCodeOrQr(
  catalog: readonly KnownEquipmentCatalogEntry[],
  qrCode?: string | null,
  equipmentCode?: string | null
): KnownEquipmentCatalogEntry | undefined {
  const normQr = normalizeQrCodeValue(qrCode);
  const normCode = normalizeQrCodeValue(equipmentCode);
  return catalog.find(
    (entry) =>
      (normQr && normalizeQrCodeValue(entry.qrCode) === normQr) ||
      (normCode && normalizeQrCodeValue(entry.equipmentCode) === normCode)
  );
}

function buildEquipmentSummaryFromInspection(
  inspection: Inspection,
  catalog: readonly KnownEquipmentCatalogEntry[],
  source: EquipmentSummary['source']
): EquipmentSummary {
  const qrCode = inspection.equipment_qr_code ?? '';
  const code = inspection.equipment_code || 'Não informado';
  const catalogMatch = findCatalogEntryByEquipmentCodeOrQr(catalog, qrCode, code);

  return {
    inspectionId: inspection.id,
    name: inspection.equipment_name || catalogMatch?.equipmentName || 'Equipamento',
    code,
    qrCode: qrCode || catalogMatch?.qrCode || 'Sem QR cadastrado',
    assetTag: catalogMatch?.assetTag,
    siteName: inspection.site_name || inspection.site || catalogMatch?.siteName,
    source,
  };
}

function matchesCodeForInspection(
  normalizedCode: string,
  inspection: Inspection,
  source: QrInputSource,
  catalog: readonly KnownEquipmentCatalogEntry[]
): boolean {
  const qrCandidates = [inspection.equipment_qr_code]
    .map(normalizeQrCodeValue)
    .filter(Boolean);

  if (qrCandidates.includes(normalizedCode)) {
    return true;
  }

  if (source === 'MANUAL') {
    const equipmentCode = normalizeQrCodeValue(inspection.equipment_code);
    const catalogMatch = findCatalogEntryByEquipmentCodeOrQr(
      catalog,
      inspection.equipment_qr_code,
      inspection.equipment_code
    );
    const manualCandidates = [equipmentCode, catalogMatch?.assetTag]
      .map(normalizeQrCodeValue)
      .filter(Boolean);

    if (manualCandidates.includes(normalizedCode)) {
      return true;
    }
  }

  return false;
}

function findCatalogMatchByCode(
  normalizedCode: string,
  catalog: readonly KnownEquipmentCatalogEntry[],
  source: QrInputSource
): KnownEquipmentCatalogEntry | undefined {
  return catalog.find((entry) => {
    if (normalizeQrCodeValue(entry.qrCode) === normalizedCode) {
      return true;
    }
    if (source === 'MANUAL') {
      return (
        normalizeQrCodeValue(entry.equipmentCode) === normalizedCode ||
        normalizeQrCodeValue(entry.assetTag) === normalizedCode
      );
    }
    return false;
  });
}

function rankInspectionPriority(status: Inspection['status']): number {
  switch (status) {
    case 'EM_ANDAMENTO':
      return 0;
    case 'ATRIBUÍDA':
      return 1;
    case 'RASCUNHO':
      return 2;
    default:
      return 3;
  }
}

/**
 * Valida 100% offline contra o banco SQLite local (RT-03) se o código lido
 * corresponde ao equipamento esperado, apresenta divergência, viola escopo do técnico (RF-07 / RN-063)
 * ou é desconhecido no catálogo FieldOps (EX-02).
 */
export async function validateScannedQrCode(
  request: QrValidationRequest,
  dependencies: QrValidatorDependencies = {}
): Promise<QrValidationResult> {
  const source: QrInputSource = request.source ?? 'CAMERA';
  const normalizedCode = normalizeQrCodeValue(request.scannedCode);
  const repo = dependencies.inspectionRepo ?? inspectionRepository;
  const catalog = dependencies.catalog ?? FIELDOPS_KNOWN_EQUIPMENT_CATALOG;

  if (!normalizedCode) {
    return {
      outcome: 'INVALID_INPUT',
      allowedToAdvance: false,
      requiresJustification: false,
      scannedCode: request.scannedCode,
      normalizedCode: '',
      source,
      message: 'Informe ou leia um código QR válido antes de validar.',
    };
  }

  const allInspections = await repo.findAll();

  // Caso 1: Validação direcionada para uma inspeção específica
  if (request.inspectionId) {
    const targetInspection =
      (await repo.findById(request.inspectionId)) ??
      (await repo.findByRemoteId(request.inspectionId)) ??
      null;

    if (!targetInspection) {
      return {
        outcome: 'OUT_OF_SCOPE',
        allowedToAdvance: false,
        requiresJustification: false,
        scannedCode: request.scannedCode,
        normalizedCode,
        source,
        message: 'Inspeção não encontrada no armazenamento offline deste dispositivo.',
      };
    }

    // Regra de Escopo (RF-07 / RN-063): nunca autoriza inspeção atribuída a outro técnico
    if (
      request.technicianId &&
      !isInspectionAssignedToTechnician(targetInspection, request.technicianId)
    ) {
      return {
        outcome: 'OUT_OF_SCOPE',
        allowedToAdvance: false,
        requiresJustification: false,
        scannedCode: request.scannedCode,
        normalizedCode,
        source,
        message: OUT_OF_SCOPE_QR_MESSAGE,
      };
    }

    const expectedEquipment = buildEquipmentSummaryFromInspection(
      targetInspection,
      catalog,
      'INSPECTION_SNAPSHOT'
    );

    if (matchesCodeForInspection(normalizedCode, targetInspection, source, catalog)) {
      return {
        outcome: 'MATCH',
        allowedToAdvance: true,
        requiresJustification: false,
        scannedCode: request.scannedCode,
        normalizedCode,
        source,
        message: `Equipamento ${expectedEquipment.name} confirmado com sucesso.`,
        matchedInspection: targetInspection,
        expectedEquipment,
        scannedEquipment: expectedEquipment,
      };
    }

    // Divergência: verificar se o código pertence a outro equipamento conhecido (SQLite local ou catálogo)
    const otherInspection = allInspections.find(
      (item) =>
        item.id !== targetInspection.id &&
        matchesCodeForInspection(normalizedCode, item, source, catalog)
    );
    const catalogMatch = findCatalogMatchByCode(normalizedCode, catalog, source);

    if (otherInspection || catalogMatch) {
      const scannedEquipment: EquipmentSummary = catalogMatch
        ? {
            name: catalogMatch.equipmentName,
            code: catalogMatch.equipmentCode,
            qrCode: catalogMatch.qrCode,
            assetTag: catalogMatch.assetTag,
            siteName: catalogMatch.siteName,
            source: 'KNOWN_CATALOG',
          }
        : buildEquipmentSummaryFromInspection(otherInspection!, catalog, 'LOCAL_INSPECTION');

      return {
        outcome: 'DIVERGENCE',
        allowedToAdvance: false,
        requiresJustification: true,
        scannedCode: request.scannedCode,
        normalizedCode,
        source,
        message: `Divergência detectada: esperado ${expectedEquipment.name} (${expectedEquipment.qrCode}), mas foi lido ${scannedEquipment.name} (${scannedEquipment.qrCode}).`,
        matchedInspection: targetInspection,
        expectedEquipment,
        scannedEquipment,
      };
    }

    return {
      outcome: 'UNRECOGNIZED',
      allowedToAdvance: false,
      requiresJustification: false,
      scannedCode: request.scannedCode,
      normalizedCode,
      source,
      message: UNRECOGNIZED_QR_MESSAGE,
      expectedEquipment,
    };
  }

  // Caso 2: Leitura rápida a partir da Home (sem inspectionId pré-selecionado)
  const matchingInspections = allInspections.filter((item) =>
    matchesCodeForInspection(normalizedCode, item, source, catalog)
  );
  const catalogMatch = findCatalogMatchByCode(normalizedCode, catalog, source);

  if (matchingInspections.length === 0) {
    if (catalogMatch) {
      return {
        outcome: 'OUT_OF_SCOPE',
        allowedToAdvance: false,
        requiresJustification: false,
        scannedCode: request.scannedCode,
        normalizedCode,
        source,
        message:
          'Este equipamento existe no catálogo do FieldOps, mas não possui inspeção atribuída a você neste dispositivo.',
        scannedEquipment: {
          name: catalogMatch.equipmentName,
          code: catalogMatch.equipmentCode,
          qrCode: catalogMatch.qrCode,
          assetTag: catalogMatch.assetTag,
          siteName: catalogMatch.siteName,
          source: 'KNOWN_CATALOG',
        },
      };
    }

    return {
      outcome: 'UNRECOGNIZED',
      allowedToAdvance: false,
      requiresJustification: false,
      scannedCode: request.scannedCode,
      normalizedCode,
      source,
      message: UNRECOGNIZED_QR_MESSAGE,
    };
  }

  const authorizedInspections = request.technicianId
    ? matchingInspections.filter((item) =>
        isInspectionAssignedToTechnician(item, request.technicianId)
      )
    : matchingInspections;

  if (authorizedInspections.length === 0) {
    return {
      outcome: 'OUT_OF_SCOPE',
      allowedToAdvance: false,
      requiresJustification: false,
      scannedCode: request.scannedCode,
      normalizedCode,
      source,
      message: OUT_OF_SCOPE_QR_MESSAGE,
    };
  }

  const sortedAuthorized = [...authorizedInspections].sort(
    (a, b) => rankInspectionPriority(a.status) - rankInspectionPriority(b.status)
  );
  const selectedInspection = sortedAuthorized[0];
  const expectedEquipment = buildEquipmentSummaryFromInspection(
    selectedInspection,
    catalog,
    'INSPECTION_SNAPSHOT'
  );

  return {
    outcome: 'MATCH',
    allowedToAdvance: true,
    requiresJustification: false,
    scannedCode: request.scannedCode,
    normalizedCode,
    source,
    message: `Equipamento ${expectedEquipment.name} localizado e validado para inspeção.`,
    matchedInspection: selectedInspection,
    expectedEquipment,
    scannedEquipment: expectedEquipment,
  };
}

/**
 * Registra localmente a confirmação do equipamento (correspondência direta,
 * divergência justificada ou entrada manual com etiqueta danificada) e inicia
 * a inspeção offline (ATRIBUÍDA/RASCUNHO -> EM_ANDAMENTO) enfileirando START_INSPECTION no Outbox.
 */
export async function confirmEquipmentVerification(
  confirmation: EquipmentVerificationConfirmation,
  dependencies: ConfirmVerificationDependencies = {}
): Promise<EquipmentVerificationRecord> {
  const repo = dependencies.inspectionRepo ?? inspectionRepository;
  const outbox = dependencies.outboxRepo ?? outboxRepository;
  const trimmedJustification = confirmation.justification?.trim() ?? '';

  if (
    confirmation.mode === 'DIVERGENCE_OVERRIDE' &&
    trimmedJustification.length < MIN_DIVERGENCE_JUSTIFICATION_LENGTH
  ) {
    throw new Error(
      `Informe uma justificativa com pelo menos ${MIN_DIVERGENCE_JUSTIFICATION_LENGTH} caracteres para prosseguir após divergência.`
    );
  }

  const inspection =
    (await repo.findById(confirmation.inspectionId)) ??
    (await repo.findByRemoteId(confirmation.inspectionId));

  if (!inspection) {
    throw new Error('Inspeção não encontrada localmente para confirmar o equipamento.');
  }

  if (
    confirmation.technicianId &&
    !isInspectionAssignedToTechnician(inspection, confirmation.technicianId)
  ) {
    throw new Error(OUT_OF_SCOPE_QR_MESSAGE);
  }

  const verifiedAt = new Date().toISOString();
  const record: EquipmentVerificationRecord = {
    inspectionId: inspection.id,
    scannedCode: confirmation.scannedCode.trim(),
    source: confirmation.source,
    mode: confirmation.mode,
    justification: trimmedJustification || undefined,
    verifiedAt,
  };

  verifiedByInspectionMap.set(inspection.id, record);

  const shouldStartInspection =
    inspection.status === 'ATRIBUÍDA' || inspection.status === 'RASCUNHO';

  if (shouldStartInspection) {
    const startedAt = inspection.started_at ?? verifiedAt;
    await repo.update(inspection.id, {
      status: 'EM_ANDAMENTO',
      started_at: startedAt,
      sync_status: 'PENDENTE',
    });

    const existingOutbox = await outbox.findByEntity('INSPECTION', inspection.id);
    const hasStartOperation = existingOutbox.some(
      (op) => op.operation_type === 'START_INSPECTION'
    );

    if (!hasStartOperation) {
      await outbox.create({
        id: generateUUID(),
        entity_type: 'INSPECTION',
        global_id: inspection.id,
        operation_type: 'START_INSPECTION',
        payload: JSON.stringify({
          inspectionId: inspection.id,
          remoteId: inspection.remote_id,
          startedAt,
          equipmentVerification: record,
        }),
        status: 'PENDING',
      });
    }
  }

  return record;
}
