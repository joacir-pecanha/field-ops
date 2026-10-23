import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tokens } from '../tokens';
import { MaterialIcons } from '@expo/vector-icons'; // Assumindo uso do vector-icons nativo do Expo

export type InspectionStatus = 
  | 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  | 'RASCUNHO' | 'ATRIBUÍDA' | 'EM_ANDAMENTO' | 'ENVIADA' | 'EM_REVISÃO' | 'APROVADA' | 'REPROVADA' | 'CANCELADA';

interface StatusBadgeProps {
  status: InspectionStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: InspectionStatus | string) => {
    switch (status) {
      case 'DRAFT':
      case 'RASCUNHO':
        return { label: 'Rascunho', color: tokens.colors.secondary, icon: 'edit' as const };
      case 'ASSIGNED':
      case 'ATRIBUÍDA':
        return { label: 'Atribuída', color: tokens.colors.info, icon: 'assignment-ind' as const };
      case 'IN_PROGRESS':
      case 'EM_ANDAMENTO':
        return { label: 'Em Andamento', color: tokens.colors.warning, icon: 'play-circle-outline' as const };
      case 'SUBMITTED':
      case 'ENVIADA':
        return { label: 'Enviada', color: tokens.colors.primary, icon: 'cloud-upload' as const };
      case 'IN_REVIEW':
      case 'EM_REVISÃO':
        return { label: 'Em Revisão', color: tokens.colors.warning, icon: 'rate-review' as const };
      case 'APPROVED':
      case 'APROVADA':
        return { label: 'Aprovada', color: tokens.colors.success, icon: 'check-circle' as const };
      case 'REJECTED':
      case 'REPROVADA':
        return { label: 'Reprovada/Correção', color: tokens.colors.danger, icon: 'cancel' as const };
      case 'CANCELLED':
      case 'CANCELADA':
        return { label: 'Cancelada', color: tokens.colors.secondaryActive, icon: 'block' as const };
      default:
        return { label: 'Desconhecido', color: tokens.colors.secondary, icon: 'help-outline' as const };
    }
  };

  const config = getStatusConfig(status);

  return (
    <View style={[styles.container, { borderColor: config.color }]} accessibilityLabel={`Estado: ${config.label}`}>
      <MaterialIcons name={config.icon} size={16} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surface,
  },
  text: {
    marginLeft: tokens.spacing.xs,
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.bold,
    textTransform: 'uppercase',
  },
});
