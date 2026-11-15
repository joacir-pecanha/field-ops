import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import type { EquipmentSummary } from '../services/qrValidator';

export type ManualEntryReason = 'CAMERA_UNAVAILABLE' | 'DAMAGED_QR';

export interface ManualCodeSubmitPayload {
  code: string;
  reason: ManualEntryReason;
  explicitlyConfirmed: boolean;
}

export interface ManualCodeModalProps {
  visible: boolean;
  defaultReason?: ManualEntryReason;
  expectedEquipment?: EquipmentSummary | null;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  initialCode?: string;
  initialConfirmed?: boolean;
  onCancel: () => void;
  onSubmit: (payload: ManualCodeSubmitPayload) => void;
}

export function ManualCodeModal({
  visible,
  defaultReason = 'CAMERA_UNAVAILABLE',
  expectedEquipment,
  isSubmitting = false,
  errorMessage,
  initialCode = '',
  initialConfirmed = false,
  onCancel,
  onSubmit,
}: ManualCodeModalProps) {
  const [reason, setReason] = useState<ManualEntryReason>(defaultReason);
  const [code, setCode] = useState(initialCode);
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setReason(defaultReason);
  }, [defaultReason]);

  useEffect(() => {
    if (!visible) {
      setCode(initialCode);
      setConfirmed(initialConfirmed);
      setLocalError(null);
    }
  }, [visible, initialCode, initialConfirmed]);

  const displayError = localError || errorMessage;

  const handleSubmit = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setLocalError('Informe o código de patrimônio, código do ativo ou QR Code.');
      return;
    }
    if (!confirmed) {
      setLocalError(
        'Marque a confirmação explícita de verificação visual do equipamento antes de prosseguir.'
      );
      return;
    }
    setLocalError(null);
    onSubmit({
      code: trimmed,
      reason,
      explicitlyConfirmed: true,
    });
  };

  if (!visible) {
    return null;
  }

  const content = (
    <View style={styles.backdrop}>
      <View testID="manual-code-modal" style={styles.modalCard}>
        <View style={styles.header}>
          <MaterialIcons name="keyboard" size={24} color={tokens.colors.primary} />
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Identificação Manual do Equipamento</Text>
            <Text style={styles.subtitle}>
              Use quando a câmera estiver indisponível ou a etiqueta QR estiver danificada.
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Motivo da digitação manual (RF-02 / EX-01) */}
          <Text style={styles.fieldLabel}>Motivo da entrada manual</Text>
          <View style={styles.reasonRow}>
            <TouchableOpacity
              testID="manual-reason-camera"
              style={[
                styles.reasonChip,
                reason === 'CAMERA_UNAVAILABLE' && styles.reasonChipActive,
              ]}
              onPress={() => setReason('CAMERA_UNAVAILABLE')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.reasonChipText,
                  reason === 'CAMERA_UNAVAILABLE' && styles.reasonChipTextActive,
                ]}
              >
                Câmera indisponível
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="manual-reason-damaged"
              style={[
                styles.reasonChip,
                reason === 'DAMAGED_QR' && styles.reasonChipActive,
              ]}
              onPress={() => setReason('DAMAGED_QR')}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.reasonChipText,
                  reason === 'DAMAGED_QR' && styles.reasonChipTextActive,
                ]}
              >
                QR danificado / ilegível
              </Text>
            </TouchableOpacity>
          </View>

          {expectedEquipment ? (
            <View style={styles.expectedSummaryBox} testID="manual-expected-summary">
              <Text style={styles.expectedSummaryTitle}>
                Dados esperados para conferência visual:
              </Text>
              <Text style={styles.expectedSummaryText}>
                {expectedEquipment.name}
              </Text>
              <Text style={styles.expectedSummaryMeta}>
                Código: {expectedEquipment.code} • QR: {expectedEquipment.qrCode}
                {expectedEquipment.assetTag
                  ? ` • Patrimônio: ${expectedEquipment.assetTag}`
                  : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>
              Código de patrimônio, código do equipamento ou QR Code *
            </Text>
            <TextInput
              testID="manual-code-input"
              style={[
                styles.codeInput,
                displayError ? styles.inputErrorBorder : null,
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Ex.: PAT-2026-0001, EQP-GD-001 ou QR-FIELDOPS-GD001"
              placeholderTextColor={tokens.colors.textMuted}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (localError) setLocalError(null);
              }}
              editable={!isSubmitting}
            />
          </View>

          <TouchableOpacity
            testID="manual-explicit-confirm-checkbox"
            style={styles.checkboxRow}
            onPress={() => {
              setConfirmed((prev) => !prev);
              if (localError) setLocalError(null);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
          >
            <MaterialIcons
              name={confirmed ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={confirmed ? tokens.colors.primary : tokens.colors.textMuted}
            />
            <Text style={styles.checkboxLabel}>
              Confirmo explicitamente que verifiquei a placa física do equipamento em campo e assumo a correspondência manual deste ativo.
            </Text>
          </TouchableOpacity>

          {displayError ? (
            <Text testID="manual-error-text" style={styles.errorText}>
              {displayError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            testID="manual-code-cancel-btn"
            title="Cancelar"
            variant="secondary"
            disabled={isSubmitting}
            onPress={onCancel}
            style={styles.footerBtn}
          />
          <Button
            testID="manual-code-submit-btn"
            title="Validar e Prosseguir"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={styles.footerBtn}
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
      animationType="slide"
      onRequestClose={onCancel}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  bodyScroll: {
    maxHeight: 380,
  },
  bodyContent: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.m,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
    flexWrap: 'wrap',
  },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
  reasonChipActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#DBEAFE',
  },
  reasonChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  reasonChipTextActive: {
    color: tokens.colors.primaryActive,
  },
  expectedSummaryBox: {
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.s,
    gap: 2,
  },
  expectedSummaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
  },
  expectedSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  expectedSummaryMeta: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  inputGroup: {
    gap: 6,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.s,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  inputErrorBorder: {
    borderColor: tokens.colors.danger,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.danger,
  },
  footer: {
    padding: tokens.spacing.m,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.background,
  },
  footerBtn: {
    width: '100%',
  },
});
