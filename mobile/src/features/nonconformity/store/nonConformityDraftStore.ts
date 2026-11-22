import { create } from 'zustand';
import type { NonConformitySeverity } from '../domain/types';

export type NonConformityReturnRoute = 'details' | 'non-conformities';

export interface NonConformityPendingDraft {
  inspectionId: string;
  editingNonConformityId: string | null;
  itemId: string | null;
  itemTitle: string | null;
  title: string;
  description: string;
  severity: NonConformitySeverity;
  evidenceUris: string[];
  evidenceIds: string[];
  returnRoute: NonConformityReturnRoute;
  readyToRestore: boolean;
}

interface NonConformityDraftStoreState {
  draftsByInspectionId: Record<string, NonConformityPendingDraft>;
  saveDraft: (
    draft: Omit<NonConformityPendingDraft, 'readyToRestore'> & {
      readyToRestore?: boolean;
    }
  ) => void;
  appendCapturedEvidence: (
    inspectionId: string,
    evidenceUri: string,
    evidenceId?: string | null
  ) => void;
  markReadyToRestore: (inspectionId: string) => void;
  consumeDraft: (
    inspectionId: string,
    expectedReturnRoute?: NonConformityReturnRoute
  ) => NonConformityPendingDraft | null;
  clearDraft: (inspectionId?: string) => void;
}

function dedupeTrimmed(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const trimmed = typeof val === 'string' ? val.trim() : '';
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Store efêmero de UI (Zustand v5) para preservar o rascunho do formulário de Não Conformidade
 * durante o fluxo de captura fotográfica na rota dedicada de câmera (TASK-017 / Passo 4).
 */
export const useNonConformityDraftStore = create<NonConformityDraftStoreState>(
  (set, get) => ({
    draftsByInspectionId: {},

    saveDraft: (draft) => {
      if (!draft.inspectionId) return;
      set((state) => ({
        draftsByInspectionId: {
          ...state.draftsByInspectionId,
          [draft.inspectionId]: {
            ...draft,
            evidenceUris: dedupeTrimmed(draft.evidenceUris),
            evidenceIds: dedupeTrimmed(draft.evidenceIds),
            readyToRestore: draft.readyToRestore ?? false,
          },
        },
      }));
    },

    appendCapturedEvidence: (inspectionId, evidenceUri, evidenceId) => {
      if (!inspectionId) return;
      set((state) => {
        const existing = state.draftsByInspectionId[inspectionId];
        if (!existing) return state;
        return {
          draftsByInspectionId: {
            ...state.draftsByInspectionId,
            [inspectionId]: {
              ...existing,
              evidenceUris: dedupeTrimmed([...existing.evidenceUris, evidenceUri]),
              evidenceIds: dedupeTrimmed([...existing.evidenceIds, evidenceId]),
              readyToRestore: true,
            },
          },
        };
      });
    },

    markReadyToRestore: (inspectionId) => {
      if (!inspectionId) return;
      set((state) => {
        const existing = state.draftsByInspectionId[inspectionId];
        if (!existing) return state;
        return {
          draftsByInspectionId: {
            ...state.draftsByInspectionId,
            [inspectionId]: {
              ...existing,
              readyToRestore: true,
            },
          },
        };
      });
    },

    consumeDraft: (inspectionId, expectedReturnRoute) => {
      if (!inspectionId) return null;
      const existing = get().draftsByInspectionId[inspectionId];
      if (!existing) return null;
      if (expectedReturnRoute && existing.returnRoute !== expectedReturnRoute) {
        return null;
      }
      set((state) => {
        const next = { ...state.draftsByInspectionId };
        delete next[inspectionId];
        return { draftsByInspectionId: next };
      });
      return existing;
    },

    clearDraft: (inspectionId) => {
      if (!inspectionId) {
        set({ draftsByInspectionId: {} });
        return;
      }
      set((state) => {
        if (!state.draftsByInspectionId[inspectionId]) return state;
        const next = { ...state.draftsByInspectionId };
        delete next[inspectionId];
        return { draftsByInspectionId: next };
      });
    },
  })
);
