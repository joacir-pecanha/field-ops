export interface UploadEvidenceRequest {
  operationId: string;
  evidenceId: string;
  inspectionId: string;
  itemId?: string | null;
  nonConformityId?: string | null;
  fileName: string;
  mimeType: string;
  localUri: string;
  clientTimestamp?: string | null;
  description?: string | null;
}

export interface UploadEvidenceResponse {
  evidence_id?: string;
  evidenceId?: string;
  id?: string;
  status?: string;
  storage_key?: string;
  storageKey?: string;
  url?: string;
  already_processed?: boolean;
  alreadyProcessed?: boolean;
}

export interface NativeMultipartFilePart {
  uri: string;
  name: string;
  type: string;
  size: number;
  bytes: () => Promise<Uint8Array<ArrayBuffer>>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

const WEB_EVIDENCE_STORAGE_KEY = 'fieldops:web_evidence_files:v1';

function ensureArrayBufferBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  if (input.buffer instanceof ArrayBuffer) {
    return input as Uint8Array<ArrayBuffer>;
  }
  const buffer = new ArrayBuffer(input.byteLength);
  const copy = new Uint8Array(buffer);
  copy.set(input);
  return copy;
}

/**
 * Decodifica uma string base64 para bytes binários compatíveis com Blob/FormData.
 */
export function decodeBase64ToBytes(base64Payload: string): Uint8Array<ArrayBuffer> {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(base64Payload);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    const decoded = Buffer.from(base64Payload, 'base64');
    const buffer = new ArrayBuffer(decoded.byteLength);
    const bytes = new Uint8Array(buffer);
    bytes.set(decoded);
    return bytes;
  }

  throw new Error('Decodificador base64 indisponível neste ambiente.');
}

/**
 * Resolve uma URI `fieldops-web://` armazenada no localStorage do Expo Web para sua Data URL base64.
 * Implementado sem importar `expo-file-system` para manter compatibilidade com testes Node.
 */
export function resolveStoredEvidenceUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('fieldops-web://')) {
    return trimmed;
  }

  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const raw = storage?.getItem(WEB_EVIDENCE_STORAGE_KEY);
    if (!raw) {
      return trimmed;
    }
    const catalog = JSON.parse(raw) as Record<string, { dataUrl?: string }>;
    const storedDataUrl = catalog?.[trimmed]?.dataUrl;
    if (typeof storedDataUrl === 'string' && storedDataUrl.trim().length > 0) {
      return storedDataUrl.trim();
    }
  } catch {
    // Ignora falha ao ler localStorage e retorna URI original
  }

  return trimmed;
}

/**
 * Decodifica uma Data URL (`data:<mime>;base64,<payload>`) em Blob binário pronto para FormData.
 */
export function decodeDataUrlToBlob(
  dataUrl: string,
  fallbackMimeType = 'image/jpeg'
): { blob: Blob; mimeType: string } {
  const trimmed = dataUrl.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx < 0) {
    throw new Error('Data URL de evidência inválida para upload multipart.');
  }

  const header = trimmed.slice(0, commaIdx);
  const payload = trimmed.slice(commaIdx + 1);
  const mimeMatch = /^data:([^;,]+)/i.exec(header);
  const mimeType = mimeMatch?.[1]?.trim() || fallbackMimeType;
  const isBase64 = /;base64/i.test(header);

  let bytes: Uint8Array<ArrayBuffer>;
  if (isBase64) {
    bytes = decodeBase64ToBytes(payload);
  } else {
    const decodedText = decodeURIComponent(payload);
    const encoded = new TextEncoder().encode(decodedText);
    bytes = ensureArrayBufferBytes(encoded);
  }

  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
  };
}

/**
 * Lê os bytes de uma evidência armazenada localmente em Android/iOS via `expo-file-system`.
 * Importação dinâmica mantém compatibilidade com execução de testes em Node.js.
 */
export async function readNativeEvidenceBytes(uri: string): Promise<Uint8Array<ArrayBuffer>> {
  let modernError: unknown = null;

  try {
    const fsModule = await import('expo-file-system');
    if (typeof fsModule.File === 'function') {
      const nativeFile = new fsModule.File(uri);
      if (typeof nativeFile.bytes === 'function') {
        const rawBytes = await nativeFile.bytes();
        return ensureArrayBufferBytes(rawBytes);
      }
    }
  } catch (err) {
    modernError = err;
  }

  try {
    const legacyFs = await import('expo-file-system/legacy');
    if (typeof legacyFs.readAsStringAsync === 'function') {
      const base64 = await legacyFs.readAsStringAsync(uri, { encoding: 'base64' });
      return decodeBase64ToBytes(base64);
    }
  } catch (legacyErr) {
    const cause =
      legacyErr instanceof Error
        ? legacyErr.message
        : modernError instanceof Error
          ? modernError.message
          : String(legacyErr ?? modernError ?? 'erro desconhecido');
    throw new Error(`Falha ao ler arquivo local da evidência (${uri}): ${cause}`);
  }

  const fallbackMsg =
    modernError instanceof Error ? modernError.message : 'módulo expo-file-system indisponível';
  throw new Error(`Falha ao ler arquivo local da evidência (${uri}): ${fallbackMsg}`);
}

/**
 * Constrói uma parte multipart compatível com `expo/fetch` (`convertFormDataAsync`) no Expo SDK 57.
 */
export async function createNativeMultipartFilePart(
  resolvedUri: string,
  fileName: string,
  mimeType: string,
  readBytes: (uri: string) => Promise<Uint8Array<ArrayBuffer>> = readNativeEvidenceBytes
): Promise<NativeMultipartFilePart> {
  const fileBytes = ensureArrayBufferBytes(await readBytes(resolvedUri));
  if (fileBytes.byteLength === 0) {
    throw new Error(`Arquivo local da evidência está vazio (${resolvedUri}).`);
  }

  return {
    uri: resolvedUri,
    name: fileName,
    type: mimeType,
    size: fileBytes.byteLength,
    bytes: async () => fileBytes,
    arrayBuffer: async () =>
      fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength),
  };
}

/**
 * Constrói o payload `FormData` compatível com `POST /api/v1/sync/upload` (`SyncController.uploadEvidence`).
 */
export async function buildEvidenceUploadFormData(
  request: UploadEvidenceRequest,
  options?: { readNativeBytes?: (uri: string) => Promise<Uint8Array<ArrayBuffer>> }
): Promise<FormData> {
  const formData = new FormData();
  const fileName = request.fileName?.trim() || `${request.evidenceId}.jpg`;
  const fallbackMimeType = request.mimeType?.trim() || 'image/jpeg';
  const resolvedUri = resolveStoredEvidenceUri(request.localUri);

  if (!resolvedUri || resolvedUri.startsWith('fieldops-web://')) {
    throw new Error(
      `Arquivo local da evidência não encontrado no armazenamento Web (${request.evidenceId}).`
    );
  }

  if (resolvedUri.startsWith('data:')) {
    const { blob } = decodeDataUrlToBlob(resolvedUri, fallbackMimeType);
    formData.append('file', blob, fileName);
  } else if (
    resolvedUri.startsWith('blob:') ||
    resolvedUri.startsWith('http://') ||
    resolvedUri.startsWith('https://')
  ) {
    const response = await fetch(resolvedUri);
    if (!response.ok) {
      throw new Error(`Falha ao ler arquivo local da evidência (HTTP ${response.status}).`);
    }
    const blob = await response.blob();
    formData.append('file', blob, fileName);
  } else {
    const nativePart = await createNativeMultipartFilePart(
      resolvedUri,
      fileName,
      fallbackMimeType,
      options?.readNativeBytes
    );
    const isReactNativeFormData = Array.isArray((formData as { _parts?: unknown })._parts);
    if (isReactNativeFormData) {
      // Expo SDK 57 (expo/fetch) exige objeto com `bytes()` além de `name` e `type`
      formData.append('file', nativePart as unknown as Blob);
    } else {
      const fileBytes = await nativePart.bytes();
      formData.append('file', new Blob([fileBytes], { type: fallbackMimeType }), fileName);
    }
  }

  formData.append('inspectionId', request.inspectionId);
  formData.append('evidenceId', request.evidenceId);
  formData.append('operationId', request.operationId);

  if (request.itemId) {
    formData.append('itemId', request.itemId);
  }
  if (request.nonConformityId) {
    formData.append('nonConformityId', request.nonConformityId);
  }
  if (request.clientTimestamp) {
    formData.append('clientTimestamp', request.clientTimestamp);
  }
  if (request.description) {
    formData.append('description', request.description);
  }

  return formData;
}
