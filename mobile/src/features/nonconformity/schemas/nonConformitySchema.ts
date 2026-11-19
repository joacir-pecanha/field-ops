import { z } from 'zod';
import {
  CRITICAL_DESCRIPTION_REQUIRED_MESSAGE,
  CRITICAL_PHOTO_REQUIRED_MESSAGE,
  MIN_DETAILED_DESCRIPTION_LENGTH,
  NON_CONFORMITY_SEVERITIES,
  requiresCompulsoryEvidenceAndDescription,
} from '../domain/types';

/**
 * RF-03 / RN-054: Criticidade válida obrigatória.
 */
export const nonConformitySeveritySchema = z.enum(
  NON_CONFORMITY_SEVERITIES,
  'A criticidade deve assumir um valor válido: BAIXA, MEDIA, ALTA ou CRITICA.'
);

/**
 * Schema Zod principal de Não Conformidade com refinamento condicional (RT-01 / RF-04 / EX-01).
 */
export const nonConformitySchema = z
  .object({
    id: z.string().trim().optional(),
    inspection_id: z
      .string('A não conformidade deve pertencer a uma inspeção específica.')
      .trim()
      .min(1, 'A não conformidade deve pertencer a uma inspeção específica.'),
    item_id: z.string().trim().optional().nullable(),
    item_title: z.string().trim().optional().nullable(),
    title: z
      .string('Informe o título da não conformidade.')
      .trim()
      .min(3, 'O título da não conformidade deve conter pelo menos 3 caracteres.')
      .max(160, 'O título não pode exceder 160 caracteres.'),
    description: z.string().optional().nullable().default(''),
    severity: nonConformitySeveritySchema,
    evidence_uris: z.array(z.string().trim().min(1)).optional().default([]),
    evidence_ids: z.array(z.string().trim().min(1)).optional().default([]),
  })
  .superRefine((data, ctx) => {
    const trimmedDescription = (data.description ?? '').trim();
    const validEvidenceUris = (data.evidence_uris ?? []).filter(
      (uri) => typeof uri === 'string' && uri.trim().length > 0
    );
    const validEvidenceIds = (data.evidence_ids ?? []).filter(
      (id) => typeof id === 'string' && id.trim().length > 0
    );
    const totalEvidences = validEvidenceUris.length + validEvidenceIds.length;

    if (requiresCompulsoryEvidenceAndDescription(data.severity)) {
      if (trimmedDescription.length < MIN_DETAILED_DESCRIPTION_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: CRITICAL_DESCRIPTION_REQUIRED_MESSAGE,
        });
      }

      if (totalEvidences < 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['evidence_uris'],
          message: CRITICAL_PHOTO_REQUIRED_MESSAGE,
        });
      }
    }
  });

export type NonConformitySchemaInput = z.input<typeof nonConformitySchema>;
export type NonConformitySchemaOutput = z.output<typeof nonConformitySchema>;

export interface NonConformityValidationResult {
  success: boolean;
  data: NonConformitySchemaOutput | null;
  errors: string[];
  fieldErrors: Record<string, string>;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

/**
 * Normaliza aliases camelCase/snake_case antes da validação com Zod.
 */
export function normalizeNonConformityPayload(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const inspectionIdRaw = raw.inspection_id ?? raw.inspectionId;
  const itemIdRaw =
    raw.item_id !== undefined ? raw.item_id : raw.itemId !== undefined ? raw.itemId : null;
  const itemTitleRaw =
    raw.item_title !== undefined
      ? raw.item_title
      : raw.itemTitle !== undefined
        ? raw.itemTitle
        : null;

  const evidenceUris = normalizeStringArray(
    raw.evidence_uris ?? raw.evidenceUris ?? raw.evidences ?? raw.photos
  );
  const evidenceIds = normalizeStringArray(raw.evidence_ids ?? raw.evidenceIds);

  const normalizedSeverity =
    typeof raw.severity === 'string' ? raw.severity.trim().toUpperCase() : raw.severity;

  return {
    ...(raw.id !== undefined ? { id: raw.id } : {}),
    inspection_id: inspectionIdRaw,
    item_id: itemIdRaw === '' ? null : itemIdRaw,
    item_title: itemTitleRaw === '' ? null : itemTitleRaw,
    title: raw.title,
    description: raw.description ?? '',
    severity: normalizedSeverity,
    evidence_uris: evidenceUris,
    evidence_ids: evidenceIds,
  };
}

/**
 * Valida uma não conformidade aplicando o schema Zod e retorna erros mapeados por campo.
 */
export function validateNonConformity(raw: unknown): NonConformityValidationResult {
  const normalized =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? normalizeNonConformityPayload(raw as Record<string, unknown>)
      : raw;

  const parsed = nonConformitySchema.safeParse(normalized);

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
      errors: [],
      fieldErrors: {},
    };
  }

  const fieldErrors: Record<string, string> = {};
  const errors: string[] = [];

  for (const issue of parsed.error.issues) {
    const fieldKey = issue.path.length > 0 ? String(issue.path[0]) : 'form';
    if (!fieldErrors[fieldKey]) {
      fieldErrors[fieldKey] = issue.message;
    }
    if (!errors.includes(issue.message)) {
      errors.push(issue.message);
    }
  }

  return {
    success: false,
    data: null,
    errors,
    fieldErrors,
  };
}
