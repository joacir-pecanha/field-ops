import * as LegacyFileSystem from 'expo-file-system/legacy';

export const EVIDENCES_DIR_NAME = 'evidences/';
export const MIN_FREE_STORAGE_BYTES = 5 * 1024 * 1024; // 5 MB de margem mínima de segurança
export const WEB_DOCUMENT_DIRECTORY = 'fieldops-web://documents/';
export const WEB_CACHE_DIRECTORY = 'fieldops-web://cache/';
export const WEB_EVIDENCE_STORAGE_KEY = 'fieldops:web_evidence_files:v1';

export interface FileInfoResult {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  uri?: string;
}

export interface FileSystemAdapter {
  documentDirectory: string | null;
  cacheDirectory: string | null;
  getInfoAsync: (uri: string, options?: { md5?: boolean }) => Promise<FileInfoResult>;
  makeDirectoryAsync: (uri: string, options?: { intermediates?: boolean }) => Promise<void>;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
  getFreeDiskStorageAsync?: () => Promise<number>;
  writeAsStringAsync?: (
    uri: string,
    contents: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ) => Promise<void>;
  readAsStringAsync?: (
    uri: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ) => Promise<string>;
}

export class InsufficientStorageError extends Error {
  readonly code = 'INSUFFICIENT_STORAGE' as const;
  readonly userAlertTitle: string;
  readonly userAlertMessage: string;

  constructor(
    message = 'Não há espaço suficiente no dispositivo para salvar a fotografia. Libere espaço de armazenamento e tente novamente.',
    title = 'Armazenamento Insuficiente'
  ) {
    super(message);
    this.name = 'InsufficientStorageError';
    this.userAlertTitle = title;
    this.userAlertMessage = message;
  }
}

export function isInsufficientStorageError(error: unknown): error is InsufficientStorageError {
  return (
    error instanceof InsufficientStorageError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'INSUFFICIENT_STORAGE')
  );
}

export function mapStorageException(error: unknown): Error {
  if (isInsufficientStorageError(error)) {
    return error;
  }

  const rawMessage =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes('enospc') ||
    normalized.includes('no space left') ||
    normalized.includes('disk full') ||
    normalized.includes('insufficient storage') ||
    normalized.includes('storage full') ||
    normalized.includes('sqlite_full') ||
    normalized.includes('quotaexceeded') ||
    normalized.includes('quota exceeded') ||
    normalized.includes('espaço insuficiente') ||
    normalized.includes('espaco insuficiente')
  ) {
    return new InsufficientStorageError();
  }

  return error instanceof Error ? error : new Error(rawMessage || 'Erro ao gravar arquivo local.');
}

function normalizeDirectoryUri(uri: string): string {
  return uri.replace(/\/*$/, '') + '/';
}

function isInCacheDirectory(uri: string, cacheDirectory?: string | null): boolean {
  const normalizedUri = uri.trim();
  if (!normalizedUri) return false;

  if (cacheDirectory) {
    const normalizedCache = normalizeDirectoryUri(cacheDirectory);
    if (normalizedUri.startsWith(normalizedCache)) {
      return true;
    }
  }

  return (
    normalizedUri.startsWith(WEB_CACHE_DIRECTORY) ||
    /(?:^|\/)(?:cache|caches)(?:\/|$)/i.test(normalizedUri)
  );
}

/**
 * Garante que nenhum arquivo de evidência seja gravado em cacheDirectory (RT-02 / RN-047).
 */
export function assertNotCacheDirectory(
  targetUri: string,
  cacheDirectory?: string | null,
  documentDirectory?: string | null
): void {
  const trimmedTarget = targetUri.trim();
  if (!trimmedTarget) {
    throw new Error('Caminho de destino da evidência não pode ser vazio.');
  }

  if (cacheDirectory) {
    const normalizedCache = normalizeDirectoryUri(cacheDirectory);
    if (trimmedTarget.startsWith(normalizedCache)) {
      throw new Error(
        `Operação bloqueada (RT-02): evidências nunca devem ser gravadas em cacheDirectory (${trimmedTarget}).`
      );
    }
  }

  if (documentDirectory) {
    const normalizedDoc = normalizeDirectoryUri(documentDirectory);
    if (!trimmedTarget.startsWith(normalizedDoc)) {
      throw new Error(
        `Operação bloqueada (RT-02): evidências devem residir no diretório permanente documentDirectory (${normalizedDoc}).`
      );
    }
    return;
  }

  if (isInCacheDirectory(trimmedTarget, cacheDirectory)) {
    throw new Error(
      `Operação bloqueada (RT-02): destino inválido em diretório temporário de cache (${trimmedTarget}).`
    );
  }
}

interface WebStoredFileRecord {
  dataUrl: string;
  size: number;
  createdAt: string;
}

const webMemoryFileMap = new Map<string, WebStoredFileRecord>();
const webMemoryDirectories = new Set<string>([WEB_DOCUMENT_DIRECTORY]);

function readWebStorageCatalog(): Record<string, WebStoredFileRecord> {
  if (typeof globalThis.localStorage === 'undefined') {
    return Object.fromEntries(webMemoryFileMap.entries());
  }
  try {
    const raw = globalThis.localStorage.getItem(WEB_EVIDENCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, WebStoredFileRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return Object.fromEntries(webMemoryFileMap.entries());
  }
}

function writeWebStorageCatalog(catalog: Record<string, WebStoredFileRecord>): void {
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }
  try {
    globalThis.localStorage.setItem(WEB_EVIDENCE_STORAGE_KEY, JSON.stringify(catalog));
  } catch (err) {
    throw mapStorageException(err);
  }
}

function saveWebStoredFile(uri: string, dataUrl: string): number {
  const estimatedBytes = estimateDataUrlByteSize(dataUrl);
  const record: WebStoredFileRecord = {
    dataUrl,
    size: estimatedBytes,
    createdAt: new Date().toISOString(),
  };

  webMemoryFileMap.set(uri, record);
  const catalog = readWebStorageCatalog();
  catalog[uri] = record;
  writeWebStorageCatalog(catalog);
  return estimatedBytes;
}

function getWebStoredFile(uri: string): WebStoredFileRecord | null {
  const inMemory = webMemoryFileMap.get(uri);
  if (inMemory) {
    return inMemory;
  }
  const catalog = readWebStorageCatalog();
  const persisted = catalog[uri] ?? null;
  if (persisted) {
    webMemoryFileMap.set(uri, persisted);
  }
  return persisted;
}

function deleteWebStoredFile(uri: string): void {
  webMemoryFileMap.delete(uri);
  const catalog = readWebStorageCatalog();
  if (uri in catalog) {
    delete catalog[uri];
    writeWebStorageCatalog(catalog);
  }
}

export function clearWebEvidenceStorage(): void {
  webMemoryFileMap.clear();
  webMemoryDirectories.clear();
  webMemoryDirectories.add(WEB_DOCUMENT_DIRECTORY);
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.removeItem(WEB_EVIDENCE_STORAGE_KEY);
    } catch {
      // Ignora erro de limpeza em ambiente restrito
    }
  }
}

export function createWebFileSystemAdapter(): FileSystemAdapter {
  return {
    documentDirectory: WEB_DOCUMENT_DIRECTORY,
    cacheDirectory: WEB_CACHE_DIRECTORY,
    async getInfoAsync(uri: string): Promise<FileInfoResult> {
      const normalizedDir = uri.endsWith('/') ? uri : `${uri}/`;
      if (webMemoryDirectories.has(uri) || webMemoryDirectories.has(normalizedDir)) {
        return { exists: true, isDirectory: true, uri };
      }
      const stored = getWebStoredFile(uri);
      if (stored) {
        return {
          exists: true,
          isDirectory: false,
          size: stored.size,
          uri,
        };
      }
      return { exists: false, isDirectory: false, uri };
    },
    async makeDirectoryAsync(uri: string): Promise<void> {
      webMemoryDirectories.add(normalizeDirectoryUri(uri));
    },
    async copyAsync({ from, to }: { from: string; to: string }): Promise<void> {
      const fromStored = getWebStoredFile(from);
      const dataUrl = fromStored ? fromStored.dataUrl : from;
      saveWebStoredFile(to, dataUrl);
    },
    async deleteAsync(uri: string): Promise<void> {
      deleteWebStoredFile(uri);
    },
    async writeAsStringAsync(uri: string, contents: string, options): Promise<void> {
      const dataUrl =
        contents.startsWith('data:')
          ? contents
          : options?.encoding === 'base64'
            ? `data:image/jpeg;base64,${contents}`
            : contents;
      saveWebStoredFile(uri, dataUrl);
    },
    async readAsStringAsync(uri: string): Promise<string> {
      const stored = getWebStoredFile(uri);
      return stored?.dataUrl ?? '';
    },
  };
}

export function createDefaultFileSystemAdapter(): FileSystemAdapter {
  if (LegacyFileSystem.documentDirectory) {
    return {
      documentDirectory: LegacyFileSystem.documentDirectory,
      cacheDirectory: LegacyFileSystem.cacheDirectory ?? null,
      getInfoAsync: (uri, options) => LegacyFileSystem.getInfoAsync(uri, options),
      makeDirectoryAsync: (uri, options) => LegacyFileSystem.makeDirectoryAsync(uri, options),
      copyAsync: (options) => LegacyFileSystem.copyAsync(options),
      deleteAsync: (uri, options) => LegacyFileSystem.deleteAsync(uri, options),
      getFreeDiskStorageAsync:
        typeof LegacyFileSystem.getFreeDiskStorageAsync === 'function'
          ? () => LegacyFileSystem.getFreeDiskStorageAsync()
          : undefined,
      writeAsStringAsync: (uri, contents, options) =>
        LegacyFileSystem.writeAsStringAsync(uri, contents, options),
      readAsStringAsync: (uri, options) =>
        LegacyFileSystem.readAsStringAsync(uri, options),
    };
  }

  return createWebFileSystemAdapter();
}

export function resolveEvidencesDirectory(
  adapter: FileSystemAdapter = createDefaultFileSystemAdapter()
): string {
  const baseDocDir = adapter.documentDirectory;
  if (!baseDocDir) {
    throw new Error(
      'documentDirectory indisponível para armazenamento permanente de evidências.'
    );
  }
  const evidencesDir = `${normalizeDirectoryUri(baseDocDir)}${EVIDENCES_DIR_NAME}`;
  assertNotCacheDirectory(evidencesDir, adapter.cacheDirectory, baseDocDir);
  return evidencesDir;
}

/**
 * Garante a criação da pasta permanente `FileSystem.documentDirectory + 'evidences/'` (Passo 1 / RT-02).
 */
export async function ensureEvidencesDirectory(
  adapter: FileSystemAdapter = createDefaultFileSystemAdapter()
): Promise<string> {
  const evidencesDir = resolveEvidencesDirectory(adapter);
  try {
    const dirInfo = await adapter.getInfoAsync(evidencesDir);
    if (!dirInfo.exists) {
      await adapter.makeDirectoryAsync(evidencesDir, { intermediates: true });
    }
    return evidencesDir;
  } catch (err) {
    throw mapStorageException(err);
  }
}

export async function checkAvailableStorageSpace(
  requiredBytes = 512 * 1024,
  adapter: FileSystemAdapter = createDefaultFileSystemAdapter()
): Promise<void> {
  if (typeof adapter.getFreeDiskStorageAsync !== 'function') {
    return;
  }
  try {
    const freeBytes = await adapter.getFreeDiskStorageAsync();
    if (
      typeof freeBytes === 'number' &&
      Number.isFinite(freeBytes) &&
      freeBytes >= 0 &&
      freeBytes < MIN_FREE_STORAGE_BYTES + Math.max(0, requiredBytes)
    ) {
      throw new InsufficientStorageError();
    }
  } catch (err) {
    throw mapStorageException(err);
  }
}

function estimateDataUrlByteSize(dataUrlOrBase64: string): number {
  const trimmed = dataUrlOrBase64.trim();
  if (!trimmed) return 0;
  const commaIdx = trimmed.indexOf(',');
  const base64Part = commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  return Math.max(1, Math.floor((base64Part.length * 3) / 4));
}

function stripDataUrlPrefix(uriOrDataUrl: string): string {
  const commaIdx = uriOrDataUrl.indexOf(',');
  return commaIdx >= 0 ? uriOrDataUrl.slice(commaIdx + 1) : uriOrDataUrl;
}

async function persistSingleFileToPermanentPath(params: {
  sourceUri: string;
  targetUri: string;
  base64Fallback?: string;
  adapter: FileSystemAdapter;
}): Promise<number> {
  const { sourceUri, targetUri, base64Fallback, adapter } = params;

  assertNotCacheDirectory(targetUri, adapter.cacheDirectory, adapter.documentDirectory);

  const isWebAdapter = adapter.documentDirectory === WEB_DOCUMENT_DIRECTORY;
  if (isWebAdapter) {
    const payloadDataUrl = base64Fallback
      ? base64Fallback.startsWith('data:')
        ? base64Fallback
        : `data:image/jpeg;base64,${base64Fallback}`
      : sourceUri;
    return saveWebStoredFile(targetUri, payloadDataUrl);
  }

  if (sourceUri !== targetUri) {
    if (sourceUri.startsWith('data:') && typeof adapter.writeAsStringAsync === 'function') {
      await adapter.writeAsStringAsync(targetUri, stripDataUrlPrefix(sourceUri), {
        encoding: 'base64',
      });
    } else if (base64Fallback && !sourceUri.startsWith('file://') && typeof adapter.writeAsStringAsync === 'function') {
      await adapter.writeAsStringAsync(targetUri, stripDataUrlPrefix(base64Fallback), {
        encoding: 'base64',
      });
    } else {
      await adapter.copyAsync({ from: sourceUri, to: targetUri });
    }
  }

  const info = await adapter.getInfoAsync(targetUri);
  if (typeof info.size === 'number' && info.size > 0) {
    return info.size;
  }

  if (base64Fallback) {
    return estimateDataUrlByteSize(base64Fallback);
  }
  if (sourceUri.startsWith('data:')) {
    return estimateDataUrlByteSize(sourceUri);
  }
  return 0;
}

export interface SaveEvidenceFilesParams {
  evidenceId: string;
  processedPhotoUri: string;
  processedThumbnailUri: string;
  photoBase64?: string;
  thumbnailBase64?: string;
  estimatedBytes?: number;
}

export interface SavedEvidenceFilesResult {
  evidencesDirectory: string;
  fileName: string;
  thumbnailFileName: string;
  localUri: string;
  thumbnailUri: string;
  fileSize: number;
  thumbnailSize: number;
}

/**
 * Copia foto comprimida e miniatura para `documentDirectory + 'evidences/'` com UUID exclusivo (RF-06, RT-02, CA-01).
 * Limpa arquivos temporários se residirem em cacheDirectory e trata erros de armazenamento sem fechar o app (EX-01).
 */
export async function saveEvidenceFilesToPermanentStorage(
  params: SaveEvidenceFilesParams,
  adapter: FileSystemAdapter = createDefaultFileSystemAdapter()
): Promise<SavedEvidenceFilesResult> {
  const {
    evidenceId,
    processedPhotoUri,
    processedThumbnailUri,
    photoBase64,
    thumbnailBase64,
    estimatedBytes,
  } = params;

  try {
    const evidencesDirectory = await ensureEvidencesDirectory(adapter);
    const fileName = `${evidenceId}.jpg`;
    const thumbnailFileName = `${evidenceId}_thumb.jpg`;
    const localUri = `${evidencesDirectory}${fileName}`;
    const thumbnailUri = `${evidencesDirectory}${thumbnailFileName}`;

    assertNotCacheDirectory(localUri, adapter.cacheDirectory, adapter.documentDirectory);
    assertNotCacheDirectory(thumbnailUri, adapter.cacheDirectory, adapter.documentDirectory);

    const estimatedRequired =
      estimatedBytes ??
      (photoBase64 ? estimateDataUrlByteSize(photoBase64) : 512 * 1024);
    await checkAvailableStorageSpace(estimatedRequired, adapter);

    const fileSize = await persistSingleFileToPermanentPath({
      sourceUri: processedPhotoUri,
      targetUri: localUri,
      base64Fallback: photoBase64,
      adapter,
    });

    const thumbnailSize = await persistSingleFileToPermanentPath({
      sourceUri: processedThumbnailUri,
      targetUri: thumbnailUri,
      base64Fallback: thumbnailBase64,
      adapter,
    });

    // Remove arquivos temporários de origem apenas se residirem no cache temporário
    if (
      processedPhotoUri !== localUri &&
      isInCacheDirectory(processedPhotoUri, adapter.cacheDirectory)
    ) {
      await adapter.deleteAsync(processedPhotoUri, { idempotent: true }).catch(() => {});
    }
    if (
      processedThumbnailUri !== thumbnailUri &&
      isInCacheDirectory(processedThumbnailUri, adapter.cacheDirectory)
    ) {
      await adapter.deleteAsync(processedThumbnailUri, { idempotent: true }).catch(() => {});
    }

    return {
      evidencesDirectory,
      fileName,
      thumbnailFileName,
      localUri,
      thumbnailUri,
      fileSize,
      thumbnailSize,
    };
  } catch (err) {
    throw mapStorageException(err);
  }
}

export async function deleteStoredPhotoFiles(
  localUri?: string | null,
  thumbnailUri?: string | null,
  adapter: FileSystemAdapter = createDefaultFileSystemAdapter()
): Promise<void> {
  const targets = [localUri, thumbnailUri].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0
  );

  for (const target of targets) {
    if (target.startsWith('fieldops-web://')) {
      deleteWebStoredFile(target);
      continue;
    }
    try {
      await adapter.deleteAsync(target, { idempotent: true });
    } catch {
      // Idempotente: não bloqueia exclusão de registro se arquivo já não existir
    }
  }
}

/**
 * Resolve URI armazenada (nativa file:// ou persistida no Web localStorage) para exibição imediata em <Image>.
 */
export function resolveRenderableEvidenceUri(uri?: string | null): string {
  if (!uri) {
    return '';
  }
  if (uri.startsWith('fieldops-web://')) {
    const stored = getWebStoredFile(uri);
    if (stored?.dataUrl) {
      return stored.dataUrl;
    }
  }
  return uri;
}
