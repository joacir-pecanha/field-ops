import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { tokens } from '../../../../design-system/tokens';
import {
  ConformityState,
  type ConformityStateType,
} from '../../schemas/checklistSchema';

export interface ConformityInputProps {
  value: ConformityStateType | string | null;
  nonConformityDescription?: string | null;
  onChange: (value: ConformityStateType) => void;
  onDescriptionChange?: (description: string) => void;
  error?: string;
  descriptionError?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * ConformityInput (SPEC-003 / TASK-003)
 *
 * Renderiza 3 botões largos para campo: Conforme / Não Conforme / Não Aplicável.
 * RF-02: Ao selecionar 'Não Conforme', abre compulsoriamente a área de descrição da não conformidade.
 * RT-01: Utiliza tokens do design-system para acessibilidade visual e alvos de toque >= 50px.
 */
export const ConformityInput = memo(function ConformityInput({
  value,
  nonConformityDescription = '',
  onChange,
  onDescriptionChange,
  error,
  descriptionError,
  disabled = false,
  testID = 'conformity-input',
}: ConformityInputProps) {
  const isConforming = value === ConformityState.CONFORMING || value === 'CONFORME';
  const isNonConforming = value === ConformityState.NON_CONFORMING || value === 'NAO_CONFORME';
  const isNotApplicable = value === ConformityState.NOT_APPLICABLE || value === 'NAO_APLICAVEL';

  const handleSelect = (selectedState: ConformityStateType) => {
    if (disabled) return;
    onChange(selectedState);
  };

  return (
    <View style={styles.container} testID={testID}>
      {/* Grupo de 3 Botões Principais */}
      <View style={styles.buttonRow}>
        {/* 1. Conforme */}
        <TouchableOpacity
          testID={`${testID}-conforming`}
          accessibilityRole="button"
          accessibilityState={{ selected: isConforming, disabled }}
          accessibilityLabel="Conforme"
          activeOpacity={0.8}
          disabled={disabled}
          style={[
            styles.optionButton,
            isConforming && styles.conformingActive,
            disabled && styles.disabledButton,
          ]}
          onPress={() => handleSelect(ConformityState.CONFORMING)}
        >
          <Text
            style={[
              styles.buttonText,
              isConforming && styles.conformingActiveText,
              disabled && styles.disabledText,
            ]}
          >
            ✓ Conforme
          </Text>
        </TouchableOpacity>

        {/* 2. Não Conforme */}
        <TouchableOpacity
          testID={`${testID}-non-conforming`}
          accessibilityRole="button"
          accessibilityState={{ selected: isNonConforming, disabled }}
          accessibilityLabel="Não Conforme"
          activeOpacity={0.8}
          disabled={disabled}
          style={[
            styles.optionButton,
            isNonConforming && styles.nonConformingActive,
            disabled && styles.disabledButton,
          ]}
          onPress={() => handleSelect(ConformityState.NON_CONFORMING)}
        >
          <Text
            style={[
              styles.buttonText,
              isNonConforming && styles.nonConformingActiveText,
              disabled && styles.disabledText,
            ]}
          >
            ✕ Não Conforme
          </Text>
        </TouchableOpacity>

        {/* 3. Não Aplicável */}
        <TouchableOpacity
          testID={`${testID}-not-applicable`}
          accessibilityRole="button"
          accessibilityState={{ selected: isNotApplicable, disabled }}
          accessibilityLabel="Não Aplicável"
          activeOpacity={0.8}
          disabled={disabled}
          style={[
            styles.optionButton,
            isNotApplicable && styles.notApplicableActive,
            disabled && styles.disabledButton,
          ]}
          onPress={() => handleSelect(ConformityState.NOT_APPLICABLE)}
        >
          <Text
            style={[
              styles.buttonText,
              isNotApplicable && styles.notApplicableActiveText,
              disabled && styles.disabledText,
            ]}
          >
            N/A
          </Text>
        </TouchableOpacity>
      </View>

      {/* Erro de seleção geral */}
      {!!error && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      )}

      {/* RF-02: Área Compulsória de Registro de Descrição da Não Conformidade */}
      {isNonConforming && (
        <View
          style={styles.nonConformityContainer}
          testID={`${testID}-description-container`}
        >
          <View style={styles.nonConformityHeader}>
            <Text style={styles.nonConformityAlertBadge}>⚠ NÃO CONFORMIDADE APONTADA</Text>
            <Text style={styles.compulsoryBadge}>Obrigatório *</Text>
          </View>

          <Text style={styles.descriptionLabel}>
            Descreva detalhadamente a irregularidade identificada:
          </Text>

          <TextInput
            testID={`${testID}-description-input`}
            style={[
              styles.descriptionInput,
              !!descriptionError && styles.descriptionInputError,
              disabled && styles.disabledInput,
            ]}
            value={nonConformityDescription ?? ''}
            onChangeText={onDescriptionChange}
            placeholder="Ex: Lacre violado, manômetro zerado, cabos com isolamento rompido..."
            placeholderTextColor={tokens.colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!disabled}
            accessibilityLabel="Descrição da não conformidade"
          />

          {!!descriptionError ? (
            <Text
              style={styles.errorText}
              testID={`${testID}-description-error`}
              accessibilityRole="alert"
            >
              {descriptionError}
            </Text>
          ) : (
            <Text style={styles.hintText}>
              Este apontamento será registrado na lista de não conformidades da inspeção.
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: tokens.spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
    justifyContent: 'space-between',
  },
  optionButton: {
    flex: 1,
    minHeight: 52, // Alvo de toque ergonômico para uso em campo
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.s,
  },
  buttonText: {
    fontSize: tokens.typography.fontSizes.small + 2, // 14px
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
    textAlign: 'center',
  },
  // Estados ativos com alto contraste
  conformingActive: {
    backgroundColor: '#e8f5e9',
    borderColor: tokens.colors.success,
    borderWidth: 2,
  },
  conformingActiveText: {
    color: tokens.colors.success,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  nonConformingActive: {
    backgroundColor: '#ffebee',
    borderColor: tokens.colors.danger,
    borderWidth: 2,
  },
  nonConformingActiveText: {
    color: tokens.colors.danger,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  notApplicableActive: {
    backgroundColor: '#f1f3f5',
    borderColor: tokens.colors.secondary,
    borderWidth: 2,
  },
  notApplicableActiveText: {
    color: tokens.colors.secondary,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: tokens.colors.background,
  },
  disabledText: {
    color: tokens.colors.textMuted,
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
  // Container de Não Conformidade (RF-02)
  nonConformityContainer: {
    marginTop: tokens.spacing.m,
    padding: tokens.spacing.m,
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
  },
  nonConformityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  nonConformityAlertBadge: {
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.danger,
  },
  compulsoryBadge: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.danger,
    backgroundColor: '#fed7d7',
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.small,
  },
  descriptionLabel: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
  },
  descriptionInput: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.s,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.text,
  },
  descriptionInputError: {
    borderColor: tokens.colors.danger,
    borderWidth: 1.5,
  },
  disabledInput: {
    backgroundColor: tokens.colors.background,
    opacity: 0.6,
  },
  hintText: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
});
