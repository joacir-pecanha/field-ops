import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import {
  EMPTY_FILTERED_INSPECTIONS_MESSAGE,
  EMPTY_INSPECTIONS_MESSAGE,
  InspectionCard,
  type InspectionListItem,
  type UseInspectionListOptions,
  useInspectionList,
} from '@/features/inspections';
import {
  type Inspection,
  type InspectionFilterTab,
} from '@/infrastructure/database/types';

export interface InspectionsScreenProps {
  listOptions?: UseInspectionListOptions;
}

const FILTER_TABS: Array<{ key: InspectionFilterTab; label: string }> = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'PENDENTES', label: 'Pendentes' },
  { key: 'EM_ANDAMENTO', label: 'Em andamento' },
  { key: 'CONCLUÍDAS', label: 'Concluídas' },
];

function isValidFilterTab(value?: string): value is InspectionFilterTab {
  return (
    value === 'TODAS' ||
    value === 'PENDENTES' ||
    value === 'EM_ANDAMENTO' ||
    value === 'CONCLUÍDAS'
  );
}

export default function InspectionsScreen(props: InspectionsScreenProps) {
  const { listOptions } = props ?? {};
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const autoSyncAttemptedRef = useRef(false);

  const {
    items,
    metrics,
    countsByTab,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    onlyOverdue,
    setOnlyOverdue,
    onlyDueToday,
    setOnlyDueToday,
    isLoading,
    isRefreshing,
    isOnline,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  } = useInspectionList(listOptions);

  // Sincroniza filtros recebidos via navegação da Home
  useEffect(() => {
    const paramTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const paramFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;

    if (paramTab && isValidFilterTab(paramTab)) {
      setStatusFilter(paramTab);
      setOnlyOverdue(false);
      setOnlyDueToday(false);
    } else if (paramFilter === 'ATRASADAS') {
      setStatusFilter('TODAS');
      setOnlyOverdue(true);
      setOnlyDueToday(false);
    } else if (paramFilter === 'HOJE') {
      setStatusFilter('TODAS');
      setOnlyOverdue(false);
      setOnlyDueToday(true);
    }
  }, [params.tab, params.filter, setStatusFilter, setOnlyOverdue, setOnlyDueToday]);

  useFocusEffect(
    useCallback(() => {
      reloadLocal();
    }, [reloadLocal])
  );

  // Pull inicial automático se banco local estiver vazio ao entrar online
  useEffect(() => {
    if (!isLoading && metrics.total === 0 && !autoSyncAttemptedRef.current && isOnline) {
      autoSyncAttemptedRef.current = true;
      void refresh();
    }
  }, [isLoading, metrics.total, isOnline, refresh]);

  const hasActiveFilters =
    statusFilter !== 'TODAS' ||
    searchQuery.trim().length > 0 ||
    onlyOverdue ||
    onlyDueToday;

  const handleSelectTab = useCallback(
    (tab: InspectionFilterTab) => {
      setStatusFilter(tab);
      if (params.tab || params.filter) {
        router.setParams({ tab: undefined, filter: undefined });
      }
    },
    [setStatusFilter, params.tab, params.filter, router]
  );

  const handleToggleOverdue = useCallback(() => {
    setOnlyOverdue((prev) => !prev);
    if (params.filter) {
      router.setParams({ filter: undefined });
    }
  }, [setOnlyOverdue, params.filter, router]);

  const handleToggleDueToday = useCallback(() => {
    setOnlyDueToday((prev) => !prev);
    if (params.filter) {
      router.setParams({ filter: undefined });
    }
  }, [setOnlyDueToday, params.filter, router]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('TODAS');
    setSearchQuery('');
    setOnlyOverdue(false);
    setOnlyDueToday(false);
    if (params.tab || params.filter) {
      router.setParams({ tab: undefined, filter: undefined });
    }
  }, [
    setStatusFilter,
    setSearchQuery,
    setOnlyOverdue,
    setOnlyDueToday,
    params.tab,
    params.filter,
    router,
  ]);

  const handleOpenInspection = useCallback(
    (inspection: Inspection) => {
      router.push({
        pathname: '/(protected)/inspections/[inspectionId]',
        params: { inspectionId: inspection.id },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: InspectionListItem }) => (
      <InspectionCard
        inspection={item}
        isOverdue={item.isOverdue}
        isPendingSync={item.isPendingSync}
        onPress={handleOpenInspection}
      />
    ),
    [handleOpenInspection]
  );

  const renderEmptyState = () => {
    if (isLoading && items.length === 0) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
          <Text style={styles.emptySubtitle}>Consultando inspeções no SQLite...</Text>
        </View>
      );
    }

    const noInspectionsAtAll = metrics.total === 0;

    return (
      <View testID="inspections-empty-state" style={styles.emptyState}>
        <MaterialIcons
          name={noInspectionsAtAll ? 'assignment' : 'search-off'}
          size={52}
          color={tokens.colors.textMuted}
        />
        <Text style={styles.emptyTitle}>
          {noInspectionsAtAll
            ? EMPTY_INSPECTIONS_MESSAGE
            : EMPTY_FILTERED_INSPECTIONS_MESSAGE}
        </Text>
        <Text style={styles.emptySubtitle}>
          {noInspectionsAtAll
            ? 'Quando novas inspeções forem atribuídas a você, elas ficarão disponíveis aqui inclusive sem internet.'
            : 'Altere os termos da busca ou selecione outra aba de estado para visualizar mais ordens.'}
        </Text>

        <View style={styles.emptyActions}>
          {!noInspectionsAtAll && hasActiveFilters ? (
            <Button
              testID="inspections-clear-filters-btn"
              title="Limpar Filtros"
              onPress={handleClearFilters}
              variant="secondary"
            />
          ) : (
            <Button
              testID="inspections-refresh-btn"
              title={isRefreshing ? 'Atualizando...' : 'Atualizar Lista'}
              onPress={() => {
                void refresh();
              }}
              isLoading={isRefreshing}
              disabled={isRefreshing}
              variant="primary"
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho fixo: Busca textual + Abas de estado + Chips rápidos */}
      <View style={styles.filterHeader}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={tokens.colors.textMuted} />
          <RNTextInput
            testID="inspections-search-input"
            style={styles.searchInput}
            placeholder="Buscar cliente, local, equipamento, código ou QR..."
            placeholderTextColor={tokens.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar inspeções"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              testID="inspections-search-clear"
              onPress={() => setSearchQuery('')}
              style={styles.clearIconBtn}
              accessibilityLabel="Limpar busca"
            >
              <MaterialIcons name="close" size={18} color={tokens.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Abas de filtragem local por estado (RF-04) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            const count = countsByTab[tab.key];

            return (
              <TouchableOpacity
                key={tab.key}
                testID={`inspections-tab-${tab.key}`}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => handleSelectTab(tab.key)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabCountBadge, active && styles.tabCountBadgeActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filtros rápidos complementares */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            testID="inspections-chip-overdue"
            style={[
              styles.quickChip,
              onlyOverdue && styles.quickChipDangerActive,
            ]}
            onPress={handleToggleOverdue}
            accessibilityRole="button"
            accessibilityState={{ selected: onlyOverdue }}
          >
            <MaterialIcons
              name="warning"
              size={14}
              color={onlyOverdue ? tokens.colors.textInverse : tokens.colors.danger}
            />
            <Text
              style={[
                styles.quickChipText,
                onlyOverdue && styles.quickChipTextActive,
              ]}
            >
              Atrasadas ({metrics.overdue})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="inspections-chip-today"
            style={[
              styles.quickChip,
              onlyDueToday && styles.quickChipPrimaryActive,
            ]}
            onPress={handleToggleDueToday}
            accessibilityRole="button"
            accessibilityState={{ selected: onlyDueToday }}
          >
            <MaterialIcons
              name="event"
              size={14}
              color={onlyDueToday ? tokens.colors.textInverse : tokens.colors.primary}
            />
            <Text
              style={[
                styles.quickChipText,
                onlyDueToday && styles.quickChipTextActive,
              ]}
            >
              Para hoje ({metrics.today})
            </Text>
          </TouchableOpacity>

          {hasActiveFilters && (
            <TouchableOpacity
              testID="inspections-reset-chips"
              style={styles.resetChip}
              onPress={handleClearFilters}
              accessibilityRole="button"
            >
              <Text style={styles.resetChipText}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Listagem virtualizada com leitura primária no SQLite (CA-01, RF-06) */}
      <FlatList
        testID="inspections-flatlist"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refresh();
            }}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Snackbar discreto preservando dados locais quando refresh falha offline (EX-02, RT-03) */}
      {snackbar?.visible && (
        <View
          testID="inspections-offline-snackbar"
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
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  filterHeader: {
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingTop: tokens.spacing.m,
    paddingBottom: tokens.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    gap: tokens.spacing.s,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    paddingHorizontal: tokens.spacing.s + 4,
    minHeight: 48,
    gap: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.regular - 1,
    color: tokens.colors.text,
    paddingVertical: tokens.spacing.s,
  },
  clearIconBtn: {
    padding: tokens.spacing.xs,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
    paddingVertical: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs + 2,
    paddingHorizontal: tokens.spacing.s + 4,
    borderRadius: tokens.borderRadius.round,
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 6,
  },
  tabPillActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  tabLabel: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  tabLabelActive: {
    color: tokens.colors.textInverse,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  tabCountBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: tokens.borderRadius.round,
    backgroundColor: tokens.colors.border,
    alignItems: 'center',
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabCountText: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  tabCountTextActive: {
    color: tokens.colors.textInverse,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: tokens.spacing.s + 2,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    gap: 4,
  },
  quickChipDangerActive: {
    backgroundColor: tokens.colors.danger,
    borderColor: tokens.colors.danger,
  },
  quickChipPrimaryActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  quickChipText: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  quickChipTextActive: {
    color: tokens.colors.textInverse,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  resetChip: {
    paddingVertical: 4,
    paddingHorizontal: tokens.spacing.xs,
  },
  resetChipText: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
  },
  listContent: {
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxl + 24,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    gap: tokens.spacing.s,
  },
  emptyTitle: {
    fontSize: tokens.typography.fontSizes.large - 2,
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
  emptyActions: {
    marginTop: tokens.spacing.m,
    width: '100%',
    maxWidth: 260,
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
