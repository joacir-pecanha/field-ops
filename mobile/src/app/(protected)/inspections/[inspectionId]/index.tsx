import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { StatusBadge, type InspectionStatus } from '@/design-system/components/StatusBadge';
import { tokens } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  AWAITING_SYNC_LABEL,
  INSPECTION_NOT_FOUND_MESSAGE,
  InspectionLifecycleError,
  PERMISSION_DENIED_MESSAGE,
  PendingItemsModal,
  PriorityBadge,
  SyncStatusBadge,
  getInspectionLocations,
  isInspectionReadOnly,
  saveChecklistResponse,
  startInspection,
  useInspectionDetails,
  useInspectionProgress,
  type InspectionLocationsResult,
  type PendingInspectionItem,
  type UseInspectionDetailsOptions,
} from '@/features/inspections';
import { DynamicItemRenderer } from '@/features/checklist';
import {
  EvidenceGallery,
  deleteEvidencePhoto,
  listInspectionEvidences,
  type EvidenceRecord,
} from '@/features/evidence';
import {
  NON_CONFORMITY_SEVERITY_META,
  NonConformityFormModal,
  nonConformityRepository,
  useNonConformityDraftStore,
  type NonConformity,
  type NonConformityDraftSnapshot,
  type NonConformityFormSubmitPayload,
  type NonConformitySeverity,
} from '@/features/nonconformity';
import {
  OsmLeafletMap,
  formatCoordinatesSummary,
} from '@/features/location/services/locationService';
import { getEquipmentVerificationRecord } from '@/features/scanner/services/qrValidator';
import {
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistSection,
} from '@/infrastructure/database/types';

export interface InspectionDetailsScreenProps {
  inspectionId?: string;
  detailsOptions?: UseInspectionDetailsOptions;
}

function formatDateTime(isoDate?: string | null): string {
  if (!isoDate) {
    return 'Não definida';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return `${parsed.toLocaleDateString('pt-BR')} às ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatResponseTypeLabel(type: string): string {
  switch (type) {
    case 'CONFORMITY':
      return 'Conformidade';
    case 'BOOLEAN':
      return 'Sim / Não';
    case 'NUMBER':
      return 'Numérico';
    case 'SINGLE_CHOICE':
      return 'Seleção Única';
    case 'DATE':
      return 'Data';
    case 'TEXT_LONG':
      return 'Texto Longo';
    default:
      return 'Texto';
  }
}

function parseStoredResponseValue(
  item: ChecklistItem,
  rawValue?: string | null
): unknown {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return item.response_type === 'BOOLEAN' ? undefined : '';
  }
  if (item.response_type === 'BOOLEAN') {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
  }
  if (item.response_type === 'NUMBER') {
    const num = Number(rawValue);
    return Number.isFinite(num) ? num : rawValue;
  }
  return rawValue;
}

export default function InspectionDetailsScreen(props: InspectionDetailsScreenProps) {
  const { inspectionId: propInspectionId, detailsOptions } = props ?? {};
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    inspectionId?: string;
    id?: string;
    qrVerified?: string;
    openChecklist?: string;
    focusItemId?: string;
    scannedCode?: string;
    divergenceJustified?: string;
    evidenceSaved?: string;
    restoreNcModal?: string;
    capturedEvidenceId?: string;
    capturedEvidenceUri?: string;
  }>();
  const resolvedId = useMemo(() => {
    const raw = propInspectionId ?? params.inspectionId ?? params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [propInspectionId, params.inspectionId, params.id]);

  const {
    inspection,
    sections,
    items,
    responses,
    evidences,
    equipment,
    site,
    isOverdue,
    isPendingSync,
    action,
    isLoading,
    isRefreshing,
    isForbidden,
    permissionDeniedMessage,
    notFound,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  } = useInspectionDetails(resolvedId, detailsOptions);

  const [richEvidences, setRichEvidences] = useState<EvidenceRecord[]>([]);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const displayedEvidences: EvidenceRecord[] = useMemo(
    () => (richEvidences.length > 0 ? richEvidences : evidences),
    [richEvidences, evidences]
  );

  const [nonConformities, setNonConformities] = useState<NonConformity[]>([]);
  const [ncModalVisible, setNcModalVisible] = useState(false);
  const [ncTargetItem, setNcTargetItem] = useState<ChecklistItem | null>(null);
  const [ncEditingRecord, setNcEditingRecord] = useState<NonConformity | null>(null);
  const [ncDraftItemId, setNcDraftItemId] = useState<string | null>(null);
  const [ncDraftItemTitle, setNcDraftItemTitle] = useState<string | null>(null);
  const [ncDraftTitle, setNcDraftTitle] = useState('');
  const [ncDraftDescription, setNcDraftDescription] = useState('');
  const [ncDraftSeverity, setNcDraftSeverity] = useState<NonConformitySeverity>('MEDIA');
  const [ncDraftEvidenceUris, setNcDraftEvidenceUris] = useState<string[]>([]);
  const [ncDraftEvidenceIds, setNcDraftEvidenceIds] = useState<string[]>([]);
  const [ncPreferDraftValues, setNcPreferDraftValues] = useState(false);
  const [isSavingNc, setIsSavingNc] = useState(false);
  const [isDeletingNc, setIsDeletingNc] = useState(false);
  const [ncModalError, setNcModalError] = useState<string | null>(null);

  const progress = useInspectionProgress({
    items,
    responses,
    sections,
    evidences: displayedEvidences,
  });

  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isChecklistInteractive, setIsChecklistInteractive] = useState(
    Boolean(
      params.openChecklist === 'true' ||
        params.qrVerified === 'true' ||
        params.focusItemId ||
        params.evidenceSaved === 'true'
    )
  );
  const [focusedItemId, setFocusedItemId] = useState<string | null>(
    params.focusItemId ?? null
  );
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [locations, setLocations] = useState<InspectionLocationsResult>({
    startLocation: null,
    completeLocation: null,
    records: [],
  });
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const isFirstFocusRef = useRef(true);
  const autoStartLocationRef = useRef(false);

  const loadLocations = useCallback(async () => {
    if (!resolvedId || detailsOptions?.initialData) {
      return;
    }
    try {
      const result = await getInspectionLocations(resolvedId);
      setLocations(result);
    } catch {
      // Silencioso em fallback SSR/web
    }
  }, [resolvedId, detailsOptions?.initialData]);

  const loadRichEvidences = useCallback(async () => {
    if (!resolvedId || detailsOptions?.initialData) {
      return;
    }
    try {
      const list = await listInspectionEvidences(resolvedId);
      setRichEvidences(list);
    } catch {
      // Silencioso em fallback SSR/web
    }
  }, [resolvedId, detailsOptions?.initialData]);

  const loadNonConformities = useCallback(async () => {
    if (!resolvedId || detailsOptions?.initialData) {
      return;
    }
    try {
      const list = await nonConformityRepository.findByInspectionId(resolvedId);
      setNonConformities(list);
    } catch {
      // Silencioso em fallback SSR/web
    }
  }, [resolvedId, detailsOptions?.initialData]);

  useEffect(() => {
    void loadLocations();
    void loadRichEvidences();
    void loadNonConformities();
  }, [loadLocations, loadRichEvidences, loadNonConformities]);

  useEffect(() => {
    if (params.evidenceSaved === 'true') {
      setIsChecklistInteractive(true);
      if (params.focusItemId) {
        setFocusedItemId(params.focusItemId);
      }
      setActionFeedback({
        type: 'success',
        text: 'Evidência fotográfica salva offline no armazenamento permanente do dispositivo.',
      });
      return;
    }
    if (params.focusItemId) {
      setIsChecklistInteractive(true);
      setFocusedItemId(params.focusItemId);
      setActionFeedback({
        type: 'warning',
        text: 'Preencha o item obrigatório destacado abaixo para liberar a conclusão da inspeção.',
      });
      return;
    }
    if (params.openChecklist === 'true' || params.qrVerified === 'true') {
      setIsChecklistInteractive(true);
      setActionFeedback({
        type: 'success',
        text:
          params.divergenceJustified === 'true'
            ? 'Divergência registrada com justificativa. Checklist liberado para preenchimento offline.'
            : params.qrVerified === 'true'
            ? 'Equipamento validado via QR Code! Preencha os itens do checklist abaixo.'
            : 'Checklist liberado para preenchimento offline.',
      });
    }
  }, [
    params.openChecklist,
    params.qrVerified,
    params.divergenceJustified,
    params.focusItemId,
    params.evidenceSaved,
  ]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const nonConformitiesRef = useRef(nonConformities);
  nonConformitiesRef.current = nonConformities;

  const restoreNcModalFromDraftIfPending = useCallback(() => {
    const targetInspectionId = inspection?.id ?? resolvedId;
    if (!targetInspectionId) return;

    const draftState = useNonConformityDraftStore.getState();
    const pendingDraft = draftState.draftsByInspectionId[targetInspectionId];
    const shouldRestoreFromParams = params.restoreNcModal === 'true';

    if (!pendingDraft && !shouldRestoreFromParams) {
      return;
    }

    if (
      pendingDraft &&
      pendingDraft.returnRoute !== 'details' &&
      !shouldRestoreFromParams
    ) {
      return;
    }

    if (pendingDraft && !pendingDraft.readyToRestore && !shouldRestoreFromParams) {
      return;
    }

    const consumed = draftState.consumeDraft(targetInspectionId);
    const capturedUri = Array.isArray(params.capturedEvidenceUri)
      ? params.capturedEvidenceUri[0]
      : params.capturedEvidenceUri;
    const capturedId = Array.isArray(params.capturedEvidenceId)
      ? params.capturedEvidenceId[0]
      : params.capturedEvidenceId;

    const matchedEditingNc = consumed?.editingNonConformityId
      ? nonConformitiesRef.current.find((nc) => nc.id === consumed.editingNonConformityId) ?? null
      : null;

    const resolvedItemIdForDraft =
      consumed?.itemId ?? matchedEditingNc?.item_id ?? params.focusItemId ?? null;
    const matchedItem = resolvedItemIdForDraft
      ? itemsRef.current.find((item) => item.id === resolvedItemIdForDraft) ?? null
      : null;

    const dedupeList = (list: Array<string | null | undefined>) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const entry of list) {
        const trimmed = typeof entry === 'string' ? entry.trim() : '';
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          out.push(trimmed);
        }
      }
      return out;
    };

    setNcTargetItem(matchedItem);
    setNcEditingRecord(matchedEditingNc);
    setNcDraftItemId(resolvedItemIdForDraft);
    setNcDraftItemTitle(
      consumed?.itemTitle ?? matchedItem?.title ?? matchedEditingNc?.item_title ?? null
    );
    setNcDraftTitle(consumed?.title ?? matchedEditingNc?.title ?? '');
    setNcDraftDescription(consumed?.description ?? matchedEditingNc?.description ?? '');
    setNcDraftSeverity(consumed?.severity ?? matchedEditingNc?.severity ?? 'MEDIA');
    setNcDraftEvidenceUris(
      dedupeList([
        ...(consumed?.evidenceUris ?? matchedEditingNc?.evidence_uris ?? []),
        capturedUri,
      ])
    );
    setNcDraftEvidenceIds(
      dedupeList([
        ...(consumed?.evidenceIds ?? matchedEditingNc?.evidence_ids ?? []),
        capturedId,
      ])
    );
    setNcPreferDraftValues(true);
    setNcModalError(null);
    setIsChecklistInteractive(true);
    setNcModalVisible(true);
  }, [
    inspection?.id,
    resolvedId,
    params.restoreNcModal,
    params.capturedEvidenceUri,
    params.capturedEvidenceId,
    params.focusItemId,
  ]);

  const restoreNcModalFromDraftIfPendingRef = useRef(restoreNcModalFromDraftIfPending);
  restoreNcModalFromDraftIfPendingRef.current = restoreNcModalFromDraftIfPending;

  useEffect(() => {
    restoreNcModalFromDraftIfPending();
  }, [restoreNcModalFromDraftIfPending]);

  useEffect(() => {
    if (!ncModalVisible || ncTargetItem || !ncDraftItemId) {
      return;
    }
    const matchedItem = items.find((item) => item.id === ncDraftItemId) ?? null;
    if (matchedItem) {
      setNcTargetItem(matchedItem);
    }
  }, [ncModalVisible, ncTargetItem, ncDraftItemId, items]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      reloadLocal();
      void loadLocations();
      void loadRichEvidences();
      void loadNonConformities();
      restoreNcModalFromDraftIfPendingRef.current();
    }, [reloadLocal, loadLocations, loadRichEvidences, loadNonConformities])
  );

  // Captura GPS pontual de início automaticamente ao retornar do scanner com QR validado (RF-02, CA-04)
  useEffect(() => {
    if (
      params.qrVerified !== 'true' ||
      !inspection?.id ||
      detailsOptions?.initialData ||
      isInspectionReadOnly(inspection.status) ||
      autoStartLocationRef.current
    ) {
      return;
    }
    autoStartLocationRef.current = true;

    const ensureStartLocation = async () => {
      try {
        const currentLocs = await getInspectionLocations(inspection.id);
        if (!currentLocs.startLocation) {
          await startInspection({
            inspectionId: inspection.id,
            technicianId: user?.id ?? null,
            userRole: user?.role ?? null,
          });
          await reloadLocal();
          await loadLocations();
        } else {
          setLocations(currentLocs);
        }
      } catch {
        // EX-01: Nunca trava a tela caso GPS esteja indisponível
      }
    };

    void ensureStartLocation();
  }, [
    params.qrVerified,
    inspection?.id,
    inspection?.status,
    detailsOptions?.initialData,
    user?.id,
    user?.role,
    reloadLocal,
    loadLocations,
  ]);

  // EX-01: Redireciona de volta para a lista quando tentativa de acesso não autorizado é detectada
  useEffect(() => {
    if (!isForbidden) {
      return;
    }
    const timer = setTimeout(() => {
      router.replace('/(protected)/(tabs)/inspections');
    }, 2200);
    return () => clearTimeout(timer);
  }, [isForbidden, router]);

  const respondedItemIds = progress.answeredItemIds;

  const responseByItemId = useMemo(() => {
    const map = new Map<string, ChecklistResponse>();
    for (const r of responses) {
      map.set(r.item_id, r);
    }
    return map;
  }, [responses]);

  const evidencesByItemId = useMemo(() => {
    const map = new Map<string, EvidenceRecord[]>();
    for (const ev of displayedEvidences) {
      if (!ev.item_id) continue;
      const list = map.get(ev.item_id) ?? [];
      list.push(ev);
      map.set(ev.item_id, list);
    }
    return map;
  }, [displayedEvidences]);

  const nonConformitiesByItemId = useMemo(() => {
    const map = new Map<string, NonConformity[]>();
    for (const nc of nonConformities) {
      if (!nc.item_id) continue;
      const list = map.get(nc.item_id) ?? [];
      list.push(nc);
      map.set(nc.item_id, list);
    }
    return map;
  }, [nonConformities]);

  const verificationRecord = inspection
    ? getEquipmentVerificationRecord(inspection.id)
    : null;
  const isQrVerified = Boolean(verificationRecord) || params.qrVerified === 'true';
  const isReadOnlyInspection = Boolean(
    inspection && (isInspectionReadOnly(inspection.status) || action.isReadOnly)
  );
  const isEditableInspection =
    !isReadOnlyInspection && (action.type === 'START' || action.type === 'CONTINUE');

  const openNonConformityModal = useCallback(
    (
      targetItem: ChecklistItem | null = null,
      existingNc: NonConformity | null = null,
      prefillDescription?: string | null
    ) => {
      if (!inspection) return;
      const itemEvidences = targetItem ? evidencesByItemId.get(targetItem.id) ?? [] : [];
      const mergedUris = Array.from(
        new Set([
          ...(existingNc?.evidence_uris ?? []),
          ...itemEvidences.map((ev) => ev.local_uri),
        ])
      );
      const mergedIds = Array.from(
        new Set([
          ...(existingNc?.evidence_ids ?? []),
          ...itemEvidences.map((ev) => ev.id),
        ])
      );

      setNcTargetItem(targetItem);
      setNcEditingRecord(existingNc);
      setNcDraftItemId(targetItem?.id ?? existingNc?.item_id ?? null);
      setNcDraftItemTitle(targetItem?.title ?? existingNc?.item_title ?? null);
      setNcDraftTitle(
        existingNc?.title ??
          (targetItem ? `Não conformidade: ${targetItem.title}` : '')
      );
      setNcDraftDescription(
        existingNc?.description ?? prefillDescription ?? ''
      );
      setNcDraftSeverity(existingNc?.severity ?? 'MEDIA');
      setNcDraftEvidenceUris(mergedUris);
      setNcDraftEvidenceIds(mergedIds);
      setNcPreferDraftValues(false);
      setNcModalError(null);
      setNcModalVisible(true);
    },
    [inspection, evidencesByItemId]
  );

  const handleSaveNonConformity = useCallback(
    async (payload: NonConformityFormSubmitPayload) => {
      if (!inspection) return;
      setIsSavingNc(true);
      setNcModalError(null);
      try {
        const result = ncEditingRecord
          ? await nonConformityRepository.update(ncEditingRecord.id, {
              ...payload,
              technicianId: user?.id ?? null,
              userRole: user?.role ?? null,
            })
          : await nonConformityRepository.create({
              ...payload,
              created_by: user?.id ?? null,
              technicianId: user?.id ?? null,
              userRole: user?.role ?? null,
            });

        if (!result.success) {
          setNcModalError(result.message);
          return;
        }

        useNonConformityDraftStore.getState().clearDraft(inspection.id);
        await loadNonConformities();
        await reloadLocal();
        setNcModalVisible(false);
        setNcPreferDraftValues(false);
        setActionFeedback({
          type: 'success',
          text: result.message,
        });
      } finally {
        setIsSavingNc(false);
      }
    },
    [inspection, ncEditingRecord, user?.id, user?.role, loadNonConformities, reloadLocal]
  );

  const handleDeleteOrCancelNonConformity = useCallback(
    async (nc: NonConformity) => {
      if (!inspection) return;
      setIsDeletingNc(true);
      setNcModalError(null);
      try {
        const result = await nonConformityRepository.deleteOrCancel(nc.id, {
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        });

        if (!result.success) {
          setNcModalError(result.message);
          return;
        }

        useNonConformityDraftStore.getState().clearDraft(inspection.id);
        await loadNonConformities();
        await reloadLocal();
        setNcModalVisible(false);
        setNcPreferDraftValues(false);
        setActionFeedback({
          type: 'info',
          text: result.message,
        });
      } finally {
        setIsDeletingNc(false);
      }
    },
    [inspection, user?.id, user?.role, loadNonConformities, reloadLocal]
  );

  const handleAttachPhotoFromNcModal = useCallback(
    (draft: NonConformityDraftSnapshot) => {
      if (!inspection) return;
      useNonConformityDraftStore.getState().saveDraft({
        inspectionId: inspection.id,
        editingNonConformityId:
          draft.editingNonConformityId ?? ncEditingRecord?.id ?? null,
        itemId: draft.itemId,
        itemTitle: draft.itemTitle,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        evidenceUris: draft.evidenceUris,
        evidenceIds: draft.evidenceIds,
        returnRoute: 'details',
      });
      setNcModalVisible(false);
      router.push({
        pathname: '/(protected)/evidence/capture',
        params: {
          inspectionId: inspection.id,
          ...(draft.itemId ? { itemId: draft.itemId } : {}),
          ...(draft.itemTitle ? { itemTitle: draft.itemTitle } : {}),
          ...(draft.editingNonConformityId || ncEditingRecord?.id
            ? {
                nonConformityId:
                  draft.editingNonConformityId ?? ncEditingRecord?.id ?? '',
              }
            : {}),
          isNonConformity: 'true',
          returnToNcModal: 'true',
          returnRoute: 'details',
        },
      });
    },
    [inspection, ncEditingRecord?.id, router]
  );

  const handleSaveChecklistAnswer = useCallback(
    async (
      item: ChecklistItem,
      nextValue: unknown,
      nonConformityDescription?: string,
      triggerNcModal = false
    ) => {
      if (!inspection) return;
      if (isReadOnlyInspection) {
        setActionFeedback({
          type: 'warning',
          text: 'Edição bloqueada: inspeção já concluída em modo somente leitura.',
        });
        return;
      }

      try {
        await saveChecklistResponse({
          inspectionId: inspection.id,
          item,
          value: nextValue,
          nonConformityDescription,
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        });

        if (
          focusedItemId === item.id &&
          nextValue !== undefined &&
          nextValue !== null &&
          String(nextValue).trim() !== ''
        ) {
          setFocusedItemId(null);
        }

        await reloadLocal();

        // RF-05 (TASK-017): Ao marcar item como "Não Conforme", abre automaticamente o modal de registro
        if (
          triggerNcModal &&
          item.response_type === 'CONFORMITY' &&
          (nextValue === 'NON_CONFORMING' || nextValue === 'NAO_CONFORME')
        ) {
          const existingItemNc = nonConformitiesByItemId.get(item.id)?.[0] ?? null;
          openNonConformityModal(item, existingItemNc, nonConformityDescription);
        }
      } catch (err: any) {
        if (err instanceof InspectionLifecycleError && err.code === 'READ_ONLY_INSPECTION') {
          setActionFeedback({
            type: 'warning',
            text: err.message,
          });
          return;
        }
        setActionFeedback({
          type: 'info',
          text: 'Não foi possível salvar a resposta no SQLite local neste momento.',
        });
      }
    },
    [
      inspection,
      isReadOnlyInspection,
      user?.id,
      user?.role,
      focusedItemId,
      reloadLocal,
      nonConformitiesByItemId,
      openNonConformityModal,
    ]
  );

  const groupedSections = useMemo(() => {
    const bySection = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const list = bySection.get(item.section_id) ?? [];
      list.push(item);
      bySection.set(item.section_id, list);
    }

    if (sections.length === 0 && items.length > 0) {
      return [
        {
          section: {
            id: 'default-section',
            inspection_id: inspection?.id ?? '',
            title: 'Itens do Checklist',
            order_index: 0,
          } as ChecklistSection,
          sectionItems: items,
        },
      ];
    }

    return sections.map((sec) => ({
      section: sec,
      sectionItems: bySection.get(sec.id) ?? [],
    }));
  }, [sections, items, inspection?.id]);

  const handleOpenSummary = useCallback(() => {
    if (!inspection) return;
    router.push({
      pathname: '/(protected)/inspections/[inspectionId]/summary',
      params: { inspectionId: inspection.id },
    });
  }, [inspection, router]);

  const handleOpenEvidenceCapture = useCallback(
    (item: ChecklistItem, isNonConformity = false) => {
      if (!inspection) return;
      if (isReadOnlyInspection) {
        setActionFeedback({
          type: 'warning',
          text: 'Edição bloqueada: fotos de inspeções concluídas ou aprovadas são somente leitura.',
        });
        return;
      }
      router.push({
        pathname: '/(protected)/evidence/capture',
        params: {
          inspectionId: inspection.id,
          itemId: item.id,
          itemTitle: item.title,
          isNonConformity: isNonConformity ? 'true' : 'false',
        },
      });
    },
    [inspection, isReadOnlyInspection, router]
  );

  const handleDeleteEvidence = useCallback(
    async (evidence: EvidenceRecord) => {
      if (!inspection) return;
      setDeletingEvidenceId(evidence.id);
      try {
        const result = await deleteEvidencePhoto({
          inspectionId: inspection.id,
          evidenceId: evidence.id,
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        });
        if (!result.success) {
          setActionFeedback({
            type: 'warning',
            text: result.message,
          });
          return;
        }
        await reloadLocal();
        await loadRichEvidences();
        setActionFeedback({
          type: 'info',
          text: result.message,
        });
      } finally {
        setDeletingEvidenceId(null);
      }
    },
    [inspection, user?.id, user?.role, reloadLocal, loadRichEvidences]
  );

  const handleSelectPendingItem = useCallback((pendingItem: PendingInspectionItem) => {
    setPendingModalVisible(false);
    setIsChecklistInteractive(true);
    setFocusedItemId(pendingItem.itemId);
    setActionFeedback({
      type: 'warning',
      text: `Item pendente selecionado: ${pendingItem.title}. Preencha o campo destacado abaixo.`,
    });
  }, []);

  const handlePrimaryAction = useCallback(async () => {
    if (!inspection) return;

    if (action.type === 'START') {
      if (inspection.equipment_qr_code && !isQrVerified) {
        router.push({
          pathname: '/(protected)/scanner',
          params: { inspectionId: inspection.id },
        });
        return;
      }

      setIsUpdatingAction(true);
      setActionFeedback(null);
      try {
        const result = await startInspection({
          inspectionId: inspection.id,
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        });

        if (!result.success) {
          setActionFeedback({
            type: 'warning',
            text: result.message,
          });
          return;
        }

        await reloadLocal();
        await loadLocations();
        setIsChecklistInteractive(true);
        setActionFeedback({
          type: 'success',
          text: `${result.message} Você já pode responder ao checklist abaixo.`,
        });
      } finally {
        setIsUpdatingAction(false);
      }
      return;
    }

    if (action.type === 'CONTINUE') {
      setIsChecklistInteractive(true);
      setActionFeedback({
        type: 'info',
        text: `Checklist interativo ativo (${progress.answeredItems}/${progress.applicableItems} itens respondidos). As respostas são salvas offline automaticamente.`,
      });
      return;
    }

    handleOpenSummary();
  }, [
    inspection,
    action.type,
    isQrVerified,
    user?.id,
    user?.role,
    progress.answeredItems,
    progress.applicableItems,
    reloadLocal,
    loadLocations,
    handleOpenSummary,
    router,
  ]);

  // EX-01: Tela de Permissão Negada
  if (isForbidden) {
    return (
      <View testID="inspection-forbidden-view" style={styles.centeredState}>
        <View style={styles.forbiddenIconCircle}>
          <MaterialIcons name="lock-outline" size={44} color={tokens.colors.danger} />
        </View>
        <Text style={styles.centeredTitle}>Permissão Negada</Text>
        <Text style={styles.centeredDescription}>
          {permissionDeniedMessage || PERMISSION_DENIED_MESSAGE}
        </Text>
        <Text style={styles.redirectHint}>
          Retornando para a lista de inspeções...
        </Text>
        <View style={styles.centeredBtnWrap}>
          <Button
            testID="inspection-forbidden-back-btn"
            title="Voltar para Minhas Inspeções"
            onPress={() => router.replace('/(protected)/(tabs)/inspections')}
            variant="danger"
          />
        </View>
      </View>
    );
  }

  if (isLoading && !inspection) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.centeredDescription}>
          Carregando detalhes da inspeção no SQLite...
        </Text>
      </View>
    );
  }

  if (notFound || !inspection) {
    return (
      <View testID="inspection-not-found-view" style={styles.centeredState}>
        <MaterialIcons name="find-in-page" size={52} color={tokens.colors.textMuted} />
        <Text style={styles.centeredTitle}>Inspeção Não Encontrada</Text>
        <Text style={styles.centeredDescription}>
          {INSPECTION_NOT_FOUND_MESSAGE}
        </Text>
        <View style={styles.centeredBtnWrap}>
          <Button
            title={isRefreshing ? 'Buscando...' : 'Tentar Atualizar do Servidor'}
            onPress={() => {
              void refresh();
            }}
            isLoading={isRefreshing}
            disabled={isRefreshing}
            variant="primary"
          />
          <Button
            title="Voltar para a Lista"
            onPress={() => router.replace('/(protected)/(tabs)/inspections')}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  const effectiveSyncStatus = isPendingSync
    ? inspection.sync_status && inspection.sync_status !== 'SINCRONIZADO'
      ? inspection.sync_status
      : 'PENDENTE'
    : null;
  const isAwaitingSync = Boolean(
    isReadOnlyInspection &&
      (isPendingSync || (inspection.sync_status && inspection.sync_status !== 'SINCRONIZADO'))
  );
  const activeMapLocation =
    locations.completeLocation?.available
      ? locations.completeLocation
      : locations.startLocation?.available
      ? locations.startLocation
      : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refresh();
            }}
          />
        }
      >
        {/* Banner de estado somente leitura / Aguardando Sincronização (EX-02, CA-03) */}
        {isReadOnlyInspection && (
          <View
            testID="details-awaiting-sync-banner"
            style={[
              styles.readOnlyBanner,
              isAwaitingSync ? styles.readOnlyBannerPending : styles.readOnlyBannerSynced,
            ]}
          >
            <MaterialIcons
              name={isAwaitingSync ? 'cloud-queue' : 'lock'}
              size={18}
              color={isAwaitingSync ? '#92400E' : '#166534'}
            />
            <Text
              style={[
                styles.readOnlyBannerText,
                { color: isAwaitingSync ? '#92400E' : '#166534' },
              ]}
            >
              {isAwaitingSync
                ? `${AWAITING_SYNC_LABEL} • Checklist em modo somente leitura`
                : 'Inspeção concluída • Checklist em modo somente leitura'}
            </Text>
          </View>
        )}

        {/* Faixas de alerta de atraso ou motivo de reprovação/cancelamento */}
        {isOverdue && (
          <View testID="details-overdue-banner" style={styles.overdueBanner}>
            <MaterialIcons name="warning" size={18} color={tokens.colors.textInverse} />
            <Text style={styles.overdueBannerText}>
              Prazo limite ultrapassado • Inspeção em atraso
            </Text>
          </View>
        )}

        {!!inspection.rejection_reason && (
          <Card style={styles.rejectionCard}>
            <View style={styles.rowIconHeader}>
              <MaterialIcons name="error-outline" size={20} color={tokens.colors.danger} />
              <Text style={styles.rejectionTitle}>Observação / Motivo Registrado</Text>
            </View>
            <Text style={styles.rejectionText}>{inspection.rejection_reason}</Text>
          </Card>
        )}

        {actionFeedback && (
          <View
            testID="details-action-feedback"
            style={[
              styles.feedbackBanner,
              actionFeedback.type === 'success'
                ? styles.feedbackSuccess
                : actionFeedback.type === 'warning'
                ? styles.feedbackWarning
                : styles.feedbackInfo,
            ]}
          >
            <MaterialIcons
              name={
                actionFeedback.type === 'success'
                  ? 'check-circle'
                  : actionFeedback.type === 'warning'
                  ? 'warning'
                  : 'info-outline'
              }
              size={18}
              color={
                actionFeedback.type === 'success'
                  ? tokens.colors.success
                  : actionFeedback.type === 'warning'
                  ? '#B45309'
                  : tokens.colors.primary
              }
            />
            <Text style={styles.feedbackText}>{actionFeedback.text}</Text>
          </View>
        )}

        {/* Cabeçalho principal */}
        <Card style={styles.sectionCard}>
          <Text style={styles.clientOverline}>CLIENTE</Text>
          <Text testID="details-client-name" style={styles.clientName}>
            {inspection.client_name || inspection.client}
          </Text>
          {!!inspection.title && (
            <Text testID="details-title" style={styles.inspectionTitle}>
              {inspection.title}
            </Text>
          )}

          <View style={styles.badgesRow}>
            <StatusBadge status={inspection.status as InspectionStatus} />
            <PriorityBadge priority={inspection.priority} />
            {effectiveSyncStatus && (
              <SyncStatusBadge syncStatus={effectiveSyncStatus} />
            )}
          </View>
        </Card>

        {/* Equipamento e QR Code previsto (RF-05) */}
        <Card testID="details-equipment-card" style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="build" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Equipamento</Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Nome do Equipamento</Text>
            <Text testID="details-equipment-name" style={styles.fieldValue}>
              {equipment?.name || 'Não especificado'}
            </Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Código</Text>
            <Text testID="details-equipment-code" style={styles.fieldValue}>
              {equipment?.code || 'Não informado'}
            </Text>
          </View>

          <View style={styles.qrBox}>
            <MaterialIcons name="qr-code-2" size={28} color={tokens.colors.primary} />
            <View style={styles.qrTextContainer}>
              <Text style={styles.qrLabel}>QR CODE PREVISTO</Text>
              <Text testID="details-equipment-qrcode" style={styles.qrValue}>
                {equipment?.qrCode || 'Não cadastrado'}
              </Text>
            </View>
          </View>

          {isQrVerified && (
            <View
              testID="details-qr-verified-badge"
              style={[
                styles.verifiedPill,
                verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                params.divergenceJustified === 'true'
                  ? styles.verifiedPillWarning
                  : styles.verifiedPillSuccess,
              ]}
            >
              <MaterialIcons
                name="verified"
                size={16}
                color={
                  verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                  params.divergenceJustified === 'true'
                    ? '#92400E'
                    : '#166534'
                }
              />
              <Text
                style={[
                  styles.verifiedPillText,
                  verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                  params.divergenceJustified === 'true'
                    ? styles.verifiedPillTextWarning
                    : styles.verifiedPillTextSuccess,
                ]}
              >
                {verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                params.divergenceJustified === 'true'
                  ? 'Divergência justificada • equipamento liberado'
                  : `Equipamento validado em campo${
                      verificationRecord?.scannedCode || params.scannedCode
                        ? ` (${verificationRecord?.scannedCode || params.scannedCode})`
                        : ''
                    }`}
              </Text>
            </View>
          )}

          {isEditableInspection && (
            <Button
              testID="details-scan-qr-button"
              title={
                isQrVerified
                  ? 'Revalidar QR Code do Equipamento'
                  : 'Validar Equipamento (QR Code)'
              }
              variant={isQrVerified ? 'secondary' : 'primary'}
              onPress={() =>
                router.push({
                  pathname: '/(protected)/scanner',
                  params: { inspectionId: inspection.id },
                })
              }
              style={styles.scanQrButton}
            />
          )}
        </Card>

        {/* Localização e Endereço Completo (RF-05) */}
        <Card testID="details-site-card" style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Local e Endereço</Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Unidade / Local</Text>
            <Text testID="details-site-name" style={styles.fieldValue}>
              {site?.name || 'Local não informado'}
            </Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Endereço Completo</Text>
            <Text testID="details-site-address" style={styles.fieldValueMuted}>
              {site?.address || site?.fullAddress || 'Endereço não cadastrado'}
            </Text>
          </View>

          {(locations.startLocation || locations.completeLocation) && (
            <View testID="details-gps-box" style={styles.gpsBox}>
              <Text style={styles.gpsBoxTitle}>Coordenadas GPS Registradas</Text>
              {locations.startLocation && (
                <Text style={styles.gpsCoordLine}>
                  Início:{' '}
                  {locations.startLocation.available
                    ? formatCoordinatesSummary(
                        locations.startLocation.latitude,
                        locations.startLocation.longitude,
                        locations.startLocation.accuracy
                      )
                    : locations.startLocation.fallback_reason || 'Indisponível'}
                </Text>
              )}
              {locations.completeLocation && (
                <Text style={styles.gpsCoordLine}>
                  Conclusão:{' '}
                  {locations.completeLocation.available
                    ? formatCoordinatesSummary(
                        locations.completeLocation.latitude,
                        locations.completeLocation.longitude,
                        locations.completeLocation.accuracy
                      )
                    : locations.completeLocation.fallback_reason || 'Indisponível'}
                </Text>
              )}
              {activeMapLocation && (
                <View style={styles.gpsMapWrap}>
                  <OsmLeafletMap
                    testID="details-osm-map"
                    latitude={activeMapLocation.latitude}
                    longitude={activeMapLocation.longitude}
                    accuracy={activeMapLocation.accuracy}
                    title={
                      locations.completeLocation?.available
                        ? 'Local da Conclusão'
                        : 'Local do Início'
                    }
                    subtitle={site?.name || inspection.site_name}
                    height={180}
                  />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Prazos e Instruções de Campo */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="event-note" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Prazos e Instruções</Text>
          </View>

          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Data prevista:</Text>
            <Text
              style={[
                styles.timelineValue,
                isOverdue && { color: tokens.colors.danger },
              ]}
            >
              {formatDateTime(inspection.due_date)}
            </Text>
          </View>

          {!!inspection.started_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Iniciada em:</Text>
              <Text style={styles.timelineValue}>
                {formatDateTime(inspection.started_at)}
              </Text>
            </View>
          )}

          {!!inspection.completed_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Concluída em:</Text>
              <Text style={styles.timelineValue}>
                {formatDateTime(inspection.completed_at)}
              </Text>
            </View>
          )}

          {!!inspection.technician_name && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Técnico:</Text>
              <Text style={styles.timelineValue}>{inspection.technician_name}</Text>
            </View>
          )}

          {!!inspection.instructions && (
            <View style={styles.instructionsBox}>
              <Text style={styles.fieldLabel}>Instruções da Ordem</Text>
              <Text style={styles.instructionsText}>{inspection.instructions}</Text>
            </View>
          )}
        </Card>

        {/* Resumo de Progresso e Itens do Checklist Offline */}
        <Card testID="details-checklist-card" style={styles.sectionCard}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="fact-check" size={20} color={tokens.colors.primary} />
              <Text style={styles.cardTitle}>Progresso do Checklist</Text>
            </View>
            <Text style={styles.progressPercent}>{progress.percentage}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` },
              ]}
            />
          </View>

          <View style={styles.progressStatsGrid}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>
                {progress.answeredItems}/{progress.applicableItems}
              </Text>
              <Text style={styles.statLabel}>Respondidos</Text>
            </View>
            <View style={styles.statChip}>
              <Text
                style={[
                  styles.statValue,
                  progress.pendingRequiredCount > 0 && { color: tokens.colors.danger },
                ]}
              >
                {progress.pendingRequiredCount}
              </Text>
              <Text style={styles.statLabel}>Obrig. pendentes</Text>
            </View>
            <View style={styles.statChip}>
              <Text
                style={[
                  styles.statValue,
                  progress.nonConformitiesCount > 0 && { color: tokens.colors.danger },
                ]}
              >
                {progress.nonConformitiesCount}
              </Text>
              <Text style={styles.statLabel}>Não conf.</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{progress.evidencesCount}</Text>
              <Text style={styles.statLabel}>Evidências</Text>
            </View>
          </View>

          {isEditableInspection && progress.pendingRequiredCount > 0 && (
            <TouchableOpacity
              testID="details-pending-items-trigger"
              style={styles.pendingShortcutBanner}
              onPress={() => setPendingModalVisible(true)}
            >
              <MaterialIcons name="assignment-late" size={18} color="#92400E" />
              <Text style={styles.pendingShortcutText}>
                {progress.pendingRequiredCount === 1
                  ? '1 item obrigatório pendente — tocar para localizar'
                  : `${progress.pendingRequiredCount} itens obrigatórios pendentes — tocar para localizar`}
              </Text>
              <MaterialIcons name="chevron-right" size={18} color="#92400E" />
            </TouchableOpacity>
          )}

          {groupedSections.length === 0 ? (
            <Text style={styles.noItemsText}>
              Nenhum item de snapshot encontrado localmente para esta inspeção.
            </Text>
          ) : (
            groupedSections.map(({ section, sectionItems }) => (
              <View key={section.id} style={styles.checklistSectionBlock}>
                <Text style={styles.checklistSectionTitle}>
                  {section.title} ({sectionItems.length})
                </Text>
                {sectionItems.map((item) => {
                  const isAnswered = respondedItemIds.has(item.id);
                  const currentResponse = responseByItemId.get(item.id);
                  const itemEvidences = evidencesByItemId.get(item.id) ?? [];
                  const itemNonConformities = nonConformitiesByItemId.get(item.id) ?? [];
                  const isNcItem =
                    Boolean(currentResponse?.is_non_conformity) ||
                    currentResponse?.value === 'NON_CONFORMING' ||
                    currentResponse?.value === 'NAO_CONFORME';
                  const isFocused = focusedItemId === item.id;
                  const showItemRenderer =
                    (isChecklistInteractive && isEditableInspection) || isReadOnlyInspection;
                  return (
                    <View
                      key={item.id}
                      testID={`checklist-item-block-${item.id}`}
                      style={[
                        styles.checklistItemBlock,
                        isFocused && styles.checklistItemFocused,
                      ]}
                    >
                      <View style={styles.checklistItemRow}>
                        <MaterialIcons
                          name={
                            isAnswered
                              ? 'check-circle'
                              : 'radio-button-unchecked'
                          }
                          size={16}
                          color={
                            isAnswered
                              ? tokens.colors.success
                              : tokens.colors.textMuted
                          }
                        />
                        <View style={styles.checklistItemTextWrap}>
                          <Text style={styles.checklistItemTitle}>
                            {item.title}
                            {Boolean(item.required) ? ' *' : ''}
                          </Text>
                          <Text style={styles.checklistItemMeta}>
                            {formatResponseTypeLabel(item.response_type)}
                            {isFocused ? ' • Preenchimento obrigatório pendente' : ''}
                          </Text>
                        </View>
                      </View>

                      {showItemRenderer && (
                        <View style={styles.interactiveInputWrap}>
                          <DynamicItemRenderer
                            testID={`checklist-item-input-${item.id}`}
                            item={item}
                            value={parseStoredResponseValue(item, currentResponse?.value)}
                            nonConformityDescription={
                              currentResponse?.non_conformity_description ?? ''
                            }
                            disabled={isReadOnlyInspection}
                            onCapturePhoto={
                              !isReadOnlyInspection
                                ? (isNc) => handleOpenEvidenceCapture(item, isNc)
                                : undefined
                            }
                            onChange={(val) =>
                              void handleSaveChecklistAnswer(
                                item,
                                val,
                                currentResponse?.non_conformity_description ?? undefined,
                                val === 'NON_CONFORMING' || val === 'NAO_CONFORME'
                              )
                            }
                            onNonConformityDescriptionChange={(desc) =>
                              void handleSaveChecklistAnswer(
                                item,
                                currentResponse?.value ?? 'NON_CONFORMING',
                                desc,
                                false
                              )
                            }
                          />

                          {(isNcItem || itemNonConformities.length > 0) && (
                            <TouchableOpacity
                              testID={`checklist-item-nc-btn-${item.id}`}
                              style={styles.itemNcActionBtn}
                              activeOpacity={0.8}
                              onPress={() =>
                                openNonConformityModal(
                                  item,
                                  itemNonConformities[0] ?? null,
                                  currentResponse?.non_conformity_description
                                )
                              }
                              accessibilityRole="button"
                            >
                              <MaterialIcons
                                name="report-problem"
                                size={16}
                                color={tokens.colors.danger}
                              />
                              <Text style={styles.itemNcActionText}>
                                {itemNonConformities.length > 0
                                  ? isReadOnlyInspection
                                    ? `Consultar Não Conformidade (${NON_CONFORMITY_SEVERITY_META[itemNonConformities[0].severity].label})`
                                    : `Editar Não Conformidade (${NON_CONFORMITY_SEVERITY_META[itemNonConformities[0].severity].label})`
                                  : 'Classificar e Registrar Não Conformidade'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {!isReadOnlyInspection && (
                            <TouchableOpacity
                              testID={`checklist-capture-photo-btn-${item.id}`}
                              style={styles.capturePhotoBtn}
                              activeOpacity={0.8}
                              onPress={() => handleOpenEvidenceCapture(item, isNcItem)}
                              accessibilityRole="button"
                              accessibilityLabel={`Capturar foto para ${item.title}`}
                            >
                              <MaterialIcons
                                name="add-a-photo"
                                size={18}
                                color={tokens.colors.primary}
                              />
                              <Text style={styles.capturePhotoBtnText}>
                                Capturar Foto de Evidência
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {itemEvidences.length > 0 && (
                        <View style={styles.itemGalleryWrap}>
                          <EvidenceGallery
                            testID={`checklist-item-evidences-${item.id}`}
                            evidences={itemEvidences}
                            readOnly={isReadOnlyInspection}
                            hideWhenEmpty
                            title="Fotos Anexadas"
                            deletingId={deletingEvidenceId}
                            onDeleteEvidence={(ev) => void handleDeleteEvidence(ev)}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </Card>

        {/* Seção de Não Conformidades da Inspeção (TASK-017) */}
        {(isEditableInspection || nonConformities.length > 0) && (
          <Card testID="details-nonconformities-card" style={styles.sectionCard}>
            <View style={styles.cardHeaderBetween}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="report-problem" size={20} color={tokens.colors.danger} />
                <Text style={styles.cardTitle}>
                  Não Conformidades ({nonConformities.length})
                </Text>
              </View>
              <TouchableOpacity
                testID="details-view-nonconformities-btn"
                style={styles.ncViewAllChip}
                onPress={() =>
                  router.push({
                    pathname: '/(protected)/inspections/[inspectionId]/non-conformities',
                    params: { inspectionId: inspection.id },
                  })
                }
                accessibilityRole="button"
              >
                <Text style={styles.ncViewAllChipText}>Agrupar por Gravidade</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={16}
                  color={tokens.colors.primary}
                />
              </TouchableOpacity>
            </View>

            {nonConformities.length === 0 ? (
              <Text style={styles.noItemsText}>
                Nenhuma não conformidade registrada formalmente até o momento.
              </Text>
            ) : (
              <View style={styles.ncSummaryList}>
                {nonConformities.map((nc) => {
                  const sevMeta = NON_CONFORMITY_SEVERITY_META[nc.severity];
                  return (
                    <TouchableOpacity
                      key={nc.id}
                      testID={`details-nc-row-${nc.id}`}
                      style={[
                        styles.ncSummaryRow,
                        { borderLeftColor: sevMeta.accentColor },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => openNonConformityModal(null, nc)}
                    >
                      <View style={styles.ncSummaryHeader}>
                        <Text style={styles.ncSummaryTitle} numberOfLines={1}>
                          {nc.title}
                        </Text>
                        <View
                          style={[
                            styles.ncSeverityBadge,
                            {
                              backgroundColor: sevMeta.badgeBg,
                              borderColor: sevMeta.badgeBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.ncSeverityBadgeText,
                              { color: sevMeta.badgeText },
                            ]}
                          >
                            {sevMeta.label.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {!!nc.item_title && (
                        <Text style={styles.ncSummaryMeta} numberOfLines={1}>
                          Item: {nc.item_title}
                        </Text>
                      )}
                      {!!nc.description && (
                        <Text style={styles.ncSummaryDesc} numberOfLines={2}>
                          {nc.description}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {isEditableInspection && (
              <Button
                testID="details-add-nc-button"
                title="Registrar Não Conformidade"
                variant="secondary"
                onPress={() => openNonConformityModal(null, null)}
                style={styles.addNcFooterBtn}
              />
            )}
          </Card>
        )}
      </ScrollView>

      {/* Rodapé fixo com botão de ação dinâmico e acesso ao resumo pré-conclusão */}
      <View style={styles.footerBar}>
        <Button
          testID="inspection-action-button"
          title={action.label}
          variant={action.variant}
          isLoading={isUpdatingAction}
          disabled={isUpdatingAction || action.disabled}
          onPress={handlePrimaryAction}
          accessibilityLabel={action.label}
        />
        {(action.type === 'CONTINUE' || isReadOnlyInspection) && (
          <Button
            testID="details-go-to-summary-button"
            title={
              isReadOnlyInspection
                ? 'Ver Resumo e Mapa'
                : 'Revisar e Concluir Inspeção'
            }
            variant={isReadOnlyInspection ? 'secondary' : 'primary'}
            onPress={handleOpenSummary}
            style={styles.summaryFooterBtn}
          />
        )}
      </View>

      <PendingItemsModal
        visible={pendingModalVisible}
        pendingItems={progress.pendingRequiredItems}
        onClose={() => setPendingModalVisible(false)}
        onSelectItem={handleSelectPendingItem}
      />

      <NonConformityFormModal
        visible={ncModalVisible}
        inspectionId={inspection.id}
        itemId={ncTargetItem?.id ?? ncDraftItemId ?? ncEditingRecord?.item_id ?? null}
        itemTitle={
          ncTargetItem?.title ?? ncDraftItemTitle ?? ncEditingRecord?.item_title ?? null
        }
        initialNonConformity={ncEditingRecord}
        initialTitle={ncDraftTitle}
        initialDescription={ncDraftDescription}
        initialSeverity={ncDraftSeverity}
        initialEvidenceUris={ncDraftEvidenceUris}
        initialEvidenceIds={ncDraftEvidenceIds}
        preferDraftValues={ncPreferDraftValues}
        readOnly={isReadOnlyInspection}
        isSaving={isSavingNc}
        isDeleting={isDeletingNc}
        errorMessage={ncModalError}
        onClose={() => {
          useNonConformityDraftStore.getState().clearDraft(inspection.id);
          setNcModalVisible(false);
          setNcPreferDraftValues(false);
          setNcModalError(null);
        }}
        onSubmit={handleSaveNonConformity}
        onDeleteOrCancel={handleDeleteOrCancelNonConformity}
        onAttachPhoto={handleAttachPhotoFromNcModal}
      />

      {/* Snackbar discreto em falha de refresh (EX-02, RT-03) */}
      {snackbar?.visible && (
        <View
          testID="details-offline-snackbar"
          style={styles.snackbar}
          accessibilityRole="alert"
        >
          <MaterialIcons name="cloud-off" size={18} color={tokens.colors.textInverse} />
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
          <TouchableOpacity onPress={dismissSnackbar} accessibilityLabel="Fechar aviso">
            <Text style={styles.snackbarAction}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxl + 24,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.background,
    gap: tokens.spacing.s,
  },
  forbiddenIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8d7da',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.s,
  },
  centeredTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    textAlign: 'center',
  },
  centeredDescription: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  redirectHint: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.danger,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  centeredBtnWrap: {
    width: '100%',
    maxWidth: 320,
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.m,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.s + 2,
    paddingHorizontal: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    marginBottom: tokens.spacing.m,
  },
  overdueBannerText: {
    flex: 1,
    color: tokens.colors.textInverse,
    fontWeight: tokens.typography.fontWeights.bold,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
  rejectionCard: {
    backgroundColor: '#fff5f5',
    borderColor: tokens.colors.danger,
    marginBottom: tokens.spacing.m,
  },
  rowIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  rejectionTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.danger,
  },
  rejectionText: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    marginBottom: tokens.spacing.m,
  },
  feedbackSuccess: {
    backgroundColor: '#e6f4ea',
    borderColor: '#b7ebc6',
  },
  feedbackInfo: {
    backgroundColor: '#e7f1ff',
    borderColor: '#b6d4fe',
  },
  feedbackText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: tokens.spacing.m,
  },
  clientOverline: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: 2,
  },
  inspectionTitle: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  detailField: {
    marginBottom: tokens.spacing.s,
  },
  fieldLabel: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  fieldValueMuted: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s + 4,
    backgroundColor: '#f0f6ff',
    borderWidth: 1,
    borderColor: '#cfe2ff',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 4,
    marginTop: tokens.spacing.xs,
  },
  qrTextContainer: {
    flex: 1,
  },
  qrLabel: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
  },
  qrValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs + 1,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    gap: tokens.spacing.s,
  },
  timelineLabel: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
  },
  timelineValue: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
    textAlign: 'right',
    flex: 1,
  },
  instructionsBox: {
    marginTop: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  instructionsText: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  progressPercent: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.s,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.borderRadius.round,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    marginBottom: tokens.spacing.m,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.round,
  },
  progressStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.m,
  },
  statChip: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  statLabel: {
    fontSize: tokens.typography.fontSizes.small - 2,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  noItemsText: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  checklistSectionBlock: {
    marginTop: tokens.spacing.s,
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.xs,
  },
  checklistSectionTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: 2,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.xs + 2,
    paddingVertical: 4,
  },
  checklistItemTextWrap: {
    flex: 1,
  },
  checklistItemTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
  },
  checklistItemMeta: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
  },
  checklistItemBlock: {
    gap: tokens.spacing.xs,
  },
  interactiveInputWrap: {
    paddingLeft: tokens.spacing.m,
    paddingBottom: tokens.spacing.s,
  },
  capturePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    borderStyle: 'dashed',
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: '#EFF6FF',
    paddingVertical: tokens.spacing.s + 2,
    paddingHorizontal: tokens.spacing.m,
    marginTop: -tokens.spacing.xs,
  },
  capturePhotoBtnText: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
  },
  itemGalleryWrap: {
    paddingLeft: tokens.spacing.m,
    paddingBottom: tokens.spacing.s,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.s,
    marginTop: tokens.spacing.s,
  },
  verifiedPillSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  verifiedPillWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  verifiedPillText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  verifiedPillTextSuccess: {
    color: '#166534',
  },
  verifiedPillTextWarning: {
    color: '#92400E',
  },
  scanQrButton: {
    marginTop: tokens.spacing.s,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    paddingVertical: tokens.spacing.s + 2,
    paddingHorizontal: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    marginBottom: tokens.spacing.m,
  },
  readOnlyBannerPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  readOnlyBannerSynced: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  readOnlyBannerText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  feedbackWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFE69C',
  },
  gpsBox: {
    marginTop: tokens.spacing.s,
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 4,
  },
  gpsBoxTitle: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
  },
  gpsCoordLine: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.text,
  },
  gpsMapWrap: {
    marginTop: tokens.spacing.xs,
  },
  pendingShortcutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  pendingShortcutText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: '#92400E',
  },
  checklistItemFocused: {
    borderWidth: 2,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.xs,
    backgroundColor: '#FFF5F5',
  },
  itemNcActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: '#FEF2F2',
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.m,
    marginBottom: tokens.spacing.s,
  },
  itemNcActionText: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.danger,
  },
  ncSummaryList: {
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  ncSummaryRow: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderLeftWidth: 4,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: '#F8FAFC',
    padding: tokens.spacing.s + 2,
    gap: 4,
  },
  ncSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  ncSummaryTitle: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  ncSeverityBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ncSeverityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ncSummaryMeta: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.primary,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  ncSummaryDesc: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
    lineHeight: 18,
  },
  addNcFooterBtn: {
    marginTop: tokens.spacing.xs,
  },
  ncViewAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: tokens.spacing.s,
  },
  ncViewAllChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  summaryFooterBtn: {
    marginTop: tokens.spacing.s,
  },
  footerBar: {
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  snackbar: {
    position: 'absolute',
    left: tokens.spacing.m,
    right: tokens.spacing.m,
    bottom: 92,
    backgroundColor: '#212529',
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: tokens.spacing.s + 4,
    paddingHorizontal: tokens.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  snackbarText: {
    flex: 1,
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
  snackbarAction: {
    color: '#90caf9',
    fontWeight: tokens.typography.fontWeights.bold,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
});
