import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
  OsmLeafletMap,
  formatCoordinatesSummary,
} from '@/features/location/services/locationService';
import {
  EvidenceGallery,
  deleteEvidencePhoto,
  listInspectionEvidences,
  type EvidenceRecord,
} from '@/features/evidence';
import { nonConformityRepository } from '@/features/nonconformity';
import {
  AWAITING_SYNC_LABEL,
  INSPECTION_NOT_FOUND_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  PendingItemsModal,
  PriorityBadge,
  SyncStatusBadge,
  completeInspection,
  getInspectionLocations,
  isInspectionReadOnly,
  useInspectionDetails,
  useInspectionProgress,
  type InspectionLifecycleDependencies,
  type InspectionLocationsResult,
  type PendingInspectionItem,
  type UseInspectionDetailsOptions,
} from '@/features/inspections';

export interface InspectionSummaryScreenProps {
  inspectionId?: string;
  detailsOptions?: UseInspectionDetailsOptions;
  initialLocations?: InspectionLocationsResult;
  initialPendingModalVisible?: boolean;
  lifecycleDependencies?: InspectionLifecycleDependencies;
}

function formatDateTime(isoDate?: string | null): string {
  if (!isoDate) {
    return 'Não registrada';
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

export default function InspectionSummaryScreen(props: InspectionSummaryScreenProps) {
  const {
    inspectionId: propInspectionId,
    detailsOptions,
    initialLocations,
    initialPendingModalVisible = false,
    lifecycleDependencies,
  } = props ?? {};

  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ inspectionId?: string; id?: string }>();
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
    isPendingSync,
    action,
    isLoading,
    isForbidden,
    permissionDeniedMessage,
    notFound,
    reloadLocal,
  } = useInspectionDetails(resolvedId, detailsOptions);

  const [richEvidences, setRichEvidences] = useState<EvidenceRecord[]>([]);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const [formalNcCount, setFormalNcCount] = useState<number>(0);
  const displayedEvidences: EvidenceRecord[] = useMemo(
    () => (richEvidences.length > 0 ? richEvidences : evidences),
    [richEvidences, evidences]
  );

  const progress = useInspectionProgress({
    items,
    responses,
    sections,
    evidences: displayedEvidences,
  });

  const [locations, setLocations] = useState<InspectionLocationsResult>(
    () =>
      initialLocations ?? {
        startLocation: null,
        completeLocation: null,
        records: [],
      }
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const [pendingModalVisible, setPendingModalVisible] = useState(initialPendingModalVisible);
  const [blockedPendingItems, setBlockedPendingItems] = useState<PendingInspectionItem[]>(
    () => progress.pendingRequiredItems
  );
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'info';
    text: string;
  } | null>(null);
  const isFirstFocusRef = useRef(true);

  const loadLocations = useCallback(async () => {
    if (!resolvedId || initialLocations) {
      return;
    }
    try {
      const result = await getInspectionLocations(resolvedId, lifecycleDependencies);
      setLocations(result);
    } catch {
      // Silencioso para não bloquear exibição do resumo
    }
  }, [resolvedId, initialLocations, lifecycleDependencies]);

  const loadRichEvidences = useCallback(async () => {
    if (!resolvedId || detailsOptions?.initialData) {
      return;
    }
    try {
      const list = await listInspectionEvidences(resolvedId);
      setRichEvidences(list);
    } catch {
      // Silencioso em SSR/web
    }
  }, [resolvedId, detailsOptions?.initialData]);

  const loadFormalNcCounts = useCallback(async () => {
    if (!resolvedId || detailsOptions?.initialData) {
      return;
    }
    try {
      const counts = await nonConformityRepository.countByInspectionId(resolvedId);
      setFormalNcCount(counts.total);
    } catch {
      // Silencioso em SSR/web
    }
  }, [resolvedId, detailsOptions?.initialData]);

  useEffect(() => {
    void loadLocations();
    void loadRichEvidences();
    void loadFormalNcCounts();
  }, [loadLocations, loadRichEvidences, loadFormalNcCounts]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void reloadLocal();
      void loadLocations();
      void loadRichEvidences();
      void loadFormalNcCounts();
    }, [reloadLocal, loadLocations, loadRichEvidences, loadFormalNcCounts])
  );

  useEffect(() => {
    setBlockedPendingItems(progress.pendingRequiredItems);
  }, [progress.pendingRequiredItems]);

  const readOnly = Boolean(
    inspection && (isInspectionReadOnly(inspection.status) || action.isReadOnly)
  );
  const effectiveSyncStatus = isPendingSync
    ? inspection?.sync_status && inspection.sync_status !== 'SINCRONIZADO'
      ? inspection.sync_status
      : 'PENDENTE'
    : null;
  const isAwaitingSync = Boolean(
    readOnly && (isPendingSync || (inspection?.sync_status && inspection.sync_status !== 'SINCRONIZADO'))
  );

  const handleGoToItem = useCallback(
    (pendingItem: PendingInspectionItem) => {
      if (!inspection) return;
      setPendingModalVisible(false);
      router.replace({
        pathname: '/(protected)/inspections/[inspectionId]',
        params: {
          inspectionId: inspection.id,
          openChecklist: 'true',
          focusItemId: pendingItem.itemId,
        },
      });
    },
    [inspection, router]
  );

  const handleBackToChecklist = useCallback(() => {
    if (!inspection) return;
    router.replace({
      pathname: '/(protected)/inspections/[inspectionId]',
      params: {
        inspectionId: inspection.id,
        openChecklist: readOnly ? 'false' : 'true',
      },
    });
  }, [inspection, readOnly, router]);

  const handleDeleteSummaryEvidence = useCallback(
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
          setFeedback({ type: 'warning', text: result.message });
          return;
        }
        await reloadLocal();
        await loadRichEvidences();
        setFeedback({ type: 'info', text: result.message });
      } finally {
        setDeletingEvidenceId(null);
      }
    },
    [inspection, user?.id, user?.role, reloadLocal, loadRichEvidences]
  );

  const handleConfirmComplete = useCallback(async () => {
    if (!inspection || isCompleting || readOnly) return;

    setIsCompleting(true);
    setFeedback(null);
    try {
      const result = await completeInspection(
        {
          inspectionId: inspection.id,
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
        },
        lifecycleDependencies
      );

      if (result.blockedByPendingItems) {
        setBlockedPendingItems(result.pendingItems);
        setPendingModalVisible(true);
        setFeedback({
          type: 'warning',
          text: result.message,
        });
        return;
      }

      if (!result.success) {
        setFeedback({
          type: 'warning',
          text: result.message,
        });
        return;
      }

      await reloadLocal();
      const refreshedLocs = await getInspectionLocations(
        inspection.id,
        lifecycleDependencies
      ).catch(() => null);
      if (refreshedLocs) {
        setLocations(refreshedLocs);
      }

      setFeedback({
        type: 'success',
        text: `${result.message} As respostas agora estão bloqueadas em modo somente leitura.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'warning',
        text: err?.message || 'Falha inesperada ao concluir a inspeção.',
      });
    } finally {
      setIsCompleting(false);
    }
  }, [
    inspection,
    isCompleting,
    readOnly,
    user?.id,
    user?.role,
    lifecycleDependencies,
    reloadLocal,
  ]);

  if (isForbidden) {
    return (
      <View testID="summary-forbidden-view" style={styles.centeredState}>
        <MaterialIcons name="lock-outline" size={44} color={tokens.colors.danger} />
        <Text style={styles.centeredTitle}>Permissão Negada</Text>
        <Text style={styles.centeredDescription}>
          {permissionDeniedMessage || PERMISSION_DENIED_MESSAGE}
        </Text>
        <Button
          title="Voltar para Minhas Inspeções"
          variant="danger"
          onPress={() => router.replace('/(protected)/(tabs)/inspections')}
        />
      </View>
    );
  }

  if (isLoading && !inspection) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.centeredDescription}>
          Carregando resumo da inspeção no SQLite...
        </Text>
      </View>
    );
  }

  if (notFound || !inspection) {
    return (
      <View testID="summary-not-found-view" style={styles.centeredState}>
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

  const activeMapLocation =
    locations.completeLocation?.available
      ? locations.completeLocation
      : locations.startLocation?.available
      ? locations.startLocation
      : null;

  return (
    <View testID="inspection-summary-screen" style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Banner de Estado Somente Leitura / Aguardando Sincronização (EX-02 / RF-07) */}
        {readOnly && (
          <View
            testID="summary-awaiting-sync-banner"
            style={[
              styles.syncBanner,
              isAwaitingSync ? styles.syncBannerPending : styles.syncBannerDone,
            ]}
          >
            <MaterialIcons
              name={isAwaitingSync ? 'cloud-queue' : 'lock'}
              size={20}
              color={isAwaitingSync ? '#92400E' : '#166534'}
            />
            <View style={styles.syncBannerTextWrap}>
              <Text
                style={[
                  styles.syncBannerTitle,
                  { color: isAwaitingSync ? '#92400E' : '#166534' },
                ]}
              >
                {isAwaitingSync
                  ? `${AWAITING_SYNC_LABEL} • Somente Leitura`
                  : 'Inspeção Concluída • Somente Leitura'}
              </Text>
              <Text style={styles.syncBannerSubtitle}>
                {isAwaitingSync
                  ? 'A conclusão foi salva localmente e enfileirada na Outbox. As respostas estão bloqueadas até eventual reprovação.'
                  : 'Esta inspeção já foi enviada e sincronizada. Edições estão bloqueadas.'}
              </Text>
            </View>
          </View>
        )}

        {feedback && (
          <View
            testID="summary-feedback-banner"
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

        {/* Cabeçalho da Inspeção */}
        <Card style={styles.card}>
          <Text style={styles.overline}>RESUMO DA INSPEÇÃO</Text>
          <Text style={styles.clientTitle}>
            {inspection.client_name || inspection.client}
          </Text>
          <Text style={styles.siteSubtitle}>
            {inspection.site_name} • {inspection.equipment_name}
          </Text>

          <View style={styles.badgesRow}>
            <StatusBadge status={inspection.status as InspectionStatus} />
            <PriorityBadge priority={inspection.priority} />
            {effectiveSyncStatus && (
              <SyncStatusBadge syncStatus={effectiveSyncStatus} />
            )}
          </View>

          <View style={styles.timestampsBox}>
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Iniciada em:</Text>
              <Text testID="summary-started-at" style={styles.timestampValue}>
                {formatDateTime(inspection.started_at)}
              </Text>
            </View>
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Concluída em:</Text>
              <Text testID="summary-completed-at" style={styles.timestampValue}>
                {formatDateTime(inspection.completed_at)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Contadores de Respostas, Não Conformidades e Evidências (Passo 4) */}
        <Card testID="summary-counters-card" style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="analytics" size={20} color={tokens.colors.primary} />
              <Text style={styles.cardTitle}>Resumo de Preenchimento</Text>
            </View>
            <Text testID="summary-progress-percent" style={styles.percentValue}>
              {progress.percentage}%
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` },
              ]}
            />
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricTile}>
              <Text testID="summary-answered-count" style={styles.metricNumber}>
                {progress.answeredItems}/{progress.applicableItems}
              </Text>
              <Text style={styles.metricLabel}>Respostas</Text>
            </View>

            <View
              style={[
                styles.metricTile,
                progress.pendingRequiredCount > 0 && styles.metricTileAlert,
              ]}
            >
              <Text
                testID="summary-pending-required-count"
                style={[
                  styles.metricNumber,
                  progress.pendingRequiredCount > 0 && { color: tokens.colors.danger },
                ]}
              >
                {progress.pendingRequiredCount}
              </Text>
              <Text style={styles.metricLabel}>Obrig. Pendentes</Text>
            </View>

            <View
              style={[
                styles.metricTile,
                Math.max(progress.nonConformitiesCount, formalNcCount) > 0 &&
                  styles.metricTileAlert,
              ]}
            >
              <Text
                testID="summary-nc-count"
                style={[
                  styles.metricNumber,
                  Math.max(progress.nonConformitiesCount, formalNcCount) > 0 && {
                    color: tokens.colors.danger,
                  },
                ]}
              >
                {Math.max(progress.nonConformitiesCount, formalNcCount)}
              </Text>
              <Text style={styles.metricLabel}>Não Conformidades</Text>
            </View>

            <View style={styles.metricTile}>
              <Text testID="summary-evidences-count" style={styles.metricNumber}>
                {progress.evidencesCount}
              </Text>
              <Text style={styles.metricLabel}>Evidências</Text>
            </View>
          </View>

          <Button
            testID="summary-view-nonconformities-btn"
            title="Ver Não Conformidades por Gravidade"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/(protected)/inspections/[inspectionId]/non-conformities',
                params: { inspectionId: inspection.id },
              })
            }
            style={styles.pendingBtn}
          />

          {progress.pendingRequiredCount > 0 && !readOnly && (
            <View testID="summary-pending-warning-box" style={styles.pendingWarningBox}>
              <Text style={styles.pendingWarningTitle}>
                Pendências obrigatórias impedem a conclusão:
              </Text>
              {progress.pendingRequiredItems.slice(0, 3).map((item) => (
                <Text key={item.itemId} style={styles.pendingWarningItem}>
                  • {item.sectionTitle}: {item.title}
                </Text>
              ))}
              {progress.pendingRequiredItems.length > 3 && (
                <Text style={styles.pendingWarningMore}>
                  + {progress.pendingRequiredItems.length - 3} outro(s) item(ns) pendente(s)
                </Text>
              )}
              <Button
                testID="summary-open-pending-modal-btn"
                title="Ver Pendências e Preencher"
                variant="danger"
                onPress={() => setPendingModalVisible(true)}
                style={styles.pendingBtn}
              />
            </View>
          )}
        </Card>

        {/* Localização GPS e Mapa OpenStreetMap + Leaflet */}
        <Card testID="summary-location-card" style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="my-location" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Geolocalização em Campo (OpenStreetMap)</Text>
          </View>

          <View style={styles.locationBlock}>
            <Text style={styles.locationStageTitle}>Coordenadas de Início</Text>
            <Text testID="summary-start-coords" style={styles.locationCoordsText}>
              {locations.startLocation?.available
                ? formatCoordinatesSummary(
                    locations.startLocation.latitude,
                    locations.startLocation.longitude,
                    locations.startLocation.accuracy
                  )
                : locations.startLocation?.fallback_reason ||
                  'Coordenadas de início ainda não registradas.'}
            </Text>
            {locations.startLocation?.captured_at && (
              <Text style={styles.locationTimeText}>
                Capturada em: {formatDateTime(locations.startLocation.captured_at)}
              </Text>
            )}
          </View>

          <View style={styles.locationBlock}>
            <Text style={styles.locationStageTitle}>Coordenadas de Conclusão</Text>
            <Text testID="summary-complete-coords" style={styles.locationCoordsText}>
              {locations.completeLocation?.available
                ? formatCoordinatesSummary(
                    locations.completeLocation.latitude,
                    locations.completeLocation.longitude,
                    locations.completeLocation.accuracy
                  )
                : locations.completeLocation?.fallback_reason ||
                  (readOnly
                    ? 'Concluída sem sinal GPS disponível.'
                    : 'Será capturada automaticamente ao confirmar a conclusão.')}
            </Text>
            {locations.completeLocation?.captured_at && (
              <Text style={styles.locationTimeText}>
                Capturada em: {formatDateTime(locations.completeLocation.captured_at)}
              </Text>
            )}
          </View>

          <View style={styles.mapWrap}>
            <OsmLeafletMap
              testID="summary-osm-map"
              latitude={activeMapLocation?.latitude}
              longitude={activeMapLocation?.longitude}
              accuracy={activeMapLocation?.accuracy}
              title={
                locations.completeLocation?.available
                  ? 'Local da Conclusão'
                  : 'Local do Início'
              }
              subtitle={`${inspection.site_name} • ${inspection.equipment_name}`}
              height={210}
            />
          </View>
        </Card>

        {/* Galeria consolidada de evidências fotográficas (TASK-016 Passo 5) */}
        <Card testID="summary-evidences-card" style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="photo-library" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Evidências Fotográficas Anexadas</Text>
          </View>
          <EvidenceGallery
            testID="summary-evidence-gallery"
            evidences={displayedEvidences}
            readOnly={readOnly}
            title="Galeria Local"
            emptyMessage="Nenhuma evidência fotográfica anexada até o momento."
            deletingId={deletingEvidenceId}
            onDeleteEvidence={(ev) => void handleDeleteSummaryEvidence(ev)}
          />
        </Card>
      </ScrollView>

      {/* Rodapé de Ações */}
      <View style={styles.footerBar}>
        {!readOnly ? (
          <>
            <Button
              testID="summary-complete-inspection-btn"
              title="Confirmar e Concluir Inspeção"
              variant="primary"
              isLoading={isCompleting}
              disabled={isCompleting}
              onPress={() => void handleConfirmComplete()}
            />
            <Button
              testID="summary-back-to-checklist-btn"
              title="Voltar ao Checklist"
              variant="secondary"
              disabled={isCompleting}
              onPress={handleBackToChecklist}
            />
          </>
        ) : (
          <Button
            testID="summary-back-to-details-btn"
            title="Voltar para Detalhes (Somente Leitura)"
            variant="secondary"
            onPress={handleBackToChecklist}
          />
        )}
      </View>

      <PendingItemsModal
        visible={pendingModalVisible}
        pendingItems={blockedPendingItems}
        onClose={() => setPendingModalVisible(false)}
        onSelectItem={handleGoToItem}
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    marginBottom: tokens.spacing.m,
  },
  syncBannerPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  syncBannerDone: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  syncBannerTextWrap: {
    flex: 1,
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncBannerSubtitle: {
    fontSize: 12,
    color: tokens.colors.text,
    marginTop: 2,
    lineHeight: 18,
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
  card: {
    marginBottom: tokens.spacing.m,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  clientTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: 2,
  },
  siteSubtitle: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.m,
  },
  timestampsBox: {
    marginTop: tokens.spacing.m,
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: 4,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timestampLabel: {
    fontSize: 13,
    color: tokens.colors.textMuted,
  },
  timestampValue: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.s,
  },
  cardTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  percentValue: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.s,
  },
  metricTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.s + 2,
    alignItems: 'center',
  },
  metricTileAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  pendingWarningBox: {
    marginTop: tokens.spacing.m,
    padding: tokens.spacing.m,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: tokens.borderRadius.medium,
    gap: 4,
  },
  pendingWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  pendingWarningItem: {
    fontSize: 12,
    color: '#78350F',
  },
  pendingWarningMore: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#92400E',
  },
  pendingBtn: {
    marginTop: tokens.spacing.s,
  },
  locationBlock: {
    marginTop: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  locationStageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
  },
  locationCoordsText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
    marginTop: 2,
  },
  locationTimeText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  mapWrap: {
    marginTop: tokens.spacing.m,
  },
  footerBar: {
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.s,
  },
});
