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
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { tokens } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  EMPTY_INSPECTIONS_MESSAGE,
  InspectionCard,
  type InspectionListItem,
  useInspectionList,
} from '@/features/inspections';
import { useSyncStatus } from '@/features/sync';
import { type Inspection } from '@/infrastructure/database/types';

const FINISHED_STATUSES = new Set([
  'ENVIADA',
  'EM_REVISÃO',
  'APROVADA',
  'CANCELADA',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'CANCELLED',
]);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    pendingCount,
    isSyncing,
    isOnline: syncIsOnline,
    syncNow,
    refreshStatus,
  } = useSyncStatus();

  const {
    items,
    metrics,
    isLoading,
    isRefreshing,
    isOnline: listIsOnline,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  } = useInspectionList();

  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const autoSyncAttemptedRef = useRef(false);

  const effectiveOnline = syncIsOnline && listIsOnline;
  const totalPendingSync = Math.max(metrics.pendingSync, pendingCount);
  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return 'Técnico';
    return raw.split(' ')[0];
  }, [user?.name]);

  useFocusEffect(
    useCallback(() => {
      reloadLocal();
      refreshStatus();
    }, [reloadLocal, refreshStatus])
  );

  // Na primeira abertura com SQLite vazio e dispositivo online, baixa as inspeções atribuídas
  useEffect(() => {
    if (!isLoading && metrics.total === 0 && !autoSyncAttemptedRef.current && effectiveOnline) {
      autoSyncAttemptedRef.current = true;
      void refresh();
    }
  }, [isLoading, metrics.total, effectiveOnline, refresh]);

  useEffect(() => {
    if (!syncFeedback) return;
    const timer = setTimeout(() => setSyncFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [syncFeedback]);

  const onRefresh = useCallback(async () => {
    setSyncFeedback(null);
    await Promise.all([refreshStatus(), refresh()]);
  }, [refreshStatus, refresh]);

  const handleQuickSync = useCallback(async () => {
    setIsQuickSyncing(true);
    setSyncFeedback(null);
    try {
      const outboxResult = await syncNow();
      const refreshResult = await refresh();

      if (refreshResult.refreshedFromNetwork) {
        const message =
          outboxResult.processedCount > 0
            ? `${outboxResult.processedCount} alteração(ões) enviada(s) e lista atualizada.`
            : 'Dados sincronizados com sucesso no dispositivo.';
        setSyncFeedback({ type: 'success', text: message });
      } else {
        setSyncFeedback({
          type: 'warning',
          text: refreshResult.snackbar?.message || outboxResult.message,
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'warning',
        text: err?.message || 'Não foi possível sincronizar agora. Dados locais mantidos.',
      });
    } finally {
      setIsQuickSyncing(false);
    }
  }, [syncNow, refresh]);

  const priorityItems = useMemo<InspectionListItem[]>(() => {
    const active = items.filter(
      (item) => !FINISHED_STATUSES.has(String(item.status ?? '').trim().toUpperCase())
    );

    const scoreItem = (item: InspectionListItem) => {
      const st = String(item.status ?? '').trim().toUpperCase();
      if (item.isOverdue) return 0;
      if (st === 'EM_ANDAMENTO' || st === 'IN_PROGRESS') return 1;
      return 2;
    };

    return [...active]
      .sort((a, b) => scoreItem(a) - scoreItem(b))
      .slice(0, 3);
  }, [items]);

  const handleOpenInspection = useCallback(
    (inspection: Inspection) => {
      router.push({
        pathname: '/(protected)/inspections/[inspectionId]',
        params: { inspectionId: inspection.id },
      });
    },
    [router]
  );

  const busySync = isQuickSyncing || isSyncing || isRefreshing;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Cabeçalho Operacional com Status de Rede */}
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.greeting}>Olá, {firstName}</Text>
            <Text style={styles.subtitle}>
              Resumo da sua carga de inspeções offline-first
            </Text>
          </View>

          <View
            testID="home-network-badge"
            style={[
              styles.connectionBadge,
              effectiveOnline ? styles.connectionOnline : styles.connectionOffline,
            ]}
            accessibilityLabel={
              effectiveOnline ? 'Dispositivo online' : 'Dispositivo offline'
            }
          >
            <View
              style={[
                styles.connectionDot,
                {
                  backgroundColor: effectiveOnline
                    ? tokens.colors.online
                    : tokens.colors.danger,
                },
              ]}
            />
            <Text
              style={[
                styles.connectionText,
                { color: effectiveOnline ? '#137333' : '#a71d2a' },
              ]}
            >
              {effectiveOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Grid 2x2 de Contadores Operacionais (SQLite em tempo real) */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <Card
              testID="metric-today-card"
              style={styles.metricCard}
              onPress={() =>
                router.push({
                  pathname: '/(protected)/(tabs)/inspections',
                  params: { filter: 'HOJE' },
                })
              }
              accessibilityLabel={`Para hoje: ${metrics.today} inspeções`}
            >
              <View style={[styles.metricIconBox, { backgroundColor: '#e7f1ff' }]}>
                <MaterialIcons name="event" size={22} color={tokens.colors.primary} />
              </View>
              <Text style={styles.metricValue}>{metrics.today}</Text>
              <Text style={styles.metricLabel}>Para hoje</Text>
            </Card>

            <Card
              testID="metric-overdue-card"
              style={[
                styles.metricCard,
                metrics.overdue > 0 && styles.metricCardDanger,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/(protected)/(tabs)/inspections',
                  params: { filter: 'ATRASADAS' },
                })
              }
              accessibilityLabel={`Atrasadas: ${metrics.overdue} inspeções`}
            >
              <View
                style={[
                  styles.metricIconBox,
                  {
                    backgroundColor:
                      metrics.overdue > 0 ? '#f8d7da' : '#f1f3f4',
                  },
                ]}
              >
                <MaterialIcons
                  name="warning"
                  size={22}
                  color={
                    metrics.overdue > 0
                      ? tokens.colors.danger
                      : tokens.colors.textMuted
                  }
                />
              </View>
              <Text
                style={[
                  styles.metricValue,
                  metrics.overdue > 0 && { color: tokens.colors.danger },
                ]}
              >
                {metrics.overdue}
              </Text>
              <Text style={styles.metricLabel}>Atrasadas</Text>
            </Card>
          </View>

          <View style={styles.metricsRow}>
            <Card
              testID="metric-in-progress-card"
              style={styles.metricCard}
              onPress={() =>
                router.push({
                  pathname: '/(protected)/(tabs)/inspections',
                  params: { tab: 'EM_ANDAMENTO' },
                })
              }
              accessibilityLabel={`Em andamento: ${metrics.inProgress} inspeções`}
            >
              <View style={[styles.metricIconBox, { backgroundColor: '#fff3cd' }]}>
                <MaterialIcons name="play-circle-outline" size={22} color="#856404" />
              </View>
              <Text style={styles.metricValue}>{metrics.inProgress}</Text>
              <Text style={styles.metricLabel}>Em andamento</Text>
            </Card>

            <Card
              testID="metric-pending-sync-card"
              style={[
                styles.metricCard,
                totalPendingSync > 0 && styles.metricCardSyncPending,
              ]}
              onPress={() => router.push('/(protected)/(tabs)/sync')}
              accessibilityLabel={`Pendentes de envio: ${totalPendingSync}`}
            >
              <View style={[styles.metricIconBox, { backgroundColor: '#e8f4fd' }]}>
                <MaterialIcons name="cloud-upload" size={22} color={tokens.colors.info} />
              </View>
              <Text
                style={[
                  styles.metricValue,
                  totalPendingSync > 0 && { color: tokens.colors.primary },
                ]}
              >
                {totalPendingSync}
              </Text>
              <Text style={styles.metricLabel}>Pendentes de envio</Text>
            </Card>
          </View>
        </View>

        {/* Ações Rápidas */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsContainer}>
          <Button
            testID="home-sync-button"
            title={busySync ? 'Sincronizando...' : 'Sincronizar Dados'}
            onPress={handleQuickSync}
            variant="primary"
            isLoading={busySync}
            disabled={busySync}
            style={styles.actionButton}
          />
          <Button
            testID="home-all-inspections-button"
            title={`Ver Todas as Inspeções (${metrics.total})`}
            onPress={() => router.push('/(protected)/(tabs)/inspections')}
            variant="secondary"
            style={styles.actionButton}
          />
        </View>

        {syncFeedback && (
          <View
            testID="home-sync-feedback"
            style={[
              styles.feedbackBanner,
              syncFeedback.type === 'success'
                ? styles.feedbackSuccess
                : styles.feedbackWarning,
            ]}
          >
            <MaterialIcons
              name={syncFeedback.type === 'success' ? 'check-circle' : 'info-outline'}
              size={18}
              color={
                syncFeedback.type === 'success'
                  ? tokens.colors.success
                  : '#856404'
              }
            />
            <Text style={styles.feedbackText}>{syncFeedback.text}</Text>
          </View>
        )}

        {/* Inspeções Prioritárias */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Inspeções Prioritárias</Text>
          {metrics.total > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/(tabs)/inspections')}
              accessibilityRole="button"
            >
              <Text style={styles.seeAllLink}>Ver todas</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading && items.length === 0 ? (
          <Card style={styles.centerBox}>
            <ActivityIndicator size="small" color={tokens.colors.primary} />
            <Text style={styles.centerText}>Carregando inspeções do SQLite...</Text>
          </Card>
        ) : metrics.total === 0 ? (
          <Card testID="home-empty-state" style={styles.emptyCard}>
            <MaterialIcons name="assignment-late" size={40} color={tokens.colors.textMuted} />
            <Text style={styles.emptyTitle}>{EMPTY_INSPECTIONS_MESSAGE}</Text>
            <Text style={styles.emptySubtitle}>
              Toque em &quot;Sincronizar Dados&quot; quando estiver conectado para baixar novas
              ordens atribuídas ao seu usuário.
            </Text>
          </Card>
        ) : priorityItems.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialIcons name="verified" size={40} color={tokens.colors.success} />
            <Text style={styles.emptyTitle}>Todas as inspeções estão concluídas!</Text>
            <Text style={styles.emptySubtitle}>
              Você pode consultar o histórico na aba Inspeções.
            </Text>
          </Card>
        ) : (
          priorityItems.map((item) => (
            <InspectionCard
              key={item.id}
              inspection={item}
              isOverdue={item.isOverdue}
              isPendingSync={item.isPendingSync}
              onPress={handleOpenInspection}
            />
          ))
        )}
      </ScrollView>

      {/* Snackbar Discreto em caso de falha de rede durante refresh (EX-02) */}
      {snackbar?.visible && (
        <View testID="home-offline-snackbar" style={styles.snackbar} accessibilityRole="alert">
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
  container: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.l,
  },
  headerTextBlock: {
    flex: 1,
  },
  greeting: {
    fontSize: tokens.typography.fontSizes.title,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  subtitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs + 2,
    paddingHorizontal: tokens.spacing.s + 2,
    borderRadius: tokens.borderRadius.round,
    gap: 6,
  },
  connectionOnline: {
    backgroundColor: '#e6f4ea',
  },
  connectionOffline: {
    backgroundColor: '#fde8e8',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  metricsGrid: {
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.l,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
  },
  metricCard: {
    flex: 1,
    marginBottom: 0,
    alignItems: 'center',
    paddingVertical: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.s,
  },
  metricCardDanger: {
    borderColor: tokens.colors.danger,
    backgroundColor: '#fff5f5',
  },
  metricCardSyncPending: {
    borderColor: tokens.colors.primary,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: tokens.typography.fontSizes.title,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: tokens.spacing.s,
  },
  metricLabel: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.l,
    marginBottom: tokens.spacing.s,
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSizes.large - 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.s,
  },
  seeAllLink: {
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.s,
  },
  actionsContainer: {
    gap: tokens.spacing.s,
  },
  actionButton: {
    width: '100%',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    marginTop: tokens.spacing.m,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: '#e6f4ea',
    borderColor: '#b7ebc6',
  },
  feedbackWarning: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffe082',
  },
  feedbackText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.l,
    gap: tokens.spacing.s,
  },
  centerText: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.textMuted,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.l,
    gap: tokens.spacing.xs,
  },
  emptyTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
  },
  emptySubtitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  snackbar: {
    position: 'absolute',
    left: tokens.spacing.m,
    right: tokens.spacing.m,
    bottom: tokens.spacing.m,
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
