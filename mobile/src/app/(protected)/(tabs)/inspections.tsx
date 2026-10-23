import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { tokens } from '@/design-system/tokens';
import { Card } from '@/design-system/components/Card';
import { TextInput } from '@/design-system/components/TextInput';
import { StatusBadge, InspectionStatus } from '@/design-system/components/StatusBadge';
import { MaterialIcons } from '@expo/vector-icons';
import { InspectionRepository, OutboxRepository, Inspection } from '@/infrastructure/database';
import { useFocusEffect } from 'expo-router';

export default function InspectionsScreen() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const inspectionRepo = new InspectionRepository();
      const outboxRepo = new OutboxRepository();

      const allInspections = await inspectionRepo.findAll();
      const outboxOps = await outboxRepo.findPendingOperations();

      const pendingIds = new Set(
        outboxOps
          .filter(op => op.entity_type === 'INSPECTION' && op.global_id)
          .map(op => op.global_id as string)
      );

      setInspections(allInspections);
      setPendingSyncIds(pendingIds);
    } catch (e) {
      console.error('Error loading inspections', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const filteredInspections = useMemo(() => {
    return inspections.filter(item => {
      const query = searchQuery.toLowerCase();
      const client = item.client_name || item.client || '';
      const site = item.site_name || item.site || '';
      const matchClient = client.toLowerCase().includes(query);
      const matchSite = site.toLowerCase().includes(query);
      return matchClient || matchSite;
    });
  }, [inspections, searchQuery]);

  const renderItem = ({ item }: { item: Inspection }) => {
    const isOffline = !item.remote_id;
    const isPendingSync = pendingSyncIds.has(item.id);
    const clientName = item.client_name || item.client || 'Sem cliente';
    const siteName = item.site_name || item.site || 'Sem local';
    const equipmentName = item.equipment_name || item.equipment;

    return (
      <Card style={styles.card} onPress={() => {}}>
        <View style={styles.cardHeader}>
          <Text style={styles.clientName}>{clientName}</Text>
          <View style={styles.indicators}>
            {isOffline && (
              <MaterialIcons name="cloud-off" size={16} color={tokens.colors.textMuted} style={styles.indicatorIcon} />
            )}
            {isPendingSync && (
              <MaterialIcons name="sync" size={16} color={tokens.colors.warning} style={styles.indicatorIcon} />
            )}
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={16} color={tokens.colors.textMuted} />
            <Text style={styles.infoText}>{siteName}</Text>
          </View>
          {equipmentName && (
            <View style={styles.infoRow}>
              <MaterialIcons name="build" size={16} color={tokens.colors.textMuted} />
              <Text style={styles.infoText}>{equipmentName}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <StatusBadge status={item.status as InspectionStatus} />
          {item.due_date && (
            <Text style={styles.dateText}>
              Vence: {new Date(item.due_date).toLocaleDateString('pt-BR')}
            </Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          label="Buscar Inspeções"
          placeholder="Cliente ou local..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredInspections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color={tokens.colors.textMuted} />
            <Text style={styles.emptyStateText}>Nenhuma inspeção encontrada.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  listContent: {
    padding: tokens.spacing.m,
  },
  card: {
    marginBottom: tokens.spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.s,
  },
  clientName: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    flex: 1,
  },
  indicators: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
  },
  indicatorIcon: {
    marginLeft: tokens.spacing.xs,
  },
  cardBody: {
    marginBottom: tokens.spacing.m,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  infoText: {
    marginLeft: tokens.spacing.xs,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    marginTop: tokens.spacing.xl,
  },
  emptyStateText: {
    marginTop: tokens.spacing.m,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
  },
});
