import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MasterDataApiError,
  PageQuery,
  PageResponse,
  buildHttpParams,
  mapMasterDataHttpError,
} from '../../core/master/master-data.models';
import { ResponseType } from '../templates/template.service';

export type InspectionStatus =
  | 'RASCUNHO'
  | 'ATRIBUÍDA'
  | 'EM_ANDAMENTO'
  | 'ENVIADA'
  | 'EM_REVISÃO'
  | 'APROVADA'
  | 'REPROVADA'
  | 'CANCELADA';

export type InspectionPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE' | 'CRITICA';

export type InspectionStatusTone = 'blue' | 'orange' | 'yellow' | 'green' | 'red' | 'gray';

export interface InspectionStatusOption {
  value: InspectionStatus;
  label: string;
  tone: InspectionStatusTone;
}

export const INSPECTION_STATUS_OPTIONS: readonly InspectionStatusOption[] = [
  { value: 'ATRIBUÍDA', label: 'Atribuída', tone: 'blue' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', tone: 'orange' },
  { value: 'ENVIADA', label: 'Enviada', tone: 'yellow' },
  { value: 'EM_REVISÃO', label: 'Em Revisão', tone: 'yellow' },
  { value: 'APROVADA', label: 'Aprovada', tone: 'green' },
  { value: 'REPROVADA', label: 'Reprovada', tone: 'red' },
  { value: 'CANCELADA', label: 'Cancelada', tone: 'gray' },
  { value: 'RASCUNHO', label: 'Rascunho', tone: 'gray' },
] as const;

export interface InspectionPriorityOption {
  value: InspectionPriority;
  label: string;
}

export const INSPECTION_PRIORITY_OPTIONS: readonly InspectionPriorityOption[] = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
] as const;

export interface InspectionItemSnapshotResponse {
  id: string;
  inspectionId: string;
  sourceTemplateItemId: string;
  sectionTitle: string;
  sectionDescription: string | null;
  sectionOrder: number;
  itemCode: string | null;
  itemTitle: string;
  itemDescription: string | null;
  responseType: ResponseType;
  required: boolean;
  observationRequiredOnFailure: boolean;
  evidenceRequiredOnFailure: boolean;
  rulesJson: string | null;
  options: string[];
  optionsJson: string | null;
  itemOrder: number;
  createdAt: string;
}

export interface AuditLogResponse {
  id: string;
  inspectionId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  previousValueJson: string | null;
  newValueJson: string | null;
  metadataJson: string | null;
  details: string | null;
  occurredAt: string;
}

export interface InspectionDetailsResponse {
  id: string;
  title: string;
  instructions: string | null;
  status: InspectionStatus;
  priority: InspectionPriority;
  templateId: string | null;
  templateCode: string | null;
  templateTitle: string | null;
  templateCategory: string | null;
  templateVersionId: string | null;
  templateVersion: number | null;
  templateVersionNumber: number | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  siteId: string | null;
  siteCode: string | null;
  siteName: string | null;
  siteAddress: string | null;
  equipmentId: string | null;
  equipmentCode: string | null;
  equipmentName: string | null;
  equipmentQrCode: string | null;
  technicianId: string | null;
  technicianName: string | null;
  technicianEmail: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  createdBy: string | null;
  scheduledFor: string;
  dueDate: string;
  overdue: boolean;
  startedAtDevice: string | null;
  startedAtServer: string | null;
  completedAtDevice: string | null;
  submittedAtServer: string | null;
  approvedAt: string | null;
  canceledAt: string | null;
  canceledBy: string | null;
  canceledReason: string | null;
  totalItems: number;
  items: InspectionItemSnapshotResponse[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ScheduleInspectionRequest {
  templateId?: string | null;
  templateVersionId?: string | null;
  templateVersionNumber?: number | null;
  clientId: string;
  siteId: string;
  equipmentId?: string | null;
  technicianId: string;
  supervisorId?: string | null;
  scheduledFor: string;
  title?: string | null;
  instructions?: string | null;
  priority?: InspectionPriority | null;
}

export interface CancelInspectionRequest {
  reason: string;
  justification?: string | null;
  canceledReason?: string | null;
}

export interface InspectionListQuery extends PageQuery {
  search?: string;
  status?: InspectionStatus | '';
  priority?: InspectionPriority | '';
  clientId?: string;
  siteId?: string;
  equipmentId?: string;
  technicianId?: string;
  supervisorId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  overdue?: boolean;
}

export interface AssignedInspectionQuery {
  technicianId?: string;
  status?: InspectionStatus | '';
  includeCanceled?: boolean;
}

export class InspectionApiError extends MasterDataApiError {
  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN',
    fieldErrors: Record<string, string> = {}
  ) {
    super(message, status, code, fieldErrors);
    this.name = 'InspectionApiError';
  }
}

export function mapInspectionHttpError(error: unknown): InspectionApiError {
  if (error instanceof InspectionApiError) {
    return error;
  }
  const baseError = mapMasterDataHttpError(error);
  return new InspectionApiError(
    baseError.message,
    baseError.status,
    baseError.code,
    baseError.fieldErrors
  );
}

export function getInspectionStatusMeta(
  status: InspectionStatus | null | undefined
): InspectionStatusOption {
  const found = INSPECTION_STATUS_OPTIONS.find((item) => item.value === status);
  if (found) {
    return found;
  }
  return {
    value: status ?? 'RASCUNHO',
    label: status ?? 'Desconhecido',
    tone: 'gray',
  };
}

export function getInspectionStatusLabel(status: InspectionStatus | null | undefined): string {
  return getInspectionStatusMeta(status).label;
}

export function getInspectionStatusTone(
  status: InspectionStatus | null | undefined
): InspectionStatusTone {
  return getInspectionStatusMeta(status).tone;
}

export function getInspectionPriorityLabel(
  priority: InspectionPriority | null | undefined
): string {
  switch (priority) {
    case 'BAIXA':
      return 'Baixa';
    case 'MEDIA':
      return 'Média';
    case 'ALTA':
      return 'Alta';
    case 'URGENTE':
      return 'Urgente';
    case 'CRITICA':
      return 'Crítica';
    default:
      return priority ?? '—';
  }
}

export function canCancelInspection(status: InspectionStatus | null | undefined): boolean {
  return status !== 'APROVADA' && status !== 'CANCELADA';
}

/**
 * Serviço HTTP tipado para Agendamento, Acompanhamento e Cancelamento de Inspeções (TASK-012 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/inspections`;

  list(query?: InspectionListQuery): Observable<PageResponse<InspectionDetailsResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<InspectionDetailsResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  schedule(payload: ScheduleInspectionRequest): Observable<InspectionDetailsResponse> {
    return this.http
      .post<InspectionDetailsResponse>(`${this.baseUrl}/schedule`, payload)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  cancel(id: string, payload: CancelInspectionRequest): Observable<InspectionDetailsResponse> {
    return this.http
      .post<InspectionDetailsResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/cancel`, payload)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  listAssigned(query?: AssignedInspectionQuery): Observable<InspectionDetailsResponse[]> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<InspectionDetailsResponse[]>(`${this.baseUrl}/assigned`, { params })
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  getById(id: string): Observable<InspectionDetailsResponse> {
    return this.http
      .get<InspectionDetailsResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  getSnapshots(id: string): Observable<InspectionItemSnapshotResponse[]> {
    return this.http
      .get<InspectionItemSnapshotResponse[]>(`${this.baseUrl}/${encodeURIComponent(id)}/snapshots`)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  getAuditLogs(id: string): Observable<AuditLogResponse[]> {
    return this.http
      .get<AuditLogResponse[]>(`${this.baseUrl}/${encodeURIComponent(id)}/audit-logs`)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }
}
