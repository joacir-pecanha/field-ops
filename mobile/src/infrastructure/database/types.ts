/**
 * Interfaces de dados do SQLite Local (Offline-First)
 * Baseado nas especificações SPEC-001 e SPEC-002 do FieldOps
 */

// 1. Usuário / Sessão Local
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

// 2. Inspeções Atribuídas
export type InspectionBusinessStatus =
  | 'RASCUNHO'
  | 'ATRIBUÍDA'
  | 'EM_ANDAMENTO'
  | 'ENVIADA'
  | 'EM_REVISÃO'
  | 'APROVADA'
  | 'REPROVADA'
  | 'CANCELADA';

export type InspectionSyncStatus =
  | 'SINCRONIZADO'
  | 'PENDENTE'
  | 'SINCRONIZANDO'
  | 'ERRO'
  | 'CONFLITO';

export type InspectionPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA' | string;

export interface Inspection {
  id: string;
  remote_id?: string | null;
  template_id: string;
  template_version?: number;
  client_name: string;
  site_name: string;
  site_address?: string | null;
  equipment_name: string;
  equipment_code?: string | null;
  equipment_qr_code?: string | null;
  status: InspectionBusinessStatus | string;
  priority?: InspectionPriority;
  due_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  sync_status?: InspectionSyncStatus;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;

  // Aliases para retrocompatibilidade com UI / stubs
  client?: string;
  site?: string;
  equipment?: string;
}

// 3. Seções do Checklist
export interface ChecklistSection {
  id: string;
  inspection_id: string;
  title: string;
  order_index: number;
}

// 4. Itens do Checklist
export type ChecklistResponseType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'CONFORMITY'
  | 'SINGLE_CHOICE'
  | 'DATE';

export interface ChecklistItem {
  id: string;
  section_id: string;
  inspection_id: string;
  title: string;
  description?: string | null;
  response_type: ChecklistResponseType;
  options_json?: string | null; // Array de strings serializado em JSON para SINGLE_CHOICE
  required: number | boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;

  // Compatibilidade legada
  status?: string;
}

// 5. Respostas do Checklist
export interface ChecklistResponse {
  id: string;
  item_id: string;
  inspection_id: string;
  value?: string | null; // Resposta serializada
  observation?: string | null;
  is_non_conformity?: number | boolean;
  non_conformity_description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  responded_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Compatibilidade legada
  evidence_uri?: string;
}

// 6. Evidências Fotográficas
export type EvidenceStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export interface InspectionEvidence {
  id: string;
  inspection_id: string;
  item_id?: string | null;
  local_uri: string;
  remote_key?: string | null;
  remote_url?: string | null;
  file_size?: number | null;
  mime_type?: string;
  status: EvidenceStatus;
  error_message?: string | null;
  created_at?: string;
}

// 7. Fila de Operações Outbox
export type OutboxStatus = 'PENDING' | 'SYNCING' | 'ERROR' | 'CONFLICT';

export type OutboxEntityType =
  | 'INSPECTION'
  | 'CHECKLIST_RESPONSE'
  | 'EVIDENCE'
  | string;

export type OutboxOperationType =
  | 'START_INSPECTION'
  | 'SUBMIT_RESPONSE'
  | 'UPLOAD_EVIDENCE'
  | 'COMPLETE_INSPECTION'
  | 'CREATE'
  | string;

export interface OutboxOperation {
  id: string; // UUID v4 idempotente
  entity_type: OutboxEntityType;
  global_id: string;
  operation_type: OutboxOperationType;
  payload: string; // JSON serializado
  dependencies?: string | string[] | null; // JSON array ou array parseado
  status: OutboxStatus;
  retries: number;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SyncBatchResponse {
  processed: {
    operation_id: string;
    success: boolean;
    error_code?: string;
    message?: string;
  }[];
}
