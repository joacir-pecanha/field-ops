import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiProblemDetail } from '../../core/auth/auth.models';
import {
  MasterDataApiError,
  PageQuery,
  PageResponse,
  buildHttpParams,
  mapMasterDataHttpError,
} from '../../core/master/master-data.models';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'INACTIVE';
export type TemplateVersionStatus = 'DRAFT' | 'PUBLISHED';
export type ResponseType =
  | 'TEXT_SHORT'
  | 'TEXT_LONG'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'CONFORMITY'
  | 'SINGLE_CHOICE'
  | 'DATE'
  | 'PHOTO';

export interface ResponseTypeOption {
  value: ResponseType;
  label: string;
  badge: string;
  description: string;
}

export const RESPONSE_TYPE_OPTIONS: readonly ResponseTypeOption[] = [
  {
    value: 'CONFORMITY',
    label: 'Conformidade (C / NC / NA)',
    badge: 'CONFORMIDADE',
    description: 'Conforme, Não Conforme ou Não Aplicável, com suporte a regras de falha.',
  },
  {
    value: 'BOOLEAN',
    label: 'Booleano (Sim / Não)',
    badge: 'SIM / NÃO',
    description: 'Resposta binária direta para verificações rápidas.',
  },
  {
    value: 'TEXT_SHORT',
    label: 'Texto Curto',
    badge: 'TEXTO CURTO',
    description: 'Campo de texto de uma linha para leituras ou identificações curtas.',
  },
  {
    value: 'TEXT_LONG',
    label: 'Texto Longo',
    badge: 'TEXTO LONGO',
    description: 'Área de texto multilinha para descrições e pareceres técnicos.',
  },
  {
    value: 'NUMBER',
    label: 'Número',
    badge: 'NÚMERO',
    description: 'Valor numérico para medições, pressões, temperaturas ou contagens.',
  },
  {
    value: 'SINGLE_CHOICE',
    label: 'Escolha Única (Rádio)',
    badge: 'ESCOLHA ÚNICA',
    description: 'Lista de opções exclusivas configuradas pelo supervisor.',
  },
  {
    value: 'DATE',
    label: 'Data',
    badge: 'DATA',
    description: 'Seletor de data para validades, calibrações ou próximos vencimentos.',
  },
  {
    value: 'PHOTO',
    label: 'Foto / Evidência',
    badge: 'FOTO',
    description: 'Captura fotográfica obrigatória ou complementar no dispositivo móvel.',
  },
] as const;

export interface TemplateCategoryOption {
  value: string;
  label: string;
}

export const TEMPLATE_CATEGORY_OPTIONS: readonly TemplateCategoryOption[] = [
  { value: 'SEGURANCA', label: 'Segurança' },
  { value: 'ELETRICA', label: 'Elétrica' },
  { value: 'MECANICA', label: 'Mecânica' },
  { value: 'UTILIDADES', label: 'Utilidades' },
  { value: 'CIVIL', label: 'Civil' },
  { value: 'AMBIENTAL', label: 'Ambiental' },
  { value: 'QUALIDADE', label: 'Qualidade' },
  { value: 'OPERACIONAL', label: 'Operacional' },
] as const;

export interface TemplateItemRequest {
  code?: string | null;
  title: string;
  description?: string | null;
  responseType?: ResponseType | null;
  required?: boolean | null;
  observationRequiredOnFailure?: boolean | null;
  evidenceRequiredOnFailure?: boolean | null;
  options?: string[] | null;
  optionsJson?: string | null;
  orderIndex?: number | null;
}

export interface TemplateItemResponse {
  id: string;
  sectionId: string;
  code: string | null;
  title: string;
  description: string | null;
  responseType: ResponseType | null;
  required: boolean;
  observationRequiredOnFailure: boolean;
  requireObservationOnFail: boolean;
  evidenceRequiredOnFailure: boolean;
  requireEvidenceOnFail: boolean;
  options: string[];
  optionsJson: string | null;
  orderIndex: number;
  createdAt: string;
}

export interface TemplateSectionRequest {
  title: string;
  description?: string | null;
  orderIndex?: number | null;
  items?: TemplateItemRequest[] | null;
}

export interface TemplateSectionResponse {
  id: string;
  templateVersionId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  items: TemplateItemResponse[];
  createdAt: string;
}

export interface TemplateRequest {
  code?: string | null;
  title: string;
  description?: string | null;
  category: string;
  sections?: TemplateSectionRequest[] | null;
}

export interface TemplateResponse {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  category: string;
  status: TemplateStatus;
  active: boolean;
  version: number;
  currentVersion: number;
  activeVersionId: string | null;
  totalSections: number;
  totalItems: number;
  sections: TemplateSectionResponse[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersionResponse {
  id: string;
  templateId: string;
  version: number;
  versionNumber: number;
  status: TemplateVersionStatus;
  titleSnapshot: string;
  descriptionSnapshot: string | null;
  categorySnapshot: string;
  publishedBy: string | null;
  publishedAt: string | null;
  activeForNewInspections: boolean;
  totalSections: number;
  totalItems: number;
  sections: TemplateSectionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItemSnapshotDto {
  templateItemId: string;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string | null;
  sectionOrderIndex: number;
  itemCode: string | null;
  title: string;
  description: string | null;
  responseType: ResponseType;
  required: boolean;
  observationRequiredOnFailure: boolean;
  requireObservationOnFail: boolean;
  evidenceRequiredOnFailure: boolean;
  requireEvidenceOnFail: boolean;
  options: string[];
  optionsJson: string | null;
  itemOrderIndex: number;
  globalOrderIndex: number;
}

export interface TemplateSnapshotResponse {
  templateId: string;
  templateCode: string | null;
  templateVersionId: string;
  version: number;
  versionNumber: number;
  titleSnapshot: string;
  descriptionSnapshot: string | null;
  categorySnapshot: string;
  publishedAt: string | null;
  totalSections: number;
  totalItems: number;
  items: TemplateItemSnapshotDto[];
}

export interface TemplateListQuery extends PageQuery {
  search?: string;
  category?: string;
  status?: TemplateStatus | '';
  active?: boolean;
}

interface TemplateProblemDetail extends ApiProblemDetail {
  pendencies?: string[];
}

export class TemplateApiError extends MasterDataApiError {
  readonly pendencies: string[];

  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN',
    fieldErrors: Record<string, string> = {},
    pendencies: string[] = []
  ) {
    super(message, status, code, fieldErrors);
    this.name = 'TemplateApiError';
    this.pendencies = pendencies;
  }
}

export function mapTemplateHttpError(error: unknown): TemplateApiError {
  if (error instanceof TemplateApiError) {
    return error;
  }

  const baseError = mapMasterDataHttpError(error);
  let pendencies: string[] = [];

  if (error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null) {
    const problem = error.error as TemplateProblemDetail;
    if (Array.isArray(problem.pendencies)) {
      pendencies = problem.pendencies.filter((item): item is string => typeof item === 'string');
    }
  }

  return new TemplateApiError(
    baseError.message,
    baseError.status,
    baseError.code,
    baseError.fieldErrors,
    pendencies
  );
}

export function getResponseTypeMeta(type: ResponseType | null | undefined): ResponseTypeOption | null {
  if (!type) {
    return null;
  }
  return RESPONSE_TYPE_OPTIONS.find((option) => option.value === type) ?? null;
}

export function getResponseTypeLabel(type: ResponseType | null | undefined): string {
  return getResponseTypeMeta(type)?.label ?? 'Não definido';
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) {
    return '—';
  }
  const normalized = category.trim().toUpperCase();
  return TEMPLATE_CATEGORY_OPTIONS.find((opt) => opt.value === normalized)?.label ?? category;
}

export function getTemplateStatusLabel(status: TemplateStatus | TemplateVersionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho';
    case 'PUBLISHED':
      return 'Publicado';
    case 'INACTIVE':
      return 'Inativo';
    default:
      return status;
  }
}

/**
 * Serviço HTTP tipado para Modelos de Inspeção, versionamento imutável e snapshots (TASK-010 Passo 1).
 */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl.replace(/\/+$/, '')}/api/v1/inspection-templates`;

  list(query?: TemplateListQuery): Observable<PageResponse<TemplateResponse>> {
    const params = buildHttpParams(query as Record<string, unknown> | undefined);
    return this.http
      .get<PageResponse<TemplateResponse>>(this.baseUrl, { params })
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  getById(id: string): Observable<TemplateResponse> {
    return this.http
      .get<TemplateResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`)
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  createDraft(payload: TemplateRequest): Observable<TemplateResponse> {
    return this.http
      .post<TemplateResponse>(this.baseUrl, payload)
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  updateDraft(id: string, payload: TemplateRequest): Observable<TemplateResponse> {
    return this.http
      .put<TemplateResponse>(`${this.baseUrl}/${encodeURIComponent(id)}`, payload)
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  publish(id: string): Observable<TemplateVersionResponse> {
    return this.http
      .post<TemplateVersionResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/publish`, {})
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  createNewVersion(id: string, payload?: TemplateRequest): Observable<TemplateVersionResponse> {
    return this.http
      .post<TemplateVersionResponse>(
        `${this.baseUrl}/${encodeURIComponent(id)}/versions`,
        payload ?? null
      )
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  listVersions(id: string): Observable<TemplateVersionResponse[]> {
    return this.http
      .get<TemplateVersionResponse[]>(`${this.baseUrl}/${encodeURIComponent(id)}/versions`)
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  getVersion(id: string, versionNumber: number): Observable<TemplateVersionResponse> {
    return this.http
      .get<TemplateVersionResponse>(
        `${this.baseUrl}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionNumber)}`
      )
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  updateVersion(
    id: string,
    versionNumber: number,
    payload: TemplateRequest
  ): Observable<TemplateVersionResponse> {
    return this.http
      .put<TemplateVersionResponse>(
        `${this.baseUrl}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionNumber)}`,
        payload
      )
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  getActiveSnapshot(id: string): Observable<TemplateSnapshotResponse> {
    return this.http
      .get<TemplateSnapshotResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/snapshot`)
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  getVersionSnapshot(id: string, versionNumber: number): Observable<TemplateSnapshotResponse> {
    return this.http
      .get<TemplateSnapshotResponse>(
        `${this.baseUrl}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionNumber)}/snapshot`
      )
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  deactivate(id: string): Observable<TemplateResponse> {
    return this.http
      .patch<TemplateResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/deactivate`, {})
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  activate(id: string): Observable<TemplateResponse> {
    return this.http
      .patch<TemplateResponse>(`${this.baseUrl}/${encodeURIComponent(id)}/activate`, {})
      .pipe(catchError((err) => throwError(() => mapTemplateHttpError(err))));
  }

  checkCodeTaken(code: string, excludeId?: string): Observable<boolean> {
    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return of(false);
    }

    return this.list({ search: normalized, page: 0, size: 20 }).pipe(
      map((page) =>
        page.content.some(
          (template) =>
            Boolean(template.code) &&
            template.code!.toLowerCase() === normalized &&
            template.id !== excludeId
        )
      ),
      catchError(() => of(false))
    );
  }
}
