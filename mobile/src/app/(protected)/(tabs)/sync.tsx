import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '@/design-system/tokens';
import { Card } from '@/design-system/components/Card';
import { Button } from '@/design-system/components/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { useSyncStatus } from '@/features/sync';
import { useFocusEffect } from 'expo-router';
import { type OutboxOperation } from '@/infrastructure/database';

export default function SyncScreen() {
  const {
    pendingCount,
    syncedCount,
    errorCount,
    isSyncing,
    isOnline,
    lastSyncAt,
    lastSyncResult,
    lastSyncMessage,
    operations,
    syncNow,
    refreshStatus,
    setMockOnline,
  } = useSyncStatus();

  const [refreshing, setRefreshing] = useState(false);
  const [offlineSimulated, setOfflineSimulated] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refreshStatus();
    }, [refreshStatus])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshStatus();
    setRefreshing(false);
  }, [refreshStatus]);

  const handleManualSync = async () => {
    await syncNow();
  };

  const toggleOfflineSimulation = () => {
    const nextState = !offlineSimulated;
    setOfflineSimulated(nextState);
    setMockOnline(nextState ? false : null);
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'START_INSPECTION':
        return 'Iniciar Inspeção';
      case 'SUBMIT_RESPONSE':
        return 'Salvar Resposta';
      case 'UPLOAD_EVIDENCE':
        return 'Upload Evidência';
      case 'COMPLETE_INSPECTION':
        return 'Finalizar Inspeção';
      default:
        return type;
    }
  };

  const getOperationIcon = (type: string): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case 'START_INSPECTION':
        return 'play-circle-outline';
      case 'SUBMIT_RESPONSE':
        return 'check-circle-outline';
      case 'UPLOAD_EVIDENCE':
        return 'camera-alt';
      case 'COMPLETE_INSPECTION':
        return 'task-alt';
      default:
        return 'sync';
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#e8f4fd', text: tokens.colors.primary, label: 'Pendente' };
      case 'SYNCING':
        return { bg: '#fff8e6', text: '#b78103', label: 'Enviando...' };
      case 'ERROR':
        return { bg: '#fde8e8', text: tokens.colors.danger, label: 'Erro' };
      case 'CONFLICT':
        return { bg: '#fdf0d5', text: '#d9534f', label: 'Conflito' };
      default:
        return { bg: tokens.colors.background, text: tokens.colors.textMuted, label: status };
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return 'Nunca';
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Barra de Status de Conectividade */}
      <View style={styles.networkHeader}>
        <View
          style={[
            styles.networkBadge,
            { backgroundColor: isOnline ? '#e6f4ea' : '#fce8e6' },
          ]}
        >
          <View
            style={[
              styles.networkDot,
              { backgroundColor: isOnline ? tokens.colors.online : tokens.colors.danger },
            ]}
          />
          <Text
            style={[
              styles.networkText,
              { color: isOnline ? '#137333' : '#c5221f' },
            ]}
          >
            {isOnline ? 'Online • Conectado à Nuvem' : 'Offline • Sem Conexão de Rede'}
          </Text>
        </View>

        {/* Botão de Simulação de Offline para Testes e Demonstrações */}
        <TouchableOpacity
          onPress={toggleOfflineSimulation}
          style={[
            styles.simToggle,
            offlineSimulated && styles.simToggleActive,
          ]}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={offlineSimulated ? 'wifi-off' : 'wifi'}
            size={16}
            color={offlineSimulated ? tokens.colors.textInverse : tokens.colors.textMuted}
          />
          <Text
            style={[
              styles.simToggleText,
              offlineSimulated && styles.simToggleTextActive,
            ]}
          >
            {offlineSimulated ? 'Simulando Offline' : 'Simular Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cartão de Estado Geral (Hero) */}
      <Card style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View
            style={[
              styles.heroIconContainer,
              {
                backgroundColor: isSyncing
                  ? '#fff8e6'
                  : pendingCount > 0
                  ? '#e8f4fd'
                  : '#e6f4ea',
              },
            ]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={tokens.colors.primary} />
            ) : (
              <MaterialIcons
                name={pendingCount > 0 ? 'cloud-upload' : 'cloud-done'}
                size={28}
                color={
                  pendingCount > 0 ? tokens.colors.primary : tokens.colors.success
                }
              />
            )}
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>
              {isSyncing
                ? 'Sincronizando operações...'
                : pendingCount === 0
                ? 'Sincronizado'
                : `${pendingCount} operação(ões) pendente(s)`}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isSyncing
                ? 'Enviando mutações locais para a API central...'
                : pendingCount === 0
                ? 'Todos os dados locais estão atualizados na nuvem.'
                : 'Mutações locais salvas no SQLite aguardando envio.'}
            </Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <Text style={styles.lastSyncLabel}>Última sincronização:</Text>
          <Text style={styles.lastSyncValue}>{formatTimestamp(lastSyncAt)}</Text>
        </View>

        {lastSyncMessage && (
          <View
            style={[
              styles.messageBanner,
              lastSyncResult === 'SUCCESS' && styles.messageSuccess,
              lastSyncResult === 'ERROR' && styles.messageError,
              lastSyncResult === 'OFFLINE' && styles.messageOffline,
            ]}
          >
            <MaterialIcons
              name={
                lastSyncResult === 'SUCCESS'
                  ? 'check-circle'
                  : lastSyncResult === 'OFFLINE'
                  ? 'cloud-off'
                  : 'error-outline'
              }
              size={16}
              color={
                lastSyncResult === 'SUCCESS'
                  ? tokens.colors.success
                  : lastSyncResult === 'OFFLINE'
                  ? tokens.colors.textMuted
                  : tokens.colors.danger
              }
            />
            <Text style={styles.messageText}>{lastSyncMessage}</Text>
          </View>
        )}
      </Card>

      {/* Métricas Principais (RF-01) */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <MaterialIcons name="schedule" size={22} color={tokens.colors.primary} />
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>Pendentes</Text>
        </Card>

        <Card style={styles.metricCard}>
          <MaterialIcons name="done-all" size={22} color={tokens.colors.success} />
          <Text style={[styles.metricValue, { color: tokens.colors.success }]}>
            {syncedCount}
          </Text>
          <Text style={styles.metricLabel}>Sincronizadas</Text>
        </Card>

        <Card style={styles.metricCard}>
          <MaterialIcons name="error-outline" size={22} color={tokens.colors.danger} />
          <Text style={[styles.metricValue, { color: tokens.colors.danger }]}>
            {errorCount}
          </Text>
          <Text style={styles.metricLabel}>Com Erro</Text>
        </Card>
      </View>

      {/* Botão de Disparo Manual (RF-02) */}
      <Button
        title={isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
        onPress={handleManualSync}
        variant="primary"
        isLoading={isSyncing}
        disabled={isSyncing}
        style={styles.syncButton}
      />

      {/* Lista de Operações da Fila Outbox */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fila de Operações Outbox</Text>
        <Text style={styles.sectionSubtitle}>
          {operations.length} operação(ões) registrada(s) localmente
        </Text>
      </View>

      {operations.length === 0 ? (
        <Card style={styles.emptyCard}>
          <MaterialIcons name="check-circle" size={48} color={tokens.colors.success} />
          <Text style={styles.emptyTitle}>Fila Outbox Limpa</Text>
          <Text style={styles.emptySubtitle}>
            Nenhuma operação em espera. Todas as alterações efetuadas pelo técnico
            foram sincronizadas com a API REST.
          </Text>
        </Card>
      ) : (
        operations.map((op: OutboxOperation) => {
          const badge = getStatusBadgeStyle(op.status);
          const icon = getOperationIcon(op.operation_type);

          return (
            <Card key={op.id} style={styles.operationCard}>
              <View style={styles.operationHeader}>
                <View style={styles.opTypeWrapper}>
                  <MaterialIcons name={icon} size={20} color={tokens.colors.primary} />
                  <Text style={styles.operationTitle}>
                    {getOperationTypeLabel(op.operation_type)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>

              <View style={styles.operationDetails}>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entidade: </Text>
                  {op.entity_type} • ID: {op.global_id}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailLabel}>UUID Idempotente: </Text>
                  <Text style={styles.uuidText}>{op.id}</Text>
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Criado em: </Text>
                  {formatTimestamp(op.created_at)}
                </Text>
                {op.retries > 0 && (
                  <Text style={[styles.detailRow, { color: tokens.colors.danger }]}>
                    <Text style={styles.detailLabel}>Tentativas de reenvio: </Text>
                    {op.retries}
                  </Text>
                )}
                {op.error_message && (
                  <View style={styles.errorMessageContainer}>
                    <MaterialIcons name="warning" size={14} color={tokens.colors.danger} />
                    <Text style={styles.errorMessageText}>{op.error_message}</Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxl,
  },
  networkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.m,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.borderRadius.round,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: tokens.spacing.xs,
  },
  networkText: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  simToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  simToggleActive: {
    backgroundColor: tokens.colors.danger,
    borderColor: tokens.colors.danger,
  },
  simToggleText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
  },
  simToggleTextActive: {
    color: tokens.colors.textInverse,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  heroCard: {
    padding: tokens.spacing.m,
    marginBottom: tokens.spacing.m,
    borderRadius: tokens.borderRadius.large,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.m,
  },
  heroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.m,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  heroSubtitle: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  lastSyncLabel: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
  },
  lastSyncValue: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.s,
    padding: tokens.spacing.s,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.background,
  },
  messageSuccess: {
    backgroundColor: '#e6f4ea',
  },
  messageError: {
    backgroundColor: '#fde8e8',
  },
  messageOffline: {
    backgroundColor: '#f1f3f4',
  },
  messageText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.text,
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.m,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: tokens.spacing.xs,
    alignItems: 'center',
    padding: tokens.spacing.s,
  },
  metricValue: {
    fontSize: tokens.typography.fontSizes.title,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: tokens.spacing.xs,
  },
  metricLabel: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  syncButton: {
    marginBottom: tokens.spacing.l,
    width: '100%',
  },
  sectionHeader: {
    marginBottom: tokens.spacing.s,
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  sectionSubtitle: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
    marginTop: tokens.spacing.s,
  },
  emptyTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: tokens.spacing.m,
  },
  emptySubtitle: {
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    lineHeight: 20,
  },
  operationCard: {
    marginBottom: tokens.spacing.s,
    padding: tokens.spacing.m,
  },
  operationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  opTypeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  operationTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  badge: {
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.round,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: tokens.typography.fontWeights.bold,
    textTransform: 'uppercase',
  },
  operationDetails: {
    marginTop: tokens.spacing.xs,
    gap: 4,
  },
  detailRow: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
  },
  detailLabel: {
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  uuidText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: tokens.colors.secondary,
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    padding: tokens.spacing.xs,
    backgroundColor: '#fde8e8',
    borderRadius: tokens.borderRadius.small,
  },
  errorMessageText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    flex: 1,
  },
});
