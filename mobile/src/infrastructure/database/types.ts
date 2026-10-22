export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Inspection {
  id: string;
  remote_id?: string;
  client: string;
  site: string;
  equipment?: string;
  status: string;
  priority?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistItem {
  id: string;
  inspection_id: string;
  description: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistResponse {
  id: string;
  item_id: string;
  value?: string;
  evidence_uri?: string;
  created_at?: string;
  updated_at?: string;
}

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'ERROR' | 'CONFLICT';

export interface OutboxOperation {
  id: string;
  entity_type: string;
  global_id?: string;
  operation_type: string;
  payload: string;
  dependencies?: string;
  status: OutboxStatus;
  retries: number;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}
