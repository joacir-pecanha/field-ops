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

export type NonConformitySeverity = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type NonConformityStatus = 'OPEN' | 'RESOLVED' | 'CANCELED';

export type InspectionReviewDecision = 'REVIEW_STARTED' | 'APPROVED' | 'REJECTED';

export type EvidenceFileStatus = 'PENDING' | 'UPLOADED' | 'FAILED' | 'DELETED';

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

export interface InspectionResponseReviewDto {
  id: string;
  inspectionId: string;
  inspectionItemId: string;
  valueRaw: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: string | null;
  valueJson: string | null;
  observation: string | null;
  conformity: string | null;
  nonConformity: boolean;
  nonConformityDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  answeredBy: string | null;
  answeredAtDevice: string | null;
  serverReceivedAt: string | null;
  adminAdjusted: boolean;
  adminAdjustedValue: string | null;
  adminAdjustmentReason: string | null;
  adminAdjustedBy: string | null;
  adminAdjustedByName: string | null;
  adminAdjustedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number | null;
}

export interface InspectionNonConformityDto {
  id: string;
  inspectionId: string;
  inspectionItemId: string | null;
  responseId: string | null;
  itemTitle: string | null;
  title: string;
  description: string | null;
  severity: NonConformitySeverity;
  status: NonConformityStatus;
  canceledReason: string | null;
  createdBy: string | null;
  createdAtDevice: string | null;
  serverReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number | null;
}

export interface InspectionEvidenceDto {
  evidence_id?: string;
  evidenceId?: string;
  id?: string;
  operation_id?: string | null;
  operationId?: string | null;
  inspection_id?: string;
  inspectionId?: string;
  inspection_item_id?: string | null;
  inspectionItemId?: string | null;
  response_id?: string | null;
  responseId?: string | null;
  non_conformity_id?: string | null;
  nonConformityId?: string | null;
  file_name?: string | null;
  fileName?: string | null;
  original_file_name?: string | null;
  originalFileName?: string | null;
  storage_key?: string | null;
  storageKey?: string | null;
  mime_type?: string | null;
  mimeType?: string | null;
  size_bytes?: number | null;
  sizeBytes?: number | null;
  checksum_sha256?: string | null;
  checksumSha256?: string | null;
  status?: EvidenceFileStatus;
  client_timestamp?: string | null;
  clientTimestamp?: string | null;
  server_timestamp?: string | null;
  serverTimestamp?: string | null;
  uploaded_at?: string | null;
  uploadedAt?: string | null;
  url?: string | null;
}

export interface InspectionReviewHistoryDto {
  id: string;
  inspectionId: string;
  reviewerId: string;
  reviewerName: string | null;
  decision: InspectionReviewDecision;
  reason: string | null;
  comments: string | null;
  reviewedAt: string;
  reviewCycle: number | null;
  createdAt: string;
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
  reviewStartedAt?: string | null;
  reviewStartedBy?: string | null;
  approvedAt: string | null;
  approvedBy?: string | null;
  approvedByName?: string | null;
  reviewComments?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectedByName?: string | null;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
  reviewCycle?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startAccuracy?: number | null;
  completeLatitude?: number | null;
  completeLongitude?: number | null;
  completeAccuracy?: number | null;
  canceledAt: string | null;
  canceledBy: string | null;
  canceledReason: string | null;
  totalItems: number;
  items: InspectionItemSnapshotResponse[];
  responses?: InspectionResponseReviewDto[];
  nonConformities?: InspectionNonConformityDto[];
  evidences?: InspectionEvidenceDto[];
  reviews?: InspectionReviewHistoryDto[];
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

export interface ApproveInspectionRequest {
  comments?: string | null;
  reviewComments?: string | null;
}

export interface RejectInspectionRequest {
  rejection_reason: string;
  rejectionReason?: string | null;
  reason?: string | null;
  comments?: string | null;
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

export function isInspectionActionLocked(status: InspectionStatus | null | undefined): boolean {
  return status === 'APROVADA' || status === 'CANCELADA';
}

export function canStartInspectionReview(status: InspectionStatus | null | undefined): boolean {
  return status === 'ENVIADA';
}

export function canSubmitInspectionVerdict(status: InspectionStatus | null | undefined): boolean {
  return status === 'ENVIADA' || status === 'EM_REVISÃO';
}

export const NON_CONFORMITY_SEVERITY_WEIGHT: Record<NonConformitySeverity, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAIXA: 1,
};

export function sortNonConformitiesBySeverity(
  items: readonly InspectionNonConformityDto[]
): InspectionNonConformityDto[] {
  return [...items].sort((a, b) => {
    const weightA = NON_CONFORMITY_SEVERITY_WEIGHT[a.severity] ?? 0;
    const weightB = NON_CONFORMITY_SEVERITY_WEIGHT[b.severity] ?? 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

export function getNonConformitySeverityLabel(
  severity: NonConformitySeverity | string | null | undefined
): string {
  switch (severity) {
    case 'CRITICA':
      return 'Crítica';
    case 'ALTA':
      return 'Alta';
    case 'MEDIA':
      return 'Média';
    case 'BAIXA':
      return 'Baixa';
    default:
      return severity ?? '—';
  }
}

export function getNonConformitySeverityTone(
  severity: NonConformitySeverity | string | null | undefined
): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity) {
    case 'CRITICA':
      return 'critical';
    case 'ALTA':
      return 'high';
    case 'MEDIA':
      return 'medium';
    default:
      return 'low';
  }
}

export function resolveEvidenceId(evidence: InspectionEvidenceDto): string {
  return evidence.evidence_id ?? evidence.evidenceId ?? evidence.id ?? '';
}

export function resolveEvidenceItemId(evidence: InspectionEvidenceDto): string | null {
  return evidence.inspection_item_id ?? evidence.inspectionItemId ?? null;
}

export function resolveEvidenceResponseId(evidence: InspectionEvidenceDto): string | null {
  return evidence.response_id ?? evidence.responseId ?? null;
}

export function resolveEvidenceNonConformityId(evidence: InspectionEvidenceDto): string | null {
  return evidence.non_conformity_id ?? evidence.nonConformityId ?? null;
}

export function resolveEvidenceFileName(evidence: InspectionEvidenceDto): string {
  return (
    (evidence.original_file_name ??
      evidence.originalFileName ??
      evidence.file_name ??
      evidence.fileName ??
      resolveEvidenceId(evidence)) ||
    'evidencia.jpg'
  );
}

export function getEvidenceImageUrl(evidence: InspectionEvidenceDto): string {
  if (evidence.url && evidence.url.trim().length > 0) {
    return evidence.url.trim();
  }
  const id = resolveEvidenceId(evidence);
  if (!id) {
    return '';
  }
  const apiBase = environment.apiBaseUrl.replace(/\/+$/, '');
  return `${apiBase}/api/v1/sync/evidences/${encodeURIComponent(id)}/content`;
}

/**
 * Serviço HTTP tipado para Agendamento, Acompanhamento, Cancelamento e Revisão Técnica de Inspeções (TASK-012 / TASK-020).
 */
@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly baseUrl = `${this.apiBaseUrl}/api/v1/inspections`;

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

  getReviewDetails(id: string): Observable<InspectionDetailsResponse> {
    return this.getById(id);
  }

  startReview(id: string): Observable<InspectionDetailsResponse> {
    return this.http
      .post<InspectionDetailsResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/start-review`, {})
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  approve(id: string, payload?: ApproveInspectionRequest): Observable<InspectionDetailsResponse> {
    return this.http
      .post<InspectionDetailsResponse>(
        `${this.baseUrl}/${encodeURIComponent(id)}/approve`,
        payload ?? {}
      )
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  reject(id: string, payload: RejectInspectionRequest): Observable<InspectionDetailsResponse> {
    return this.http
      .post<InspectionDetailsResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/reject`, payload)
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }

  getReviewHistory(id: string): Observable<InspectionReviewHistoryDto[]> {
    return this.http
      .get<InspectionReviewHistoryDto[]>(`${this.baseUrl}/${encodeURIComponent(id)}/reviews`)
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

  getEvidenceContentUrl(evidenceId: string): string {
    return `${this.apiBaseUrl}/api/v1/sync/evidences/${encodeURIComponent(evidenceId)}/content`;
  }

  getEvidenceBlob(evidenceId: string): Observable<Blob> {
    return this.http
      .get(this.getEvidenceContentUrl(evidenceId), { responseType: 'blob' })
      .pipe(catchError((err) => throwError(() => mapInspectionHttpError(err))));
  }
}
