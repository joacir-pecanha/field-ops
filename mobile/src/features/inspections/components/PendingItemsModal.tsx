import React from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import type { PendingInspectionItem } from '../hooks/useInspectionProgress';

export interface PendingItemsModalProps {
  visible: boolean;
  pendingItems: PendingInspectionItem[];
  onClose: () => void;
  onSelectItem: (item: PendingInspectionItem) => void;
}

/**
 * Modal bloqueante exibido ao tentar concluir uma inspeção com itens obrigatórios pendentes (RF-05, RF-06, CA-02).
 * Lista cada pendência com seção e atalho direto para preenchimento no checklist.
 */
export function PendingItemsModal({
  visible,
  pendingItems,
  onClose,
  onSelectItem,
}: PendingItemsModalProps) {
  if (!visible) {
    return null;
  }

  const count = pendingItems.length;
  const content = (
    <View style={styles.backdrop}>
      <View
        testID="pending-items-modal"
        accessibilityRole="alert"
        style={styles.dialogCard}
      >
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <MaterialIcons name="assignment-late" size={26} color={tokens.colors.danger} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Conclusão Bloqueada</Text>
            <Text style={styles.headerSubtitle}>
              {count === 1
                ? 'Existe 1 item obrigatório pendente de preenchimento.'
                : `Existem ${count} itens obrigatórios pendentes de preenchimento.`}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
        >
          <Text style={styles.instructionText}>
            Toque em um item abaixo para ir diretamente ao campo pendente e concluir o checklist:
          </Text>

          {pendingItems.map((entry, idx) => (
            <TouchableOpacity
              key={entry.itemId}
              testID={`pending-item-shortcut-${entry.itemId}`}
              style={styles.itemRow}
              activeOpacity={0.75}
              onPress={() => onSelectItem(entry)}
              accessibilityRole="button"
              accessibilityLabel={`Preencher item pendente ${entry.title}`}
            >
              <View style={styles.itemIndexBadge}>
                <Text style={styles.itemIndexText}>{idx + 1}</Text>
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemSection}>{entry.sectionTitle}</Text>
                <Text style={styles.itemTitle}>
                  {entry.title} <Text style={styles.requiredMark}>*</Text>
                </Text>
                <Text style={styles.itemReason}>{entry.reasonLabel}</Text>
              </View>
              <View style={styles.shortcutPill}>
                <Text style={styles.shortcutText}>Preencher</Text>
                <MaterialIcons name="chevron-right" size={18} color={tokens.colors.primary} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            testID="pending-items-close-btn"
            title="Voltar ao Checklist"
            variant="secondary"
            onPress={onClose}
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document === 'undefined') {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    borderWidth: 2,
    borderColor: tokens.colors.danger,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF2F2',
    padding: tokens.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#991B1B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7F1D1D',
    marginTop: 2,
    lineHeight: 18,
  },
  listScroll: {
    maxHeight: 360,
  },
  listContent: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  instructionText: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.xs,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: tokens.borderRadius.medium,
  },
  itemIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIndexText: {
    color: tokens.colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
  },
  itemSection: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 1,
  },
  requiredMark: {
    color: tokens.colors.danger,
  },
  itemReason: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
  },
  shortcutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  footer: {
    padding: tokens.spacing.m,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
});
