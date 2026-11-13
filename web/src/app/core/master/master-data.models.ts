import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ApiProblemDetail, UserRole, UserStatus } from '../auth/auth.models';

export type MasterStatus = 'ACTIVE' | 'INACTIVE';
export type EquipmentStatus = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PageQuery {
  page?: number;
  size?: number;
  sort?: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  active: boolean;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface UserCreateRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus | null;
  phone?: string | null;
}

export interface UserUpdateRequest {
  name: string;
  email: string;
  password?: string | null;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
}

export interface UserListQuery extends PageQuery {
  search?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
  active?: boolean;
}

export interface ClientResponse {
  id: string;
  code: string | null;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  status: MasterStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ClientRequest {
  code?: string | null;
  name: string;
  legalName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: MasterStatus | null;
}

export interface ClientListQuery extends PageQuery {
  search?: string;
  status?: MasterStatus | '';
  active?: boolean;
}

export interface SiteResponse {
  id: string;
  clientId: string;
  clientName: string;
  code: string | null;
  name: string;
  description: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  status: MasterStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SiteRequest {
  clientId: string;
  code?: string | null;
  name: string;
  description?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status?: MasterStatus | null;
}

export interface SiteListQuery extends PageQuery {
  clientId?: string;
  search?: string;
  status?: MasterStatus | '';
  active?: boolean;
}

export interface EquipmentResponse {
  id: string;
  siteId: string;
  siteName: string;
  clientId: string;
  clientName: string;
  code: string | null;
  name: string;
  assetNumber: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  qrCode: string;
  status: EquipmentStatus;
  active: boolean;
  installedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface EquipmentRequest {
  siteId: string;
  code?: string | null;
  name: string;
  assetNumber?: string | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  description?: string | null;
  qrCode: string;
  status?: EquipmentStatus | null;
  installedAt?: string | null;
}

export interface EquipmentListQuery extends PageQuery {
  clientId?: string;
  siteId?: string;
  search?: string;
  status?: EquipmentStatus | '';
  active?: boolean;
}

export class MasterDataApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status = 0,
    code = 'UNKNOWN',
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'MasterDataApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function mapMasterDataHttpError(error: unknown): MasterDataApiError {
  if (error instanceof MasterDataApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const problem = (
      typeof error.error === 'object' && error.error !== null ? error.error : {}
    ) as ApiProblemDetail;

    const status = error.status;
    const code = problem.code ?? defaultCodeForStatus(status);
    const fieldErrors = problem.errors ? { ...problem.errors } : {};
    const detail =
      problem.detail ||
      problem.message ||
      defaultMessageForStatus(status);

    return new MasterDataApiError(detail, status, code, fieldErrors);
  }

  return new MasterDataApiError(
    'Ocorreu um erro inesperado ao processar a solicitação.',
    0,
    'UNKNOWN'
  );
}

export function buildHttpParams(query?: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  if (!query) {
    return params;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      params = params.set(key, trimmed);
      continue;
    }
    params = params.set(key, String(value));
  }

  return params;
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 0:
      return 'NETWORK_ERROR';
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'ACCESS_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'BUSINESS_RULE_VIOLATION';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN';
  }
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 0:
      return 'Não foi possível conectar ao servidor. Verifique se o backend está em execução.';
    case 400:
      return 'Um ou mais campos informados são inválidos. Revise o formulário.';
    case 403:
      return 'Você não possui permissão para executar esta operação.';
    case 404:
      return 'Registro não encontrado.';
    case 409:
      return 'Conflito de unicidade nos dados informados.';
    case 422:
      return 'Operação bloqueada por regra de negócio.';
    default:
      return status >= 500
        ? 'Erro interno no servidor ao processar a solicitação.'
        : 'Não foi possível concluir a operação.';
  }
}

