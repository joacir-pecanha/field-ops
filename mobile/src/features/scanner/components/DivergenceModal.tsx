import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import {
  MIN_DIVERGENCE_JUSTIFICATION_LENGTH,
  type EquipmentSummary,
} from '../services/qrValidator';

export interface DivergenceModalProps {
  visible: boolean;
  expectedEquipment?: EquipmentSummary | null;
  scannedEquipment?: EquipmentSummary | null;
  scannedCode: string;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirmOverride: (justification: string) => void;
}

export function DivergenceModal({
  visible,
  expectedEquipment,
  scannedEquipment,
  scannedCode,
  isSubmitting = false,
  errorMessage,
  onCancel,
  onConfirmOverride,
}: DivergenceModalProps) {
  const [justification, setJustification] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setJustification('');
      setLocalError(null);
    }
  }, [visible, scannedCode]);

  const trimmed = justification.trim();
  const remainingChars = Math.max(0, MIN_DIVERGENCE_JUSTIFICATION_LENGTH - trimmed.length);
  const displayError = localError || errorMessage;

  const handleConfirmPress = () => {
    if (trimmed.length < MIN_DIVERGENCE_JUSTIFICATION_LENGTH) {
      setLocalError(
        `Justificativa obrigatória com no mínimo ${MIN_DIVERGENCE_JUSTIFICATION_LENGTH} caracteres.`
      );
      return;
    }
    setLocalError(null);
    onConfirmOverride(trimmed);
  };

  if (!visible) {
    return null;
  }

  const content = (
    <View style={styles.backdrop}>
      <View
        testID="divergence-modal"
        accessibilityRole="alert"
        style={styles.dialogCard}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertIconBadge}>
            <MaterialIcons name="warning" size={26} color={tokens.colors.danger} />
          </View>
          <View style={styles.alertHeaderText}>
            <Text style={styles.alertTitle}>Divergência de Equipamento</Text>
            <Text style={styles.alertSubtitle}>
              O QR Code lido não confere com o equipamento previsto para esta inspeção.
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Comparativo Lado a Lado: Esperado vs Lido (RF-06 / CA-02) */}
          <View style={styles.comparisonContainer}>
            <View testID="divergence-expected-card" style={styles.expectedCard}>
              <Text style={styles.cardTagExpected}>EQUIPAMENTO ESPERADO</Text>
              <Text style={styles.equipmentName}>
                {expectedEquipment?.name || 'Equipamento não informado'}
              </Text>
              <Text style={styles.equipmentMeta}>
                Código: {expectedEquipment?.code || 'N/D'}
              </Text>
              <Text style={styles.equipmentMeta}>
                QR Previsto: {expectedEquipment?.qrCode || 'N/D'}
              </Text>
              {expectedEquipment?.siteName ? (
                <Text style={styles.equipmentSite}>{expectedEquipment.siteName}</Text>
              ) : null}
            </View>

            <View testID="divergence-scanned-card" style={styles.scannedCard}>
              <Text style={styles.cardTagScanned}>QR CODE LIDO NO CAMPO</Text>
              <Text style={styles.equipmentName}>
                {scannedEquipment?.name || 'Equipamento divergente'}
              </Text>
              <Text style={styles.equipmentMeta}>
                Código: {scannedEquipment?.code || 'N/D'}
              </Text>
              <Text style={styles.equipmentMeta}>
                QR Lido: {scannedEquipment?.qrCode || scannedCode}
              </Text>
              {scannedEquipment?.siteName ? (
                <Text style={styles.equipmentSite}>{scannedEquipment.siteName}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.justificationBox}>
            <Text style={styles.justificationLabel}>
              Justificativa técnica para prosseguir *
            </Text>
            <TextInput
              testID="divergence-justification-input"
              style={[
                styles.justificationInput,
                displayError ? styles.inputErrorBorder : null,
              ]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="Ex.: Etiqueta substituída recentemente ou equipamento reserva em operação..."
              placeholderTextColor={tokens.colors.textMuted}
              value={justification}
              onChangeText={(text) => {
                setJustification(text);
                if (localError) setLocalError(null);
              }}
              editable={!isSubmitting}
            />
            <Text style={styles.helperText}>
              {remainingChars > 0
                ? `Faltam ${remainingChars} caracteres para liberar a confirmação.`
                : 'Justificativa mínima atendida. A auditoria registrará sua confirmação.'}
            </Text>
            {displayError ? (
              <Text testID="divergence-error-text" style={styles.errorText}>
                {displayError}
              </Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footerActions}>
          <Button
            testID="divergence-cancel-btn"
            title="Cancelar Leitura"
            variant="secondary"
            disabled={isSubmitting}
            onPress={onCancel}
            style={styles.actionBtn}
          />
          <Button
            testID="divergence-confirm-btn"
            title="Confirmar com Justificativa"
            variant="danger"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleConfirmPress}
            style={styles.actionBtn}
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
      onRequestClose={onCancel}
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
    maxHeight: '90%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    borderWidth: 2,
    borderColor: tokens.colors.danger,
    overflow: 'hidden',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF2F2',
    padding: tokens.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  alertIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertHeaderText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#991B1B',
  },
  alertSubtitle: {
    fontSize: 13,
    color: '#7F1D1D',
    marginTop: 2,
  },
  bodyScroll: {
    maxHeight: 380,
  },
  bodyContent: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.m,
  },
  comparisonContainer: {
    gap: tokens.spacing.s,
  },
  expectedCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
  },
  scannedCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
  },
  cardTagExpected: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primaryActive,
    marginBottom: 4,
  },
  cardTagScanned: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.danger,
    marginBottom: 4,
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
    marginBottom: 2,
  },
  equipmentMeta: {
    fontSize: 12,
    color: tokens.colors.text,
  },
  equipmentSite: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  justificationBox: {
    gap: 6,
  },
  justificationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  justificationInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.background,
    padding: tokens.spacing.s,
    minHeight: 84,
    fontSize: 14,
    color: tokens.colors.text,
  },
  inputErrorBorder: {
    borderColor: tokens.colors.danger,
  },
  helperText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.danger,
  },
  footerActions: {
    padding: tokens.spacing.m,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.background,
  },
  actionBtn: {
    width: '100%',
  },
});
