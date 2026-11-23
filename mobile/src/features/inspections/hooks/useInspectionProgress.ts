import { useMemo } from 'react';
import {
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistResponseType,
  type ChecklistSection,
  type InspectionEvidence,
} from '@/infrastructure/database/types';

export type PendingItemReason =
  | 'MISSING_RESPONSE'
  | 'MISSING_NC_DESCRIPTION'
  | 'MISSING_EVIDENCE';

export interface PendingInspectionItem {
  item: ChecklistItem;
  itemId: string;
  title: string;
  description?: string | null;
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
  itemOrder: number;
  responseType: ChecklistResponseType;
  required: boolean;
  reason: PendingItemReason;
  reasonLabel: string;
}

export interface InspectionProgressSummary {
  totalItems: number;
  applicableItems: number;
  answeredItems: number;
  pendingItemsCount: number;
  requiredItems: number;
  answeredRequiredItems: number;
  pendingRequiredCount: number;
  pendingRequiredItems: PendingInspectionItem[];
  pendingOptionalItems: PendingInspectionItem[];
  nonConformitiesCount: number;
  evidencesCount: number;
  percentage: number;
  requiredPercentage: number;
  canComplete: boolean;
  isComplete: boolean;
  answeredItemIds: Set<string>;
}

export interface UseInspectionProgressInput {
  items: ChecklistItem[];
  responses: ChecklistResponse[];
  sections?: ChecklistSection[];
  evidences?: InspectionEvidence[];
}

const INACTIVE_ITEM_STATUSES = new Set(['INACTIVE', 'DISABLED', 'SKIPPED', 'NOT_APPLICABLE_ITEM']);
const EMPTY_SECTIONS: ChecklistSection[] = [];
const EMPTY_EVIDENCES: InspectionEvidence[] = [];

function isItemApplicable(item: ChecklistItem): boolean {
  if (!item.status) return true;
  const normalized = String(item.status).trim().toUpperCase();
  return !INACTIVE_ITEM_STATUSES.has(normalized);
}

function hasFilledResponseValue(response?: ChecklistResponse | null): boolean {
  if (!response) return false;
  if (response.value === undefined || response.value === null) return false;
  return String(response.value).trim() !== '';
}

function isNonConformityResponse(response?: ChecklistResponse | null): boolean {
  if (!response) return false;
  if (Boolean(response.is_non_conformity)) return true;
  const normalized = String(response.value ?? '').trim().toUpperCase();
  return normalized === 'NON_CONFORMING' || normalized === 'NAO_CONFORME';
}

function itemRequiresEvidence(item: ChecklistItem, response?: ChecklistResponse | null): boolean {
  const anyItem = item as ChecklistItem & {
    require_evidence?: boolean | number;
    requireEvidence?: boolean;
    require_evidence_on_nc?: boolean | number;
    requireEvidenceOnNc?: boolean;
    critical?: boolean | number;
    is_critical?: boolean | number;
  };

  if (Boolean(anyItem.require_evidence) || Boolean(anyItem.requireEvidence)) {
    return true;
  }

  const isNc = isNonConformityResponse(response);
  if (
    isNc &&
    (Boolean(anyItem.require_evidence_on_nc) ||
      Boolean(anyItem.requireEvidenceOnNc) ||
      Boolean(anyItem.critical) ||
      Boolean(anyItem.is_critical))
  ) {
    return true;
  }

  return false;
}

function getPendingReason(
  item: ChecklistItem,
  response: ChecklistResponse | undefined,
  evidencesByItemId: Map<string, InspectionEvidence[]>
): { reason: PendingItemReason; reasonLabel: string } | null {
  if (!hasFilledResponseValue(response)) {
    return {
      reason: 'MISSING_RESPONSE',
      reasonLabel: 'Resposta obrigatória não preenchida',
    };
  }

  if (itemRequiresEvidence(item, response)) {
    const itemEvidences = evidencesByItemId.get(item.id) ?? [];
    if (itemEvidences.length === 0) {
      return {
        reason: 'MISSING_EVIDENCE',
        reasonLabel: 'Evidência fotográfica obrigatória pendente',
      };
    }
  }

  return null;
}

/**
 * Verifica se um item do checklist está respondido (incluindo evidência obrigatória quando configurada).
 */
export function isChecklistItemAnswered(
  item: ChecklistItem,
  response?: ChecklistResponse | null,
  evidences: InspectionEvidence[] = []
): boolean {
  if (!hasFilledResponseValue(response)) {
    return false;
  }
  if (itemRequiresEvidence(item, response)) {
    const hasEvidence = evidences.some((ev) => ev.item_id === item.id);
    if (!hasEvidence) return false;
  }
  return true;
}

/**
 * Calcula dinamicamente progresso, itens respondidos vs aplicáveis e pendências obrigatórias (RF-04, RF-05, RF-06, RN-040).
 */
export function calculateInspectionProgress({
  items,
  responses,
  sections = [],
  evidences = [],
}: UseInspectionProgressInput): InspectionProgressSummary {
  const sectionMap = new Map<string, ChecklistSection>();
  for (const sec of sections) {
    sectionMap.set(sec.id, sec);
  }

  const responseByItemId = new Map<string, ChecklistResponse>();
  for (const resp of responses) {
    responseByItemId.set(resp.item_id, resp);
  }

  const evidencesByItemId = new Map<string, InspectionEvidence[]>();
  for (const ev of evidences) {
    if (!ev.item_id) continue;
    const list = evidencesByItemId.get(ev.item_id) ?? [];
    list.push(ev);
    evidencesByItemId.set(ev.item_id, list);
  }

  const applicableList = items.filter(isItemApplicable);
  const answeredItemIds = new Set<string>();
  const pendingRequiredItems: PendingInspectionItem[] = [];
  const pendingOptionalItems: PendingInspectionItem[] = [];

  let requiredItems = 0;
  let answeredRequiredItems = 0;
  let nonConformitiesCount = 0;

  for (const item of applicableList) {
    const response = responseByItemId.get(item.id);
    const isRequired = Boolean(item.required);
    const section = sectionMap.get(item.section_id);
    const sectionTitle = section?.title || 'Checklist';
    const sectionOrder = section?.order_index ?? 0;

    if (isNonConformityResponse(response)) {
      nonConformitiesCount += 1;
    }

    if (isRequired) {
      requiredItems += 1;
    }

    const pendingInfo = getPendingReason(item, response, evidencesByItemId);
    if (!pendingInfo) {
      answeredItemIds.add(item.id);
      if (isRequired) {
        answeredRequiredItems += 1;
      }
      continue;
    }

    const pendingEntry: PendingInspectionItem = {
      item,
      itemId: item.id,
      title: item.title,
      description: item.description,
      sectionId: item.section_id,
      sectionTitle,
      sectionOrder,
      itemOrder: item.order_index ?? 0,
      responseType: item.response_type,
      required: isRequired,
      reason: pendingInfo.reason,
      reasonLabel: pendingInfo.reasonLabel,
    };

    if (isRequired) {
      pendingRequiredItems.push(pendingEntry);
    } else {
      pendingOptionalItems.push(pendingEntry);
    }
  }

  const sortPending = (a: PendingInspectionItem, b: PendingInspectionItem) => {
    if (a.sectionOrder !== b.sectionOrder) {
      return a.sectionOrder - b.sectionOrder;
    }
    return a.itemOrder - b.itemOrder;
  };

  pendingRequiredItems.sort(sortPending);
  pendingOptionalItems.sort(sortPending);

  const totalItems = items.length;
  const applicableItems = applicableList.length;
  const answeredItems = answeredItemIds.size;
  const pendingItemsCount = Math.max(0, applicableItems - answeredItems);
  const pendingRequiredCount = pendingRequiredItems.length;

  const percentage =
    applicableItems > 0 ? Math.round((answeredItems / applicableItems) * 100) : 0;
  const requiredPercentage =
    requiredItems > 0
      ? Math.round((answeredRequiredItems / requiredItems) * 100)
      : 100;

  return {
    totalItems,
    applicableItems,
    answeredItems,
    pendingItemsCount,
    requiredItems,
    answeredRequiredItems,
    pendingRequiredCount,
    pendingRequiredItems,
    pendingOptionalItems,
    nonConformitiesCount,
    evidencesCount: evidences.length,
    percentage,
    requiredPercentage,
    canComplete: pendingRequiredCount === 0,
    isComplete: applicableItems > 0 && pendingItemsCount === 0,
    answeredItemIds,
  };
}

/**
 * Hook reativo para cálculo dinâmico de progresso da inspeção (TASK-015 Passo 2).
 */
export function useInspectionProgress({
  items,
  responses,
  sections = EMPTY_SECTIONS,
  evidences = EMPTY_EVIDENCES,
}: UseInspectionProgressInput): InspectionProgressSummary {
  return useMemo(
    () =>
      calculateInspectionProgress({
        items,
        responses,
        sections,
        evidences,
      }),
    [items, responses, sections, evidences]
  );
}
