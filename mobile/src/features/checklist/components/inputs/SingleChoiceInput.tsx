import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface SingleChoiceInputProps {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * SingleChoiceInput (SPEC-003 / TASK-003)
 *
 * Renderiza lista de opções em formato de rádio com botões largos adequados para campo.
 */
export const SingleChoiceInput = memo(function SingleChoiceInput({
  value,
  options,
  onChange,
  error,
  disabled = false,
  testID = 'single-choice-input',
}: SingleChoiceInputProps) {
  if (!options || options.length === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <Text style={styles.emptyText}>Nenhuma opção disponível para este item.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.optionsList}>
        {options.map((option, index) => {
          const isSelected = value === option;
          const optionTestId = `${testID}-option-${index}`;

          return (
            <TouchableOpacity
              key={`${option}-${index}`}
              testID={optionTestId}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={option}
              activeOpacity={0.7}
              disabled={disabled}
              style={[
                styles.optionItem,
                isSelected && styles.optionItemSelected,
                disabled && styles.disabledItem,
              ]}
              onPress={() => onChange(option)}
            >
              {/* Indicador de Rádio */}
              <View
                style={[
                  styles.radioOuter,
                  isSelected && styles.radioOuterSelected,
                  disabled && styles.radioDisabled,
                ]}
              >
                {isSelected && <View style={styles.radioInner} />}
              </View>

              {/* Texto da Opção */}
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                  disabled && styles.disabledText,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!!error && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: tokens.spacing.xs,
  },
  optionsList: {
    gap: tokens.spacing.s,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52, // Alvo de toque ergonômico
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.s,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
  },
  optionItemSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#f0f7ff',
  },
  disabledItem: {
    backgroundColor: tokens.colors.background,
    opacity: 0.6,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.m,
  },
  radioOuterSelected: {
    borderColor: tokens.colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
  },
  radioDisabled: {
    borderColor: tokens.colors.border,
  },
  optionText: {
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  disabledText: {
    color: tokens.colors.textMuted,
  },
  emptyText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
    padding: tokens.spacing.s,
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
});
