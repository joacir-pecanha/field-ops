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

const WEB_EVIDENCE_STORAGE_KEY = 'fieldops:web_evidence_files:v1';

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
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(payload);
      const buffer = new ArrayBuffer(binary.length);
      bytes = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else if (typeof Buffer !== 'undefined') {
      const decoded = Buffer.from(payload, 'base64');
      const buffer = new ArrayBuffer(decoded.byteLength);
      bytes = new Uint8Array(buffer);
      bytes.set(decoded);
    } else {
      throw new Error('Decodificador base64 indisponível neste ambiente.');
    }
  } else {
    const decodedText = decodeURIComponent(payload);
    const encoded = new TextEncoder().encode(decodedText);
    const buffer = new ArrayBuffer(encoded.byteLength);
    bytes = new Uint8Array(buffer);
    bytes.set(encoded);
  }

  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
  };
}

/**
 * Constrói o payload `FormData` compatível com `POST /api/v1/sync/upload` (`SyncController.uploadEvidence`).
 */
export async function buildEvidenceUploadFormData(
  request: UploadEvidenceRequest
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
    // React Native (Android / iOS) aceita descritor { uri, name, type } no FormData nativo
    formData.append(
      'file',
      {
        uri: resolvedUri,
        name: fileName,
        type: fallbackMimeType,
      } as unknown as Blob
    );
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
