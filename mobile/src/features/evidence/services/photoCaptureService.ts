import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import {
  manipulateAsync,
  SaveFormat,
  type Action,
  type ImageResult,
  type SaveOptions,
} from 'expo-image-manipulator';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '@/infrastructure/database/db';
import {
  InspectionRepository,
  inspectionRepository as defaultInspectionRepo,
  isInspectionAssignedToTechnician,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  OutboxRepository,
  outboxRepository as defaultOutboxRepo,
} from '@/infrastructure/database/repositories/outboxRepository';
import type {
  EvidenceStatus,
  Inspection,
  InspectionEvidence,
  OutboxOperation,
} from '@/infrastructure/database/types';
import { generateUUID } from '@/infrastructure/sync/uuid';
import { isInspectionReadOnly } from '@/features/inspections/services/inspectionLifecycleService';
import {
  type FileSystemAdapter,
  createDefaultFileSystemAdapter,
  deleteStoredPhotoFiles,
  isInsufficientStorageError,
  mapStorageException,
  saveEvidenceFilesToPermanentStorage,
} from './photoStorageService';

export const MAX_PHOTO_WIDTH = 1920;
export const MAX_PHOTO_HEIGHT = 1080;
export const PHOTO_JPEG_QUALITY = 0.8;

export const THUMBNAIL_MAX_WIDTH = 320;
export const THUMBNAIL_MAX_HEIGHT = 240;
export const THUMBNAIL_JPEG_QUALITY = 0.6;

export interface CameraPermissionResponse {
  status?: string | null;
  granted?: boolean;
  canAskAgain?: boolean;
}

export interface CameraPermissionAdapter {
  getCameraPermissionsAsync: () => Promise<CameraPermissionResponse>;
  requestCameraPermissionsAsync: () => Promise<CameraPermissionResponse>;
}

export interface EnsureCameraPermissionResult {
  granted: boolean;
  status: 'granted' | 'denied' | 'blocked';
  canAskAgain: boolean;
  message: string;
}

export interface ImageManipulatorAdapter {
  manipulateAsync: (
    uri: string,
    actions?: Action[],
    saveOptions?: SaveOptions
  ) => Promise<ImageResult>;
}

export interface TargetDimensions {
  width: number;
  height: number;
  shouldResize: boolean;
}

export interface SanitizedPhotoMetadata {
  uuid: string;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  mimeType: 'image/jpeg';
  compressionQuality: number;
  capturedAt: string;
  exifStripped: true;
}

export interface EvidenceRecord extends InspectionEvidence {
  non_conformity_id?: string | null;
  thumbnail_uri?: string | null;
  file_name?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnail_width?: number | null;
  thumbnail_height?: number | null;
  sanitized_metadata_json?: string | null;
}

export interface ProcessAndCompressPhotoParams {
  sourceUri: string;
  originalWidth?: number;
  originalHeight?: number;
  includeBase64?: boolean;
}

export interface ProcessedPhotoOutput {
  photoUri: string;
  thumbnailUri: string;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  photoBase64?: string;
  thumbnailBase64?: string;
}

export interface CaptureAndSaveEvidenceParams {
  inspectionId: string;
  itemId?: string | null;
  nonConformityId?: string | null;
  sourceUri: string;
  originalWidth?: number;
  originalHeight?: number;
  rawMetadata?: Record<string, unknown> | null;
  technicianId?: string | null;
  userRole?: string | null;
  onStorageAlert?: (title: string, message: string) => void;
}

export interface PhotoCaptureDependencies {
  db?: SQLiteDatabase;
  inspectionRepo?: InspectionRepository;
  outboxRepo?: OutboxRepository;
  fileSystem?: FileSystemAdapter;
  imageManipulator?: ImageManipulatorAdapter;
  cameraPermissions?: CameraPermissionAdapter;
  uuidGenerator?: () => string;
  now?: () => Date;
}

export type CaptureEvidenceResultCode =
  | 'CAPTURED'
  | 'NOT_FOUND'
  | 'FORBIDDEN_TECHNICIAN'
  | 'READ_ONLY_INSPECTION'
  | 'INSUFFICIENT_STORAGE'
  | 'CAPTURE_ERROR';

export interface CaptureAndSaveEvidenceResult {
  success: boolean;
  code: CaptureEvidenceResultCode;
  message: string;
  alertTitle?: string;
  alertMessage?: string;
  evidence: EvidenceRecord | null;
  outboxOperation: OutboxOperation | null;
}

export interface DeleteEvidencePhotoParams {
  inspectionId: string;
  evidenceId: string;
  technicianId?: string | null;
  userRole?: string | null;
}

export type DeleteEvidenceResultCode =
  | 'DELETED'
  | 'NOT_FOUND'
  | 'FORBIDDEN_TECHNICIAN'
  | 'READ_ONLY_EVIDENCE';

export interface DeleteEvidencePhotoResult {
  success: boolean;
  code: DeleteEvidenceResultCode;
  message: string;
  deletedId: string | null;
}

const SENSITIVE_METADATA_KEYS = new Set([
  'exif',
  'gps',
  'gpslatitude',
  'gpslongitude',
  'gpsaltitude',
  'gpsimgdirection',
  'gpsdatestamp',
  'gpstimestamp',
  'latitude',
  'longitude',
  'altitude',
  'make',
  'model',
  'software',
  'serialnumber',
  'bodyserialnumber',
  'lensserialnumber',
  'ownername',
  'artist',
  'copyright',
  'usercomment',
  'makernote',
  'hostcomputer',
  'originalfilename',
  'localpath',
  'sourcepath',
  'deviceserial',
  'imei',
  'location',
]);

function createDefaultImageManipulatorAdapter(): ImageManipulatorAdapter {
  return {
    manipulateAsync: (uri, actions, saveOptions) =>
      manipulateAsync(uri, actions, saveOptions),
  };
}

function createDefaultCameraPermissionAdapter(): CameraPermissionAdapter {
  return {
    getCameraPermissionsAsync: () => Camera.getCameraPermissionsAsync(),
    requestCameraPermissionsAsync: () => Camera.requestCameraPermissionsAsync(),
  };
}

function isPrivilegedRole(userRole?: string | null): boolean {
  const normalized = String(userRole ?? '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'SUPERVISOR';
}

function hasExecutionPermission(
  inspection: Pick<Inspection, 'technician_id'>,
  technicianId?: string | null,
  userRole?: string | null
): boolean {
  if (isPrivilegedRole(userRole)) {
    return true;
  }
  return isInspectionAssignedToTechnician(inspection, technicianId);
}

async function resolveDatabase(deps: PhotoCaptureDependencies): Promise<SQLiteDatabase> {
  if (deps.db) {
    return deps.db;
  }
  const repoWithInternalDb = deps.inspectionRepo as unknown as { db?: SQLiteDatabase } | undefined;
  if (repoWithInternalDb?.db) {
    return repoWithInternalDb.db;
  }
  const outboxWithInternalDb = deps.outboxRepo as unknown as { db?: SQLiteDatabase } | undefined;
  if (outboxWithInternalDb?.db) {
    return outboxWithInternalDb.db;
  }
  return getDatabase();
}

function resolveRepositories(
  db: SQLiteDatabase,
  deps: PhotoCaptureDependencies
): { inspectionRepo: InspectionRepository; outboxRepo: OutboxRepository } {
  const inspectionRepo =
    deps.inspectionRepo ?? (deps.db ? new InspectionRepository(db) : defaultInspectionRepo);
  const outboxRepo =
    deps.outboxRepo ?? (deps.db ? new OutboxRepository(db) : defaultOutboxRepo);
  return { inspectionRepo, outboxRepo };
}

async function runInAtomicTransaction<T>(
  db: SQLiteDatabase,
  task: () => Promise<T>
): Promise<T> {
  const alreadyInTx =
    typeof db.isInTransactionAsync === 'function'
      ? await db.isInTransactionAsync().catch(() => false)
      : false;

  if (alreadyInTx) {
    return task();
  }

  let startedTx = false;
  try {
    await db.execAsync('BEGIN;');
    startedTx = true;
  } catch {
    startedTx = false;
  }

  try {
    const result = await task();
    if (startedTx) {
      await db.execAsync('COMMIT;');
    }
    return result;
  } catch (err) {
    if (startedTx) {
      await db.execAsync('ROLLBACK;').catch(() => {});
    }
    throw err;
  }
}

/**
 * Solicita permissão de câmera antes da captura (RF-01 / RN-058).
 */
export async function ensureCameraPermission(
  adapter: CameraPermissionAdapter = createDefaultCameraPermissionAdapter()
): Promise<EnsureCameraPermissionResult> {
  try {
    const current = await adapter.getCameraPermissionsAsync();
    const currentGranted =
      Boolean(current?.granted) || String(current?.status ?? '').toLowerCase() === 'granted';

    if (currentGranted) {
      return {
        granted: true,
        status: 'granted',
        canAskAgain: true,
        message: 'Permissão de câmera concedida.',
      };
    }

    const requested = await adapter.requestCameraPermissionsAsync();
    const requestedGranted =
      Boolean(requested?.granted) || String(requested?.status ?? '').toLowerCase() === 'granted';
    const canAskAgain = requested?.canAskAgain !== false;

    if (requestedGranted) {
      return {
        granted: true,
        status: 'granted',
        canAskAgain: true,
        message: 'Permissão de câmera autorizada pelo técnico.',
      };
    }

    return {
      granted: false,
      status: canAskAgain ? 'denied' : 'blocked',
      canAskAgain,
      message: canAskAgain
        ? 'Permissão de câmera recusada. Autorize o uso da câmera para registrar evidências fotográficas.'
        : 'A câmera está bloqueada nas configurações do sistema. Habilite a permissão do FieldOps para continuar.',
    };
  } catch {
    return {
      granted: false,
      status: 'denied',
      canAskAgain: true,
      message: 'Não foi possível verificar ou solicitar a permissão da câmera neste dispositivo.',
    };
  }
}

/**
 * Calcula dimensões proporcionais respeitando o limite máximo configurado (RT-01, RT-03).
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxWidth = MAX_PHOTO_WIDTH,
  maxHeight = MAX_PHOTO_HEIGHT
): TargetDimensions {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      width: maxWidth,
      height: maxHeight,
      shouldResize: false,
    };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  if (scale >= 1) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      shouldResize: false,
    };
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    shouldResize: true,
  };
}

/**
 * Sanitiza metadados sensíveis (EXIF, GPS, número de série do dispositivo, nome original do arquivo),
 * mantendo apenas atributos técnicos seguros para armazenamento e upload (RT-04 / RN-051).
 */
export function sanitizePhotoMetadata(
  rawMetadata: Record<string, unknown> | null | undefined,
  safeDefaults: {
    uuid: string;
    width: number;
    height: number;
    thumbnailWidth: number;
    thumbnailHeight: number;
    capturedAt: string;
    compressionQuality?: number;
  }
): SanitizedPhotoMetadata {
  if (rawMetadata && typeof rawMetadata === 'object') {
    for (const key of Object.keys(rawMetadata)) {
      if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
        // Explicitamente ignorado durante sanitização por lista branca estrita
        continue;
      }
    }
  }

  return {
    uuid: safeDefaults.uuid,
    width: Math.max(1, Math.round(safeDefaults.width)),
    height: Math.max(1, Math.round(safeDefaults.height)),
    thumbnailWidth: Math.max(1, Math.round(safeDefaults.thumbnailWidth)),
    thumbnailHeight: Math.max(1, Math.round(safeDefaults.thumbnailHeight)),
    mimeType: 'image/jpeg',
    compressionQuality: safeDefaults.compressionQuality ?? PHOTO_JPEG_QUALITY,
    capturedAt: safeDefaults.capturedAt,
    exifStripped: true,
  };
}

/**
 * Pipeline de processamento de imagem com expo-image-manipulator:
 * 1) Redimensiona para no máximo 1920x1080 px e comprime em JPEG 0.8 (RT-01)
 * 2) Gera miniatura leve (máx. 320x240 px, JPEG 0.6) para renderização fluida (RT-03)
 */
export async function processAndCompressPhoto(
  params: ProcessAndCompressPhotoParams,
  imageManipulator: ImageManipulatorAdapter = createDefaultImageManipulatorAdapter()
): Promise<ProcessedPhotoOutput> {
  const { sourceUri, originalWidth, originalHeight } = params;
  const includeBase64 = params.includeBase64 ?? Platform.OS === 'web';

  const initialActions: Action[] = [];
  if (originalWidth && originalHeight) {
    const target = calculateTargetDimensions(
      originalWidth,
      originalHeight,
      MAX_PHOTO_WIDTH,
      MAX_PHOTO_HEIGHT
    );
    if (target.shouldResize) {
      initialActions.push({
        resize: {
          width: target.width,
          height: target.height,
        },
      });
    }
  }

  let mainResult = await imageManipulator.manipulateAsync(sourceUri, initialActions, {
    compress: PHOTO_JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: includeBase64,
  });

  // Garante limite máximo 1920x1080 mesmo quando dimensões originais não foram informadas
  if (mainResult.width > MAX_PHOTO_WIDTH || mainResult.height > MAX_PHOTO_HEIGHT) {
    const bounded = calculateTargetDimensions(
      mainResult.width,
      mainResult.height,
      MAX_PHOTO_WIDTH,
      MAX_PHOTO_HEIGHT
    );
    if (bounded.shouldResize) {
      mainResult = await imageManipulator.manipulateAsync(
        mainResult.uri,
        [
          {
            resize: {
              width: bounded.width,
              height: bounded.height,
            },
          },
        ],
        {
          compress: PHOTO_JPEG_QUALITY,
          format: SaveFormat.JPEG,
          base64: includeBase64,
        }
      );
    }
  }

  const thumbTarget = calculateTargetDimensions(
    mainResult.width,
    mainResult.height,
    THUMBNAIL_MAX_WIDTH,
    THUMBNAIL_MAX_HEIGHT
  );
  const thumbActions: Action[] = thumbTarget.shouldResize
    ? [
        {
          resize: {
            width: thumbTarget.width,
            height: thumbTarget.height,
          },
        },
      ]
    : [];

  const thumbResult = await imageManipulator.manipulateAsync(mainResult.uri, thumbActions, {
    compress: THUMBNAIL_JPEG_QUALITY,
    format: SaveFormat.JPEG,
    base64: includeBase64,
  });

  return {
    photoUri: mainResult.uri,
    thumbnailUri: thumbResult.uri,
    width: mainResult.width,
    height: mainResult.height,
    thumbnailWidth: thumbResult.width,
    thumbnailHeight: thumbResult.height,
    photoBase64: mainResult.base64,
    thumbnailBase64: thumbResult.base64,
  };
}

/**
 * Garante a criação da tabela `evidence_files` no SQLite local (RF-05, CA-04)
 * mantendo compatibilidade integral com `inspection_evidences` do schema v1.
 */
export async function ensureEvidenceFilesTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS evidence_files (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      item_id TEXT,
      non_conformity_id TEXT,
      local_uri TEXT NOT NULL,
      thumbnail_uri TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      width INTEGER,
      height INTEGER,
      thumbnail_width INTEGER,
      thumbnail_height INTEGER,
      sanitized_metadata_json TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED')),
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES checklist_items(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_files_inspection
      ON evidence_files(inspection_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_evidence_files_item
      ON evidence_files(item_id);
  `);
}

/**
 * Executa o fluxo completo de captura confirmada:
 * - Valida permissão e estado editável da inspeção (EX-02)
 * - Gera UUID único (RF-06)
 * - Redimensiona (máx 1920x1080), comprime JPEG 0.8 e gera thumbnail (RT-01, RT-03)
 * - Salva em `documentDirectory + 'evidences/'` (RT-02, CA-01)
 * - Sanitiza metadados sensíveis (RT-04)
 * - Grava registro em `evidence_files` e `inspection_evidences` com status `PENDING` + `UPLOAD_EVIDENCE` na Outbox (RF-05, CA-04)
 * - Trata falta de espaço em disco emitindo alerta amigável sem fechar o app (EX-01)
 */
export async function captureAndSaveEvidence(
  params: CaptureAndSaveEvidenceParams,
  deps: PhotoCaptureDependencies = {}
): Promise<CaptureAndSaveEvidenceResult> {
  const nowFn = deps.now ?? (() => new Date());
  const uuidFn = deps.uuidGenerator ?? generateUUID;
  const fsAdapter = deps.fileSystem ?? createDefaultFileSystemAdapter();
  const manipulator = deps.imageManipulator ?? createDefaultImageManipulatorAdapter();

  let savedLocalUri: string | null = null;
  let savedThumbnailUri: string | null = null;

  try {
    const db = await resolveDatabase(deps);
    await ensureEvidenceFilesTable(db);
    const { inspectionRepo, outboxRepo } = resolveRepositories(db, deps);

    const inspection =
      (await inspectionRepo.findById(params.inspectionId)) ??
      (await inspectionRepo.findByRemoteId(params.inspectionId));

    if (!inspection) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: 'Inspeção não encontrada no armazenamento local.',
        evidence: null,
        outboxOperation: null,
      };
    }

    if (!hasExecutionPermission(inspection, params.technicianId, params.userRole)) {
      return {
        success: false,
        code: 'FORBIDDEN_TECHNICIAN',
        message: 'Permissão negada: somente o técnico atribuído pode anexar evidências.',
        evidence: null,
        outboxOperation: null,
      };
    }

    if (isInspectionReadOnly(inspection.status)) {
      return {
        success: false,
        code: 'READ_ONLY_INSPECTION',
        message: `Edição bloqueada: inspeção no estado ${inspection.status} está em modo somente leitura.`,
        evidence: null,
        outboxOperation: null,
      };
    }

    const evidenceId = uuidFn();
    const capturedAt = nowFn().toISOString();

    const processed = await processAndCompressPhoto(
      {
        sourceUri: params.sourceUri,
        originalWidth: params.originalWidth,
        originalHeight: params.originalHeight,
      },
      manipulator
    );

    const storedFiles = await saveEvidenceFilesToPermanentStorage(
      {
        evidenceId,
        processedPhotoUri: processed.photoUri,
        processedThumbnailUri: processed.thumbnailUri,
        photoBase64: processed.photoBase64,
        thumbnailBase64: processed.thumbnailBase64,
      },
      fsAdapter
    );
    savedLocalUri = storedFiles.localUri;
    savedThumbnailUri = storedFiles.thumbnailUri;

    const sanitizedMetadata = sanitizePhotoMetadata(params.rawMetadata, {
      uuid: evidenceId,
      width: processed.width,
      height: processed.height,
      thumbnailWidth: processed.thumbnailWidth,
      thumbnailHeight: processed.thumbnailHeight,
      capturedAt,
      compressionQuality: PHOTO_JPEG_QUALITY,
    });
    const sanitizedMetadataJson = JSON.stringify(sanitizedMetadata);

    const outboxOpId = uuidFn();
    const outboxPayload = JSON.stringify({
      evidenceId,
      inspectionId: inspection.id,
      remoteInspectionId: inspection.remote_id ?? null,
      itemId: params.itemId ?? null,
      nonConformityId: params.nonConformityId ?? null,
      fileName: storedFiles.fileName,
      mimeType: 'image/jpeg',
      fileSize: storedFiles.fileSize,
      metadata: sanitizedMetadata,
      createdAt: capturedAt,
    });

    const outboxOperation = await runInAtomicTransaction(db, async () => {
      await db.runAsync(
        `INSERT INTO evidence_files (
          id, inspection_id, item_id, non_conformity_id, local_uri, thumbnail_uri,
          file_name, file_size, mime_type, width, height, thumbnail_width, thumbnail_height,
          sanitized_metadata_json, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          evidenceId,
          inspection.id,
          params.itemId ?? null,
          params.nonConformityId ?? null,
          storedFiles.localUri,
          storedFiles.thumbnailUri,
          storedFiles.fileName,
          storedFiles.fileSize,
          'image/jpeg',
          processed.width,
          processed.height,
          processed.thumbnailWidth,
          processed.thumbnailHeight,
          sanitizedMetadataJson,
          'PENDING',
          null,
          capturedAt,
        ]
      );

      await db.runAsync(
        `INSERT INTO inspection_evidences (
          id, inspection_id, item_id, local_uri, remote_key, remote_url,
          file_size, mime_type, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          evidenceId,
          inspection.id,
          params.itemId ?? null,
          storedFiles.localUri,
          null,
          null,
          storedFiles.fileSize,
          'image/jpeg',
          'PENDING',
          null,
          capturedAt,
        ]
      );

      await inspectionRepo.update(inspection.id, {
        sync_status: 'PENDENTE',
      });

      await outboxRepo.create({
        id: outboxOpId,
        entity_type: 'EVIDENCE',
        global_id: evidenceId,
        operation_type: 'UPLOAD_EVIDENCE',
        payload: outboxPayload,
        status: 'PENDING',
      });

      return (
        (await outboxRepo.findById(outboxOpId)) ?? {
          id: outboxOpId,
          entity_type: 'EVIDENCE',
          global_id: evidenceId,
          operation_type: 'UPLOAD_EVIDENCE',
          payload: outboxPayload,
          dependencies: [],
          status: 'PENDING' as const,
          retries: 0,
          created_at: capturedAt,
          updated_at: capturedAt,
        }
      );
    });

    const evidence: EvidenceRecord = {
      id: evidenceId,
      inspection_id: inspection.id,
      item_id: params.itemId ?? null,
      non_conformity_id: params.nonConformityId ?? null,
      local_uri: storedFiles.localUri,
      thumbnail_uri: storedFiles.thumbnailUri,
      file_name: storedFiles.fileName,
      file_size: storedFiles.fileSize,
      mime_type: 'image/jpeg',
      width: processed.width,
      height: processed.height,
      thumbnail_width: processed.thumbnailWidth,
      thumbnail_height: processed.thumbnailHeight,
      sanitized_metadata_json: sanitizedMetadataJson,
      status: 'PENDING',
      error_message: null,
      created_at: capturedAt,
    };

    return {
      success: true,
      code: 'CAPTURED',
      message: 'Evidência fotográfica salva localmente com sucesso.',
      evidence,
      outboxOperation,
    };
  } catch (err) {
    if (savedLocalUri || savedThumbnailUri) {
      await deleteStoredPhotoFiles(savedLocalUri, savedThumbnailUri, fsAdapter).catch(() => {});
    }

    const mapped = mapStorageException(err);
    if (isInsufficientStorageError(mapped)) {
      params.onStorageAlert?.(mapped.userAlertTitle, mapped.userAlertMessage);
      return {
        success: false,
        code: 'INSUFFICIENT_STORAGE',
        message: mapped.userAlertMessage,
        alertTitle: mapped.userAlertTitle,
        alertMessage: mapped.userAlertMessage,
        evidence: null,
        outboxOperation: null,
      };
    }

    return {
      success: false,
      code: 'CAPTURE_ERROR',
      message: mapped.message || 'Falha ao processar e armazenar a fotografia localmente.',
      evidence: null,
      outboxOperation: null,
    };
  }
}

interface EvidenceFileRow {
  id: string;
  inspection_id: string;
  item_id: string | null;
  non_conformity_id: string | null;
  local_uri: string;
  thumbnail_uri: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  sanitized_metadata_json: string | null;
  status: EvidenceStatus;
  error_message: string | null;
  created_at: string;
}

/**
 * Lista todas as evidências persistidas localmente para uma inspeção, mesclando `evidence_files`
 * e registros legados de `inspection_evidences` (RF-04, CA-02, CA-03).
 */
export async function listInspectionEvidences(
  inspectionId: string,
  deps: PhotoCaptureDependencies = {}
): Promise<EvidenceRecord[]> {
  if (!inspectionId) {
    return [];
  }

  const db = await resolveDatabase(deps);
  await ensureEvidenceFilesTable(db);
  const { inspectionRepo } = resolveRepositories(db, deps);

  const inspection =
    (await inspectionRepo.findById(inspectionId)) ??
    (await inspectionRepo.findByRemoteId(inspectionId));
  const resolvedInspectionId = inspection?.id ?? inspectionId;

  const [fileRows, legacyRows] = await Promise.all([
    db.getAllAsync<EvidenceFileRow>(
      'SELECT * FROM evidence_files WHERE inspection_id = ? ORDER BY created_at ASC;',
      [resolvedInspectionId]
    ),
    db.getAllAsync<InspectionEvidence>(
      'SELECT * FROM inspection_evidences WHERE inspection_id = ? ORDER BY created_at ASC;',
      [resolvedInspectionId]
    ),
  ]);

  const byId = new Map<string, EvidenceRecord>();

  for (const row of legacyRows) {
    byId.set(row.id, {
      ...row,
      thumbnail_uri: row.local_uri,
    });
  }

  for (const row of fileRows) {
    const existing = byId.get(row.id);
    byId.set(row.id, {
      id: row.id,
      inspection_id: row.inspection_id,
      item_id: row.item_id ?? existing?.item_id ?? null,
      non_conformity_id: row.non_conformity_id ?? null,
      local_uri: row.local_uri,
      thumbnail_uri: row.thumbnail_uri ?? row.local_uri,
      remote_key: existing?.remote_key ?? null,
      remote_url: existing?.remote_url ?? null,
      file_name: row.file_name,
      file_size: row.file_size ?? existing?.file_size ?? null,
      mime_type: row.mime_type || existing?.mime_type || 'image/jpeg',
      width: row.width ?? null,
      height: row.height ?? null,
      thumbnail_width: row.thumbnail_width ?? null,
      thumbnail_height: row.thumbnail_height ?? null,
      sanitized_metadata_json: row.sanitized_metadata_json ?? null,
      status: row.status,
      error_message: row.error_message ?? existing?.error_message ?? null,
      created_at: row.created_at ?? existing?.created_at,
    });
  }

  return Array.from(byId.values());
}

/**
 * Exclui localmente uma foto antes do envio. Bloqueia estritamente se a inspeção estiver
 * aprovada/concluída em modo somente leitura ou se a foto já tiver sido enviada (EX-02 / RN-049).
 */
export async function deleteEvidencePhoto(
  params: DeleteEvidencePhotoParams,
  deps: PhotoCaptureDependencies = {}
): Promise<DeleteEvidencePhotoResult> {
  const db = await resolveDatabase(deps);
  await ensureEvidenceFilesTable(db);
  const { inspectionRepo } = resolveRepositories(db, deps);
  const fsAdapter = deps.fileSystem ?? createDefaultFileSystemAdapter();

  const inspection =
    (await inspectionRepo.findById(params.inspectionId)) ??
    (await inspectionRepo.findByRemoteId(params.inspectionId));

  if (!inspection) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Inspeção não encontrada no armazenamento local.',
      deletedId: null,
    };
  }

  if (!hasExecutionPermission(inspection, params.technicianId, params.userRole)) {
    return {
      success: false,
      code: 'FORBIDDEN_TECHNICIAN',
      message: 'Permissão negada: somente o técnico atribuído pode excluir esta evidência.',
      deletedId: null,
    };
  }

  if (isInspectionReadOnly(inspection.status)) {
    return {
      success: false,
      code: 'READ_ONLY_EVIDENCE',
      message: `Exclusão bloqueada: fotos de inspeções no estado ${inspection.status} são estritamente somente leitura.`,
      deletedId: null,
    };
  }

  const fileRow = await db.getFirstAsync<EvidenceFileRow>(
    'SELECT * FROM evidence_files WHERE id = ? AND inspection_id = ?;',
    [params.evidenceId, inspection.id]
  );
  const legacyRow = await db.getFirstAsync<InspectionEvidence>(
    'SELECT * FROM inspection_evidences WHERE id = ? AND inspection_id = ?;',
    [params.evidenceId, inspection.id]
  );

  const target = fileRow ?? legacyRow;
  if (!target) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Evidência fotográfica não encontrada.',
      deletedId: null,
    };
  }

  if (target.status === 'UPLOADED' || target.status === 'UPLOADING') {
    return {
      success: false,
      code: 'READ_ONLY_EVIDENCE',
      message: 'Exclusão bloqueada: esta evidência já foi enviada ou está em sincronização.',
      deletedId: null,
    };
  }

  await runInAtomicTransaction(db, async () => {
    await db.runAsync('DELETE FROM evidence_files WHERE id = ?;', [params.evidenceId]);
    await db.runAsync('DELETE FROM inspection_evidences WHERE id = ?;', [params.evidenceId]);
    await db.runAsync(
      "DELETE FROM outbox_operations WHERE entity_type = 'EVIDENCE' AND global_id = ?;",
      [params.evidenceId]
    );
  });

  await deleteStoredPhotoFiles(
    target.local_uri,
    fileRow?.thumbnail_uri ?? null,
    fsAdapter
  );

  return {
    success: true,
    code: 'DELETED',
    message: 'Evidência removida localmente com sucesso.',
    deletedId: params.evidenceId,
  };
}
