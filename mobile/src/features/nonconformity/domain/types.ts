export const NON_CONFORMITY_SEVERITIES = [
  'BAIXA',
  'MEDIA',
  'ALTA',
  'CRITICA',
] as const;

export type NonConformitySeverity = (typeof NON_CONFORMITY_SEVERITIES)[number];

export const NonConformitySeverityEnum = {
  BAIXA: 'BAIXA',
  MEDIA: 'MEDIA',
  ALTA: 'ALTA',
  CRITICA: 'CRITICA',
} as const;

export const MIN_DETAILED_DESCRIPTION_LENGTH = 10;

export const CRITICAL_PHOTO_REQUIRED_MESSAGE =
  'Itens críticos exigem ao menos uma fotografia como evidência';

export const CRITICAL_DESCRIPTION_REQUIRED_MESSAGE =
  'Não conformidades de criticidade Alta ou Crítica exigem descrição textual detalhada (mínimo 10 caracteres).';

export const READ_ONLY_NON_CONFORMITY_MESSAGE =
  'Edição bloqueada: não conformidades de inspeções concluídas ou aprovadas são estritamente somente leitura.';

export type NonConformityBusinessStatus = 'OPEN' | 'RESOLVED' | 'CANCELED';

export type NonConformitySyncStatus =
  | 'SINCRONIZADO'
  | 'PENDENTE'
  | 'SINCRONIZANDO'
  | 'ERRO'
  | 'CONFLITO';

export interface NonConformitySeverityMeta {
  severity: NonConformitySeverity;
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  icon: 'info-outline' | 'report-problem' | 'warning' | 'gpp-bad';
  requiresDetailedDescription: boolean;
  requiresPhotoEvidence: boolean;
  orderWeight: number;
}

export const NON_CONFORMITY_SEVERITY_META: Record<
  NonConformitySeverity,
  NonConformitySeverityMeta
> = {
  BAIXA: {
    severity: 'BAIXA',
    label: 'Baixa',
    shortLabel: 'Baixa',
    description: 'Desvio leve sem impacto imediato',
    accentColor: '#0284C7',
    badgeBg: '#E0F2FE',
    badgeBorder: '#7DD3FC',
    badgeText: '#0369A1',
    icon: 'info-outline',
    requiresDetailedDescription: false,
    requiresPhotoEvidence: false,
    orderWeight: 1,
  },
  MEDIA: {
    severity: 'MEDIA',
    label: 'Média',
    shortLabel: 'Média',
    description: 'Atenção operacional e acompanhamento',
    accentColor: '#D97706',
    badgeBg: '#FEF3C7',
    badgeBorder: '#FCD34D',
    badgeText: '#92400E',
    icon: 'report-problem',
    requiresDetailedDescription: false,
    requiresPhotoEvidence: false,
    orderWeight: 2,
  },
  ALTA: {
    severity: 'ALTA',
    label: 'Alta',
    shortLabel: 'Alta',
    description: 'Risco elevado • Exige descrição detalhada e foto',
    accentColor: '#EA580C',
    badgeBg: '#FFEDD5',
    badgeBorder: '#FB923C',
    badgeText: '#9A3412',
    icon: 'warning',
    requiresDetailedDescription: true,
    requiresPhotoEvidence: true,
    orderWeight: 3,
  },
  CRITICA: {
    severity: 'CRITICA',
    label: 'Crítica',
    shortLabel: 'Crítica',
    description: 'Risco severo/imediato • Exige descrição detalhada e foto',
    accentColor: '#DC2626',
    badgeBg: '#FEE2E2',
    badgeBorder: '#EF4444',
    badgeText: '#991B1B',
    icon: 'gpp-bad',
    requiresDetailedDescription: true,
    requiresPhotoEvidence: true,
    orderWeight: 4,
  },
};

export function isNonConformitySeverity(
  value: unknown
): value is NonConformitySeverity {
  return (
    typeof value === 'string' &&
    (NON_CONFORMITY_SEVERITIES as readonly string[]).includes(value)
  );
}

/**
 * RF-04 / RN-055: Criticidade ALTA ou CRITICA exige descrição detalhada e evidência fotográfica.
 */
export function requiresCompulsoryEvidenceAndDescription(
  severity?: NonConformitySeverity | string | null
): boolean {
  if (!severity) return false;
  const normalized = String(severity).trim().toUpperCase();
  return normalized === 'CRITICA' || normalized === 'ALTA';
}

export function isCriticalSeverity(
  severity?: NonConformitySeverity | string | null
): boolean {
  if (!severity) return false;
  return String(severity).trim().toUpperCase() === 'CRITICA';
}

export interface NonConformity {
  id: string;
  remote_id?: string | null;
  inspection_id: string;
  item_id?: string | null;
  item_title?: string | null;
  title: string;
  description: string;
  severity: NonConformitySeverity;
  status: NonConformityBusinessStatus;
  evidence_uris: string[];
  evidence_ids: string[];
  sync_status: NonConformitySyncStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNonConformityInput {
  id?: string;
  inspection_id: string;
  item_id?: string | null;
  item_title?: string | null;
  title: string;
  description?: string | null;
  severity: NonConformitySeverity;
  evidence_uris?: string[];
  evidence_ids?: string[];
  created_by?: string | null;
  technicianId?: string | null;
  userRole?: string | null;
}

export interface UpdateNonConformityInput {
  item_id?: string | null;
  item_title?: string | null;
  title?: string;
  description?: string | null;
  severity?: NonConformitySeverity;
  evidence_uris?: string[];
  evidence_ids?: string[];
  status?: NonConformityBusinessStatus;
  technicianId?: string | null;
  userRole?: string | null;
}

export interface DeleteNonConformityOptions {
  technicianId?: string | null;
  userRole?: string | null;
  reason?: string | null;
}

export interface FindNonConformitiesOptions {
  includeCanceled?: boolean;
  severity?: NonConformitySeverity;
  itemId?: string;
}

export interface NonConformitySeverityGroup {
  severity: NonConformitySeverity;
  meta: NonConformitySeverityMeta;
  items: NonConformity[];
}

export type NonConformityMutationResultCode =
  | 'CREATED'
  | 'UPDATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN_TECHNICIAN'
  | 'READ_ONLY_INSPECTION'
  | 'VALIDATION_ERROR'
  | 'INVALID_STATUS';

export interface NonConformityMutationResult {
  success: boolean;
  code: NonConformityMutationResultCode;
  message: string;
  nonConformity: NonConformity | null;
  fieldErrors?: Record<string, string>;
  outboxOperationId?: string | null;
}

export type DeleteNonConformityResultCode =
  | 'DELETED'
  | 'CANCELED_AUDIT'
  | 'NOT_FOUND'
  | 'FORBIDDEN_TECHNICIAN'
  | 'READ_ONLY_INSPECTION';

export interface DeleteNonConformityResult {
  success: boolean;
  code: DeleteNonConformityResultCode;
  message: string;
  deletedId: string | null;
  audited: boolean;
  nonConformity: NonConformity | null;
  outboxOperationId?: string | null;
}
