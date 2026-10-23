import { z } from 'zod';
import type { ChecklistItem, ChecklistResponseType } from '../../../infrastructure/database/types';

/**
 * Enums e Constantes de Conformidade
 */
export const ConformityState = {
  CONFORMING: 'CONFORMING',
  NON_CONFORMING: 'NON_CONFORMING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
} as const;

export type ConformityStateType = (typeof ConformityState)[keyof typeof ConformityState];

export const CONFORMITY_LABELS: Record<ConformityStateType, string> = {
  CONFORMING: 'Conforme',
  NON_CONFORMING: 'Não Conforme',
  NOT_APPLICABLE: 'Não Aplicável',
};

/**
 * Tipos de resposta suportados conforme SPEC-003
 */
export const SUPPORTED_RESPONSE_TYPES: ChecklistResponseType[] = [
  'TEXT_SHORT',
  'TEXT_LONG',
  'NUMBER',
  'BOOLEAN',
  'CONFORMITY',
  'SINGLE_CHOICE',
  'DATE',
];

/**
 * Schema base para validação de texto curto (TEXT_SHORT)
 */
export function createShortTextSchema(rules?: { required?: boolean; maxLength?: number; minLength?: number }) {
  const isRequired = rules?.required ?? false;
  const max = rules?.maxLength ?? 255;
  const min = rules?.minLength ?? (isRequired ? 1 : 0);

  let schema = z.string().trim();

  if (isRequired) {
    schema = schema.min(1, 'Este campo é obrigatório');
  }

  if (min > 1) {
    schema = schema.min(min, `Deve conter no mínimo ${min} caracteres`);
  }

  if (max) {
    schema = schema.max(max, `Tamanho máximo de ${max} caracteres excedido`);
  }

  return isRequired ? schema : schema.optional().nullable();
}

/**
 * Schema base para validação de texto longo (TEXT_LONG)
 */
export function createLongTextSchema(rules?: { required?: boolean; maxLength?: number; minLength?: number }) {
  const isRequired = rules?.required ?? false;
  const max = rules?.maxLength ?? 2000;
  const min = rules?.minLength ?? (isRequired ? 1 : 0);

  let schema = z.string().trim();

  if (isRequired) {
    schema = schema.min(1, 'Este campo é obrigatório');
  }

  if (min > 1) {
    schema = schema.min(min, `Deve conter no mínimo ${min} caracteres`);
  }

  if (max) {
    schema = schema.max(max, `Tamanho máximo de ${max} caracteres excedido`);
  }

  return isRequired ? schema : schema.optional().nullable();
}

/**
 * Schema base para validação de número (NUMBER)
 */
export function createNumericSchema(rules?: { required?: boolean; min?: number; max?: number }) {
  const isRequired = rules?.required ?? false;

  const numericTransform = z
    .union([z.number(), z.string()])
    .refine(
      (val) => {
        if (val === '' || val === null || val === undefined) return !isRequired;
        const num = typeof val === 'number' ? val : Number(val.toString().replace(',', '.'));
        return !isNaN(num) && isFinite(num);
      },
      { message: 'Informe um número válido' }
    )
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null;
      return typeof val === 'number' ? val : Number(val.toString().replace(',', '.'));
    });

  let schema = numericTransform.superRefine((val, ctx) => {
    if (val === null) {
      if (isRequired) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Este campo é obrigatório',
        });
      }
      return;
    }

    if (rules?.min !== undefined && val < rules.min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `O valor deve ser maior ou igual a ${rules.min}`,
      });
    }

    if (rules?.max !== undefined && val > rules.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `O valor deve ser menor ou igual a ${rules.max}`,
      });
    }
  });

  return isRequired ? schema : schema.optional().nullable();
}

/**
 * Schema base para validação de booleano (BOOLEAN)
 */
export function createBooleanSchema(rules?: { required?: boolean }) {
  const isRequired = rules?.required ?? false;

  const boolSchema = z
    .union([z.boolean(), z.string()])
    .refine(
      (val) => {
        if (val === null || val === undefined || val === '') return !isRequired;
        if (typeof val === 'boolean') return true;
        const str = String(val).toLowerCase();
        return ['true', 'false', '1', '0', 'sim', 'não', 'nao'].includes(str);
      },
      { message: 'Selecione uma opção válida (Sim ou Não)' }
    )
    .transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'boolean') return val;
      const str = String(val).toLowerCase();
      return ['true', '1', 'sim'].includes(str);
    });

  if (isRequired) {
    return boolSchema.refine((val) => val !== null && val !== undefined, {
      message: 'Este item obrigatório deve ser respondido',
    });
  }

  return boolSchema.optional().nullable();
}

/**
 * Schema base para validação de conformidade (CONFORMITY)
 * RF-02 / RN-038: Se 'Não Conforme' for selecionado, a descrição é obrigatória.
 */
export const conformityValueSchema = z.enum([
  ConformityState.CONFORMING,
  ConformityState.NON_CONFORMING,
  ConformityState.NOT_APPLICABLE,
  // Aliases aceitos
  'CONFORME',
  'NAO_CONFORME',
  'NAO_APLICAVEL',
]);

export interface ConformityInputData {
  conformity: ConformityStateType | 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL' | null;
  nonConformityDescription?: string | null;
}

export function createConformitySchema(rules?: { required?: boolean }) {
  const isRequired = rules?.required ?? false;

  return z
    .object({
      conformity: isRequired
        ? conformityValueSchema.refine((val) => !!val, { message: 'Selecione uma opção de conformidade' })
        : conformityValueSchema.optional().nullable(),
      nonConformityDescription: z.string().optional().nullable(),
    })
    .superRefine((data, ctx) => {
      const isNonConforming =
        data.conformity === ConformityState.NON_CONFORMING || data.conformity === 'NAO_CONFORME';

      if (isNonConforming) {
        const desc = data.nonConformityDescription?.trim() ?? '';
        if (desc.length < 3) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['nonConformityDescription'],
            message: 'A descrição da não conformidade é obrigatória (mínimo 3 caracteres)',
          });
        }
      }
    });
}

/**
 * Schema base para validação de seleção única (SINGLE_CHOICE)
 */
export function createSingleChoiceSchema(options: string[], rules?: { required?: boolean }) {
  const isRequired = rules?.required ?? false;

  let schema = z.string().trim();

  if (isRequired) {
    schema = schema.min(1, 'Selecione uma das opções disponíveis');
  }

  if (options && options.length > 0) {
    return schema.superRefine((val, ctx) => {
      if (!val && !isRequired) return;
      if (!options.includes(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opção selecionada inválida',
        });
      }
    });
  }

  return isRequired ? schema : schema.optional().nullable();
}

/**
 * Schema base para validação de data (DATE) - ISO 8601 (YYYY-MM-DD)
 */
export function createDateSchema(rules?: { required?: boolean; minDate?: string; maxDate?: string }) {
  const isRequired = rules?.required ?? false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  let schema = z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return !isRequired;
        if (!dateRegex.test(val)) return false;
        const [year, month, day] = val.split('-').map(Number);
        const parsed = new Date(year, month - 1, day);
        return (
          parsed.getFullYear() === year &&
          parsed.getMonth() === month - 1 &&
          parsed.getDate() === day
        );
      },
      { message: 'Data inválida. Utilize o formato AAAA-MM-DD' }
    );

  if (isRequired) {
    schema = schema.min(1, 'Este campo é obrigatório');
  }

  return schema.superRefine((val, ctx) => {
    if (!val) return;
    if (rules?.minDate && val < rules.minDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A data não pode ser anterior a ${rules.minDate}`,
      });
    }
    if (rules?.maxDate && val > rules.maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A data não pode ser posterior a ${rules.maxDate}`,
      });
    }
  });
}

/**
 * Fábrica dinâmica de validação baseada na entidade ChecklistItem do SQLite
 */
export function createItemResponseSchema(item: ChecklistItem) {
  const isRequired = Boolean(item.required);

  let options: string[] = [];
  if (item.options_json) {
    try {
      const parsed = JSON.parse(item.options_json);
      if (Array.isArray(parsed)) {
        options = parsed.map(String);
      }
    } catch {
      options = [];
    }
  }

  switch (item.response_type) {
    case 'TEXT_SHORT':
      return z.object({
        value: createShortTextSchema({ required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    case 'TEXT_LONG':
      return z.object({
        value: createLongTextSchema({ required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    case 'NUMBER':
      return z.object({
        value: createNumericSchema({ required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    case 'BOOLEAN':
      return z.object({
        value: createBooleanSchema({ required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    case 'CONFORMITY':
      return createConformitySchema({ required: isRequired });

    case 'SINGLE_CHOICE':
      return z.object({
        value: createSingleChoiceSchema(options, { required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    case 'DATE':
      return z.object({
        value: createDateSchema({ required: isRequired }),
        observation: z.string().optional().nullable(),
      });

    default:
      // Fallback seguro para tipo desconhecido (CA-02)
      return z.object({
        value: z.any().optional(),
        observation: z.string().optional().nullable(),
      });
  }
}

/**
 * Normaliza o valor de conformidade para o formato padrão do backend / SPEC-003
 */
export function normalizeConformity(
  val: string | null | undefined
): ConformityStateType | null {
  if (!val) return null;
  const upper = val.toUpperCase().trim();
  if (upper === 'CONFORMING' || upper === 'CONFORME') return ConformityState.CONFORMING;
  if (upper === 'NON_CONFORMING' || upper === 'NAO_CONFORME' || upper === 'NÃO CONFORME')
    return ConformityState.NON_CONFORMING;
  if (upper === 'NOT_APPLICABLE' || upper === 'NAO_APLICAVEL' || upper === 'NÃO APLICÁVEL' || upper === 'N/A')
    return ConformityState.NOT_APPLICABLE;
  return null;
}
