import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { tokens } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/context/AuthContext';
import { resolveRenderableEvidenceUri } from '@/features/evidence';
import {
  INSPECTION_NOT_FOUND_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  isInspectionReadOnly,
  useInspectionDetails,
  type UseInspectionDetailsOptions,
} from '@/features/inspections';
import {
  NON_CONFORMITY_SEVERITIES,
  NON_CONFORMITY_SEVERITY_META,
  NonConformityFormModal,
  NonConformityRepository,
  READ_ONLY_NON_CONFORMITY_MESSAGE,
  nonConformityRepository as defaultNonConformityRepo,
  requiresCompulsoryEvidenceAndDescription,
  useNonConformityDraftStore,
  type NonConformity,
  type NonConformityCounts,
  type NonConformityDraftSnapshot,
  type NonConformityFormSubmitPayload,
  type NonConformitySeverity,
  type NonConformitySeverityGroup,
} from '@/features/nonconformity';

export interface NonConformitiesScreenProps {
  inspectionId?: string;
  detailsOptions?: UseInspectionDetailsOptions;
  initialGroups?: NonConformitySeverityGroup[];
  initialCounts?: NonConformityCounts;
  initialFilterSeverity?: NonConformitySeverity | 'TODAS';
  repository?: NonConformityRepository;
}

const SEVERITY_DISPLAY_ORDER: readonly NonConformitySeverity[] = [
  'CRITICA',
  'ALTA',
  'MEDIA',
  'BAIXA',
];

const EMPTY_COUNTS: NonConformityCounts = {
  total: 0,
  open: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  pendingSync: 0,
};

function dedupeStrings(values: Array<string | null | undefined>): string[] {
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

function formatShortDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getBusinessStatusLabel(status: NonConformity['status']): {
  label: string;
  bg: string;
  color: string;
} {
  switch (status) {
    case 'RESOLVED':
      return { label: 'Resolvida', bg: '#DCFCE7', color: '#166534' };
    case 'CANCELED':
      return { label: 'Cancelada (Auditoria)', bg: '#E2E8F0', color: '#475569' };
    case 'OPEN':
    default:
      return { label: 'Aberta', bg: '#FEF3C7', color: '#92400E' };
  }
}

export default function NonConformitiesScreen(props: NonConformitiesScreenProps) {
  const {
    inspectionId: propInspectionId,
    detailsOptions,
    initialGroups,
    initialCounts,
    initialFilterSeverity = 'TODAS',
    repository = defaultNonConformityRepo,
  } = props ?? {};

  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    inspectionId?: string;
    id?: string;
    restoreNcModal?: string;
    evidenceSaved?: string;
    capturedEvidenceId?: string;
    capturedEvidenceUri?: string;
  }>();

  const resolvedId = useMemo(() => {
    const raw = propInspectionId ?? params.inspectionId ?? params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [propInspectionId, params.inspectionId, params.id]);

  const {
    inspection,
    isLoading: isInspectionLoading,
    isRefreshing,
    isForbidden,
    permissionDeniedMessage,
    notFound,
    action,
    reloadLocal,
    refresh,
  } = useInspectionDetails(resolvedId, detailsOptions);

  const [groups, setGroups] = useState<NonConformitySeverityGroup[]>(
    () => initialGroups ?? []
  );
  const [counts, setCounts] = useState<NonConformityCounts>(
    () => initialCounts ?? EMPTY_COUNTS
  );
  const [isLoadingList, setIsLoadingList] = useState(!initialGroups);
  const [selectedSeverity, setSelectedSeverity] = useState<NonConformitySeverity | 'TODAS'>(
    initialFilterSeverity
  );
  const [includeCanceled, setIncludeCanceled] = useState(false);

  const [ncModalVisible, setNcModalVisible] = useState(false);
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
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  const isFirstFocusRef = useRef(true);

  const loadGroupedOccurrences = useCallback(async () => {
    if (!resolvedId || initialGroups) {
      setIsLoadingList(false);
      return;
    }

    setIsLoadingList(true);
    try {
      const [groupedResult, countsResult] = await Promise.all([
        repository.findGroupedBySeverity(resolvedId, { includeCanceled }),
        repository.countByInspectionId(resolvedId),
      ]);
      setGroups(groupedResult);
      setCounts(countsResult);
    } catch {
      // Silencioso em SSR/web
    } finally {
      setIsLoadingList(false);
    }
  }, [resolvedId, initialGroups, repository, includeCanceled]);

  useEffect(() => {
    void loadGroupedOccurrences();
  }, [loadGroupedOccurrences]);

  const allItemsFlat = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups]
  );

  const restoreDraftIfPending = useCallback(() => {
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
      pendingDraft.returnRoute !== 'non-conformities' &&
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

    const editingMatch = consumed?.editingNonConformityId
      ? allItemsFlat.find((nc) => nc.id === consumed.editingNonConformityId) ?? null
      : null;

    setNcEditingRecord(editingMatch);
    setNcDraftItemId(consumed?.itemId ?? editingMatch?.item_id ?? null);
    setNcDraftItemTitle(consumed?.itemTitle ?? editingMatch?.item_title ?? null);
    setNcDraftTitle(consumed?.title ?? editingMatch?.title ?? '');
    setNcDraftDescription(consumed?.description ?? editingMatch?.description ?? '');
    setNcDraftSeverity(consumed?.severity ?? editingMatch?.severity ?? 'MEDIA');
    setNcDraftEvidenceUris(
      dedupeStrings([
        ...(consumed?.evidenceUris ?? editingMatch?.evidence_uris ?? []),
        capturedUri,
      ])
    );
    setNcDraftEvidenceIds(
      dedupeStrings([
        ...(consumed?.evidenceIds ?? editingMatch?.evidence_ids ?? []),
        capturedId,
      ])
    );
    setNcPreferDraftValues(true);
    setNcModalError(null);
    setNcModalVisible(true);

    if (params.evidenceSaved === 'true') {
      setFeedback({
        type: 'success',
        text: 'Fotografia capturada e anexada ao apontamento de não conformidade.',
      });
    }
  }, [
    inspection?.id,
    resolvedId,
    params.restoreNcModal,
    params.evidenceSaved,
    params.capturedEvidenceUri,
    params.capturedEvidenceId,
    allItemsFlat,
  ]);

  useEffect(() => {
    restoreDraftIfPending();
  }, [restoreDraftIfPending]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      reloadLocal();
      void loadGroupedOccurrences();
      restoreDraftIfPending();
    }, [reloadLocal, loadGroupedOccurrences, restoreDraftIfPending])
  );

  const isReadOnlyInspection = Boolean(
    inspection && (isInspectionReadOnly(inspection.status) || action.isReadOnly)
  );

  const filteredGroups = useMemo(() => {
    const ordered = [...groups].sort((a, b) => {
      return (
        SEVERITY_DISPLAY_ORDER.indexOf(a.severity) -
        SEVERITY_DISPLAY_ORDER.indexOf(b.severity)
      );
    });
    if (selectedSeverity === 'TODAS') {
      return ordered;
    }
    return ordered.filter((group) => group.severity === selectedSeverity);
  }, [groups, selectedSeverity]);

  const openNewModal = useCallback(() => {
    if (!inspection || isReadOnlyInspection) return;
    setNcEditingRecord(null);
    setNcDraftItemId(null);
    setNcDraftItemTitle(null);
    setNcDraftTitle('');
    setNcDraftDescription('');
    setNcDraftSeverity(
      selectedSeverity !== 'TODAS' ? selectedSeverity : 'MEDIA'
    );
    setNcDraftEvidenceUris([]);
    setNcDraftEvidenceIds([]);
    setNcPreferDraftValues(false);
    setNcModalError(null);
    setNcModalVisible(true);
  }, [inspection, isReadOnlyInspection, selectedSeverity]);

  const openEditModal = useCallback((nc: NonConformity) => {
    setNcEditingRecord(nc);
    setNcDraftItemId(nc.item_id ?? null);
    setNcDraftItemTitle(nc.item_title ?? null);
    setNcDraftTitle(nc.title);
    setNcDraftDescription(nc.description);
    setNcDraftSeverity(nc.severity);
    setNcDraftEvidenceUris(nc.evidence_uris ?? []);
    setNcDraftEvidenceIds(nc.evidence_ids ?? []);
    setNcPreferDraftValues(false);
    setNcModalError(null);
    setNcModalVisible(true);
  }, []);

  const handleSaveNonConformity = useCallback(
    async (payload: NonConformityFormSubmitPayload) => {
      const targetInspectionId = inspection?.id ?? resolvedId;
      if (!targetInspectionId) return;

      setIsSavingNc(true);
      setNcModalError(null);
      try {
        const result = ncEditingRecord
          ? await repository.update(ncEditingRecord.id, {
              ...payload,
              technicianId: user?.id ?? null,
              userRole: user?.role ?? null,
            })
          : await repository.create({
              ...payload,
              inspection_id: targetInspectionId,
              created_by: user?.id ?? null,
              technicianId: user?.id ?? null,
              userRole: user?.role ?? null,
            });

        if (!result.success) {
          setNcModalError(result.message);
          return;
        }

        useNonConformityDraftStore.getState().clearDraft(targetInspectionId);
        await loadGroupedOccurrences();
        await reloadLocal();
        setNcModalVisible(false);
        setNcPreferDraftValues(false);
        setFeedback({
          type: 'success',
          text: result.message,
        });
      } finally {
        setIsSavingNc(false);
      }
    },
    [
      inspection?.id,
      resolvedId,
      ncEditingRecord,
      repository,
      user?.id,
      user?.role,
      loadGroupedOccurrences,
      reloadLocal,
    ]
  );

  const handleDeleteOrCancelNonConformity = useCallback(
    async (nc: NonConformity) => {
      const targetInspectionId = inspection?.id ?? resolvedId;
      if (!targetInspectionId) return;

      setIsDeletingNc(true);
      setNcModalError(null);
      try {
        const result = await repository.deleteOrCancel(nc.id, {
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        });

        if (!result.success) {
          setNcModalError(result.message);
          return;
        }

        useNonConformityDraftStore.getState().clearDraft(targetInspectionId);
        await loadGroupedOccurrences();
        await reloadLocal();
        setNcModalVisible(false);
        setNcPreferDraftValues(false);
        setFeedback({
          type: 'info',
          text: result.message,
        });
      } finally {
        setIsDeletingNc(false);
      }
    },
    [
      inspection?.id,
      resolvedId,
      repository,
      user?.id,
      user?.role,
      loadGroupedOccurrences,
      reloadLocal,
    ]
  );

  const handleAttachPhotoFromNcModal = useCallback(
    (draft: NonConformityDraftSnapshot) => {
      const targetInspectionId = inspection?.id ?? resolvedId;
      if (!targetInspectionId) return;

      useNonConformityDraftStore.getState().saveDraft({
        inspectionId: targetInspectionId,
        editingNonConformityId:
          draft.editingNonConformityId ?? ncEditingRecord?.id ?? null,
        itemId: draft.itemId,
        itemTitle: draft.itemTitle,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        evidenceUris: draft.evidenceUris,
        evidenceIds: draft.evidenceIds,
        returnRoute: 'non-conformities',
      });

      setNcModalVisible(false);
      router.push({
        pathname: '/(protected)/evidence/capture',
        params: {
          inspectionId: targetInspectionId,
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
          returnRoute: 'non-conformities',
        },
      });
    },
    [inspection?.id, resolvedId, ncEditingRecord?.id, router]
  );

  if (isForbidden) {
    return (
      <View testID="nc-list-forbidden-view" style={styles.centeredState}>
        <MaterialIcons name="lock-outline" size={44} color={tokens.colors.danger} />
        <Text style={styles.centeredTitle}>Permissão Negada</Text>
        <Text style={styles.centeredDescription}>
          {permissionDeniedMessage || PERMISSION_DENIED_MESSAGE}
        </Text>
        <Button
          title="Voltar para Inspeções"
          variant="danger"
          onPress={() => router.replace('/(protected)/(tabs)/inspections')}
        />
      </View>
    );
  }

  if ((isInspectionLoading || isLoadingList) && !inspection && groups.length === 0) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.centeredDescription}>
          Carregando não conformidades offline do SQLite...
        </Text>
      </View>
    );
  }

  if (notFound || !inspection) {
    return (
      <View testID="nc-list-not-found-view" style={styles.centeredState}>
        <MaterialIcons name="find-in-page" size={48} color={tokens.colors.textMuted} />
        <Text style={styles.centeredTitle}>Inspeção Não Encontrada</Text>
        <Text style={styles.centeredDescription}>{INSPECTION_NOT_FOUND_MESSAGE}</Text>
        <Button
          title="Voltar para a Lista"
          variant="secondary"
          onPress={() => router.replace('/(protected)/(tabs)/inspections')}
        />
      </View>
    );
  }

  const severityCountsMap: Record<NonConformitySeverity, number> = {
    CRITICA: counts.critical,
    ALTA: counts.high,
    MEDIA: counts.medium,
    BAIXA: counts.low,
  };

  return (
    <View testID="non-conformities-screen" style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refresh();
              void loadGroupedOccurrences();
            }}
          />
        }
      >
        {isReadOnlyInspection && (
          <View testID="nc-list-readonly-banner" style={styles.readOnlyBanner}>
            <MaterialIcons name="lock" size={18} color="#92400E" />
            <Text style={styles.readOnlyBannerText}>
              {READ_ONLY_NON_CONFORMITY_MESSAGE}
            </Text>
          </View>
        )}

        {feedback && (
          <View
            testID="nc-list-feedback-banner"
            style={[
              styles.feedbackBanner,
              feedback.type === 'success'
                ? styles.feedbackSuccess
                : feedback.type === 'warning'
                  ? styles.feedbackWarning
                  : styles.feedbackInfo,
            ]}
          >
            <MaterialIcons
              name={
                feedback.type === 'success'
                  ? 'check-circle'
                  : feedback.type === 'warning'
                    ? 'warning'
                    : 'info-outline'
              }
              size={18}
              color={
                feedback.type === 'success'
                  ? tokens.colors.success
                  : feedback.type === 'warning'
                    ? '#B45309'
                    : tokens.colors.primary
              }
            />
            <Text style={styles.feedbackText}>{feedback.text}</Text>
          </View>
        )}

        {/* Cabeçalho e resumo quantitativo por gravidade */}
        <Card testID="nc-list-summary-card" style={styles.summaryCard}>
          <Text style={styles.overline}>GESTÃO DE NÃO CONFORMIDADES (OFFLINE)</Text>
          <Text style={styles.inspectionClient}>
            {inspection.client_name || inspection.client}
          </Text>
          <Text style={styles.inspectionSubtitle}>
            {inspection.site_name} • {inspection.equipment_name}
          </Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text testID="nc-total-count" style={styles.kpiValue}>
                {counts.total}
              </Text>
              <Text style={styles.kpiLabel}>Total</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text testID="nc-open-count" style={styles.kpiValue}>
                {counts.open}
              </Text>
              <Text style={styles.kpiLabel}>Em Aberto</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text
                testID="nc-critical-high-count"
                style={[
                  styles.kpiValue,
                  counts.critical + counts.high > 0 && { color: tokens.colors.danger },
                ]}
              >
                {counts.critical + counts.high}
              </Text>
              <Text style={styles.kpiLabel}>Crít. / Alta</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{counts.pendingSync}</Text>
              <Text style={styles.kpiLabel}>Pend. Sync</Text>
            </View>
          </View>

          {/* Filtros por Criticidade */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
          >
            <TouchableOpacity
              testID="nc-filter-TODAS"
              style={[
                styles.filterChip,
                selectedSeverity === 'TODAS' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSeverity('TODAS')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeverity === 'TODAS' && styles.filterChipTextActive,
                ]}
              >
                Todas ({counts.total})
              </Text>
            </TouchableOpacity>

            {[...NON_CONFORMITY_SEVERITIES].reverse().map((sevKey) => {
              const meta = NON_CONFORMITY_SEVERITY_META[sevKey];
              const isActive = selectedSeverity === sevKey;
              return (
                <TouchableOpacity
                  key={sevKey}
                  testID={`nc-filter-${sevKey}`}
                  style={[
                    styles.filterChip,
                    isActive && {
                      backgroundColor: meta.badgeBg,
                      borderColor: meta.accentColor,
                    },
                  ]}
                  onPress={() => setSelectedSeverity(sevKey)}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name={meta.icon}
                    size={14}
                    color={isActive ? meta.accentColor : tokens.colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.filterChipText,
                      isActive && { color: meta.badgeText, fontWeight: '700' },
                    ]}
                  >
                    {meta.label} ({severityCountsMap[sevKey]})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            testID="nc-toggle-canceled-btn"
            style={styles.toggleCanceledRow}
            onPress={() => setIncludeCanceled((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: includeCanceled }}
          >
            <MaterialIcons
              name={includeCanceled ? 'check-box' : 'check-box-outline-blank'}
              size={18}
              color={tokens.colors.primary}
            />
            <Text style={styles.toggleCanceledText}>
              Exibir ocorrências canceladas para auditoria
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Lista Agrupada por Nível de Gravidade (Passo 5) */}
        {filteredGroups.length === 0 ? (
          <Card testID="nc-list-empty-card" style={styles.emptyCard}>
            <MaterialIcons
              name="verified-user"
              size={40}
              color={tokens.colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {selectedSeverity === 'TODAS'
                ? 'Nenhuma não conformidade registrada'
                : `Sem ocorrências de gravidade ${NON_CONFORMITY_SEVERITY_META[selectedSeverity].label}`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isReadOnlyInspection
                ? 'Esta inspeção está encerrada em modo somente leitura.'
                : 'Registre desvios técnicos, anomalias ou riscos operacionais vinculados a itens do checklist ou à inspeção geral.'}
            </Text>
            {!isReadOnlyInspection && (
              <Button
                testID="nc-empty-add-btn"
                title="Registrar Primeira Não Conformidade"
                variant="primary"
                onPress={openNewModal}
                style={styles.emptyAddBtn}
              />
            )}
          </Card>
        ) : (
          filteredGroups.map((group) => {
            const groupMeta = group.meta ?? NON_CONFORMITY_SEVERITY_META[group.severity];
            return (
              <View
                key={group.severity}
                testID={`nc-group-${group.severity}`}
                style={styles.severityGroupSection}
              >
                {/* Cabeçalho do Grupo de Gravidade */}
                <View
                  testID={`nc-group-header-${group.severity}`}
                  style={[
                    styles.groupHeader,
                    {
                      backgroundColor: groupMeta.badgeBg,
                      borderColor: groupMeta.badgeBorder,
                      borderLeftColor: groupMeta.accentColor,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.groupIconCircle,
                      { backgroundColor: groupMeta.accentColor },
                    ]}
                  >
                    <MaterialIcons name={groupMeta.icon} size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.groupHeaderText}>
                    <Text style={[styles.groupTitle, { color: groupMeta.badgeText }]}>
                      Gravidade {groupMeta.label.toUpperCase()}
                    </Text>
                    <Text style={styles.groupDescription}>
                      {groupMeta.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.groupCountBadge,
                      { backgroundColor: groupMeta.accentColor },
                    ]}
                  >
                    <Text style={styles.groupCountText}>{group.items.length}</Text>
                  </View>
                </View>

                {/* Cards das Ocorrências dentro do grupo */}
                <View style={styles.groupCardsStack}>
                  {group.items.map((nc) => {
                    const statusBadge = getBusinessStatusLabel(nc.status);
                    const totalPhotos =
                      (nc.evidence_uris?.length ?? 0) ||
                      (nc.evidence_ids?.length ?? 0);
                    const missingStrictPhoto =
                      requiresCompulsoryEvidenceAndDescription(nc.severity) &&
                      totalPhotos === 0;

                    return (
                      <TouchableOpacity
                        key={nc.id}
                        testID={`nc-item-card-${nc.id}`}
                        activeOpacity={0.85}
                        onPress={() => openEditModal(nc)}
                        style={[
                          styles.ncCard,
                          { borderLeftColor: groupMeta.accentColor },
                          nc.status === 'CANCELED' && styles.ncCardCanceled,
                        ]}
                        accessibilityRole="button"
                      >
                        <View style={styles.ncCardTopRow}>
                          <Text style={styles.ncCardTitle} numberOfLines={2}>
                            {nc.title}
                          </Text>
                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: statusBadge.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                { color: statusBadge.color },
                              ]}
                            >
                              {statusBadge.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.ncScopeRow}>
                          <MaterialIcons
                            name={nc.item_id ? 'fact-check' : 'assignment'}
                            size={14}
                            color={tokens.colors.primary}
                          />
                          <Text style={styles.ncScopeText} numberOfLines={1}>
                            {nc.item_id
                              ? `Item: ${nc.item_title || nc.item_id}`
                              : 'Escopo: Inspeção Geral'}
                          </Text>
                        </View>

                        {!!nc.description && (
                          <Text style={styles.ncDescriptionText} numberOfLines={3}>
                            {nc.description}
                          </Text>
                        )}

                        {missingStrictPhoto && (
                          <View style={styles.missingPhotoWarn}>
                            <MaterialIcons
                              name="add-a-photo"
                              size={14}
                              color="#991B1B"
                            />
                            <Text style={styles.missingPhotoWarnText}>
                              Evidência fotográfica obrigatória pendente
                            </Text>
                          </View>
                        )}

                        {nc.evidence_uris && nc.evidence_uris.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.thumbsRow}
                          >
                            {nc.evidence_uris.map((uri, idx) => (
                              <Image
                                key={`${nc.id}-ev-${idx}`}
                                source={{ uri: resolveRenderableEvidenceUri(uri) }}
                                style={styles.thumbImage}
                                resizeMode="cover"
                              />
                            ))}
                          </ScrollView>
                        )}

                        <View style={styles.ncCardFooter}>
                          <View style={styles.ncMetaLeft}>
                            <MaterialIcons
                              name="photo-camera"
                              size={13}
                              color={tokens.colors.textMuted}
                            />
                            <Text style={styles.ncFooterMetaText}>
                              {totalPhotos}{' '}
                              {totalPhotos === 1 ? 'foto' : 'fotos'}
                            </Text>
                            {!!nc.created_at && (
                              <Text style={styles.ncFooterMetaText}>
                                • {formatShortDate(nc.created_at)}
                              </Text>
                            )}
                          </View>

                          <View
                            style={[
                              styles.syncPill,
                              nc.sync_status === 'SINCRONIZADO'
                                ? styles.syncPillOk
                                : styles.syncPillPending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.syncPillText,
                                nc.sync_status === 'SINCRONIZADO'
                                  ? styles.syncPillTextOk
                                  : styles.syncPillTextPending,
                              ]}
                            >
                              {nc.sync_status === 'SINCRONIZADO'
                                ? 'Sincronizada'
                                : 'Pendente Sync'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Rodapé Fixo */}
      <View style={styles.footerBar}>
        {!isReadOnlyInspection && (
          <Button
            testID="nc-list-add-btn"
            title="Registrar Não Conformidade"
            variant="primary"
            onPress={openNewModal}
          />
        )}
        <Button
          testID="nc-list-back-btn"
          title="Voltar aos Detalhes da Inspeção"
          variant="secondary"
          onPress={() =>
            router.replace({
              pathname: '/(protected)/inspections/[inspectionId]',
              params: {
                inspectionId: inspection.id,
                openChecklist: isReadOnlyInspection ? 'false' : 'true',
              },
            })
          }
          style={styles.backBtn}
        />
      </View>

      <NonConformityFormModal
        visible={ncModalVisible}
        inspectionId={inspection.id}
        itemId={ncDraftItemId ?? ncEditingRecord?.item_id ?? null}
        itemTitle={ncDraftItemTitle ?? ncEditingRecord?.item_title ?? null}
        initialNonConformity={ncEditingRecord}
        initialTitle={ncDraftTitle}
        initialDescription={ncDraftDescription}
        initialSeverity={ncDraftSeverity}
        initialEvidenceUris={ncDraftEvidenceUris}
        initialEvidenceIds={ncDraftEvidenceIds}
        preferDraftValues={ncPreferDraftValues}
        readOnly={
          isReadOnlyInspection || ncEditingRecord?.status === 'CANCELED'
        }
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
        onAttachPhoto={
          !isReadOnlyInspection ? handleAttachPhotoFromNcModal : undefined
        }
      />
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
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.m,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.background,
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
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  readOnlyBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 18,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: '#e6f4ea',
    borderColor: '#b7ebc6',
  },
  feedbackWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffe69c',
  },
  feedbackInfo: {
    backgroundColor: '#e7f1ff',
    borderColor: '#b6d4fe',
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    color: tokens.colors.text,
    lineHeight: 19,
  },
  summaryCard: {
    gap: tokens.spacing.s,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  inspectionClient: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  inspectionSubtitle: {
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.xs,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  kpiLabel: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  filterChipsRow: {
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 999,
    backgroundColor: tokens.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  filterChipTextActive: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  toggleCanceledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingTop: 2,
  },
  toggleCanceledText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.xl,
    gap: tokens.spacing.s,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  emptyAddBtn: {
    marginTop: tokens.spacing.s,
    width: '100%',
  },
  severityGroupSection: {
    gap: tokens.spacing.s,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderLeftWidth: 5,
  },
  groupIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeaderText: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 1,
  },
  groupCountBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  groupCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  groupCardsStack: {
    gap: tokens.spacing.s,
  },
  ncCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderLeftWidth: 4,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.m,
    gap: tokens.spacing.xs + 2,
  },
  ncCardCanceled: {
    opacity: 0.72,
    backgroundColor: '#F8FAFC',
  },
  ncCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  ncCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ncScopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ncScopeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  ncDescriptionText: {
    fontSize: 13,
    color: tokens.colors.textMuted,
    lineHeight: 19,
  },
  missingPhotoWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  missingPhotoWarnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  thumbsRow: {
    gap: tokens.spacing.xs,
    paddingVertical: 2,
  },
  thumbImage: {
    width: 60,
    height: 60,
    borderRadius: tokens.borderRadius.small,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#0F172A',
  },
  ncCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: tokens.spacing.s,
  },
  ncMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  ncFooterMetaText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  syncPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  syncPillOk: {
    backgroundColor: '#DCFCE7',
  },
  syncPillPending: {
    backgroundColor: '#FEF3C7',
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncPillTextOk: {
    color: '#166534',
  },
  syncPillTextPending: {
    color: '#92400E',
  },
  footerBar: {
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.s,
  },
  backBtn: {
    marginTop: 0,
  },
});
