import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '@/design-system/components/Card';
import { StatusBadge, type InspectionStatus } from '@/design-system/components/StatusBadge';
import { tokens } from '@/design-system/tokens';
import {
  isInspectionOverdue,
  isInspectionPendingSync,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  type Inspection,
  type InspectionPriority,
  type InspectionSyncStatus,
} from '@/infrastructure/database/types';

export type PriorityIconName =
  | 'arrow-downward'
  | 'remove'
  | 'arrow-upward'
  | 'priority-high';

export interface PriorityBadgeConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: PriorityIconName;
}

export type SyncBadgeIconName = 'cloud-upload' | 'sync' | 'error-outline' | 'warning';

export interface SyncBadgeConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: SyncBadgeIconName;
}

/**
 * Mapeia níveis de prioridade para configuração semântica (cor, contraste e ícone).
 */
export function getPriorityConfig(priority?: InspectionPriority | null): PriorityBadgeConfig {
  const normalized = String(priority ?? 'MEDIA')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'CRITICA':
    case 'CRÍTICA':
    case 'URGENTE':
    case 'CRITICAL':
      return {
        label: normalized === 'URGENTE' ? 'Urgente' : 'Crítica',
        color: '#a71d2a',
        backgroundColor: '#f8d7da',
        borderColor: tokens.colors.danger,
        icon: 'priority-high',
      };
    case 'ALTA':
    case 'HIGH':
      return {
        label: 'Alta',
        color: '#b45309',
        backgroundColor: '#ffedd5',
        borderColor: '#f59e0b',
        icon: 'arrow-upward',
      };
    case 'BAIXA':
    case 'LOW':
      return {
        label: 'Baixa',
        color: tokens.colors.secondaryActive,
        backgroundColor: '#e9ecef',
        borderColor: tokens.colors.border,
        icon: 'arrow-downward',
      };
    case 'MEDIA':
    case 'MÉDIA':
    case 'MEDIUM':
    default:
      return {
        label: 'Média',
        color: '#0c5460',
        backgroundColor: '#d1ecf1',
        borderColor: tokens.colors.info,
        icon: 'remove',
      };
  }
}

/**
 * Mapeia estados de sincronização local para exibição clara no card (RF-03).
 */
export function getSyncStatusConfig(
  syncStatus?: InspectionSyncStatus | string | null
): SyncBadgeConfig | null {
  const normalized = String(syncStatus ?? '')
    .trim()
    .toUpperCase();

  switch (normalized) {
    case 'PENDENTE':
      return {
        label: 'Pendente de envio',
        color: '#856404',
        backgroundColor: '#fff3cd',
        borderColor: tokens.colors.warning,
        icon: 'cloud-upload',
      };
    case 'SINCRONIZANDO':
      return {
        label: 'Sincronizando...',
        color: tokens.colors.primary,
        backgroundColor: '#e7f1ff',
        borderColor: tokens.colors.primary,
        icon: 'sync',
      };
    case 'ERRO':
      return {
        label: 'Falha no envio',
        color: '#a71d2a',
        backgroundColor: '#f8d7da',
        borderColor: tokens.colors.danger,
        icon: 'error-outline',
      };
    case 'CONFLITO':
      return {
        label: 'Conflito de envio',
        color: '#a71d2a',
        backgroundColor: '#f8d7da',
        borderColor: tokens.colors.danger,
        icon: 'warning',
      };
    default:
      return null;
  }
}

export interface PriorityBadgeProps {
  priority?: InspectionPriority | null;
  testID?: string;
}

export function PriorityBadge({ priority, testID }: PriorityBadgeProps) {
  const config = getPriorityConfig(priority);

  return (
    <View
      testID={testID}
      style={[
        styles.pillBadge,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
      accessibilityLabel={`Prioridade: ${config.label}`}
    >
      <MaterialIcons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.pillText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export interface SyncStatusBadgeProps {
  syncStatus?: InspectionSyncStatus | string | null;
  testID?: string;
}

export function SyncStatusBadge({ syncStatus, testID }: SyncStatusBadgeProps) {
  const config = getSyncStatusConfig(syncStatus);
  if (!config) {
    return null;
  }

  return (
    <View
      testID={testID}
      style={[
        styles.pillBadge,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
      accessibilityLabel={`Sincronização: ${config.label}`}
    >
      <MaterialIcons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.pillText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function formatDueDate(dueDate?: string | null): string | null {
  if (!dueDate) {
    return null;
  }
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return dueDate;
  }
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export interface InspectionCardProps {
  inspection: Inspection;
  onPress?: (inspection: Inspection) => void;
  isPendingSync?: boolean;
  isOverdue?: boolean;
  referenceDate?: Date;
  testID?: string;
}

/**
 * Card reutilizável de inspeção (TASK-013 Passo 3).
 *
 * - RF-02: Exibe cliente, local/endereço, equipamento, prioridade, estado e data prevista.
 * - RF-03: Diferencia visualmente inspeções atrasadas, em andamento e pendentes de envio.
 */
export const InspectionCard = memo(function InspectionCard({
  inspection,
  onPress,
  isPendingSync: isPendingSyncProp,
  isOverdue: isOverdueProp,
  referenceDate,
  testID = `inspection-card-${inspection.id}`,
}: InspectionCardProps) {
  const overdue =
    isOverdueProp !== undefined
      ? isOverdueProp
      : isInspectionOverdue(inspection, referenceDate);

  const pendingSync =
    isPendingSyncProp !== undefined
      ? isPendingSyncProp
      : isInspectionPendingSync(inspection);

  const normalizedStatus = String(inspection.status ?? '').trim().toUpperCase();
  const isInProgress =
    normalizedStatus === 'EM_ANDAMENTO' || normalizedStatus === 'IN_PROGRESS';
  const isOfflineOnly = !inspection.remote_id;

  const clientName = inspection.client_name || inspection.client || 'Cliente não informado';
  const siteName = inspection.site_name || inspection.site || 'Local não informado';
  const equipmentName = inspection.equipment_name || inspection.equipment;
  const formattedDue = formatDueDate(inspection.due_date);

  const effectiveSyncStatus = pendingSync
    ? inspection.sync_status && inspection.sync_status !== 'SINCRONIZADO'
      ? inspection.sync_status
      : 'PENDENTE'
    : null;

  const accentStyle = overdue
    ? styles.cardOverdue
    : isInProgress
    ? styles.cardInProgress
    : pendingSync
    ? styles.cardPendingSync
    : null;

  return (
    <Card
      testID={testID}
      style={[styles.card, accentStyle]}
      onPress={onPress ? () => onPress(inspection) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Inspeção ${clientName}, ${siteName}, estado ${inspection.status}`}
    >
      {/* Faixa superior de alertas operacionais (RF-03) */}
      {(overdue || isInProgress || isOfflineOnly) && (
        <View style={styles.alertStrip}>
          {overdue && (
            <View
              testID={`${testID}-overdue-badge`}
              style={styles.overdueBadge}
              accessibilityLabel="Inspeção em atraso"
            >
              <MaterialIcons name="warning" size={14} color={tokens.colors.textInverse} />
              <Text style={styles.overdueBadgeText}>EM ATRASO</Text>
            </View>
          )}

          {isInProgress && (
            <View
              testID={`${testID}-in-progress-indicator`}
              style={styles.inProgressBadge}
              accessibilityLabel="Inspeção em andamento"
            >
              <MaterialIcons name="play-circle-filled" size={14} color="#856404" />
              <Text style={styles.inProgressBadgeText}>EM EXECUÇÃO</Text>
            </View>
          )}

          {isOfflineOnly && (
            <View
              testID={`${testID}-offline-badge`}
              style={styles.offlineBadge}
              accessibilityLabel="Salva apenas no dispositivo"
            >
              <MaterialIcons name="cloud-off" size={13} color={tokens.colors.secondaryActive} />
              <Text style={styles.offlineBadgeText}>LOCAL</Text>
            </View>
          )}
        </View>
      )}

      {/* Cabeçalho: Cliente + Prioridade */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.clientName} numberOfLines={2}>
            {clientName}
          </Text>
          {!!inspection.title && (
            <Text style={styles.inspectionTitle} numberOfLines={1}>
              {inspection.title}
            </Text>
          )}
        </View>
        <PriorityBadge
          priority={inspection.priority}
          testID={`${testID}-priority-badge`}
        />
      </View>

      {/* Corpo: Local, Endereço, Equipamento e Prazo */}
      <View style={styles.body}>
        <View style={styles.infoRow}>
          <MaterialIcons name="location-on" size={16} color={tokens.colors.textMuted} />
          <Text style={styles.infoText} numberOfLines={2}>
            {siteName}
            {inspection.site_address ? ` • ${inspection.site_address}` : ''}
          </Text>
        </View>

        {!!equipmentName && (
          <View style={styles.infoRow}>
            <MaterialIcons name="build" size={16} color={tokens.colors.textMuted} />
            <Text style={styles.infoText} numberOfLines={1}>
              {equipmentName}
              {inspection.equipment_code ? ` (${inspection.equipment_code})` : ''}
            </Text>
          </View>
        )}

        {!!formattedDue && (
          <View style={styles.infoRow}>
            <MaterialIcons
              name={overdue ? 'schedule' : 'event'}
              size={16}
              color={overdue ? tokens.colors.danger : tokens.colors.textMuted}
            />
            <Text
              testID={`${testID}-due-date`}
              style={[styles.infoText, overdue && styles.overdueDueText]}
            >
              {overdue ? `Atrasada • Prazo: ${formattedDue}` : `Prevista: ${formattedDue}`}
            </Text>
          </View>
        )}
      </View>

      {/* Rodapé: Status de Negócio + Estado de Envio/Sincronização */}
      <View style={styles.footer}>
        <StatusBadge status={inspection.status as InspectionStatus} />
        {effectiveSyncStatus && (
          <SyncStatusBadge
            syncStatus={effectiveSyncStatus}
            testID={`${testID}-sync-badge`}
          />
        )}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: tokens.spacing.m,
  },
  cardOverdue: {
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.danger,
  },
  cardInProgress: {
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.warning,
  },
  cardPendingSync: {
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.primary,
  },
  alertStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.s,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.danger,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.small,
    gap: 4,
  },
  overdueBadgeText: {
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: tokens.colors.warning,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.small,
    gap: 4,
  },
  inProgressBadgeText: {
    color: '#856404',
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 3,
    borderRadius: tokens.borderRadius.small,
    gap: 4,
  },
  offlineBadgeText: {
    color: tokens.colors.secondaryActive,
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  titleBlock: {
    flex: 1,
  },
  clientName: {
    fontSize: tokens.typography.fontSizes.large - 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  inspectionTitle: {
    marginTop: 2,
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.textMuted,
  },
  body: {
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.m,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
  },
  infoText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.textMuted,
  },
  overdueDueText: {
    color: tokens.colors.danger,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    gap: 4,
  },
  pillText: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    textTransform: 'uppercase',
  },
});
