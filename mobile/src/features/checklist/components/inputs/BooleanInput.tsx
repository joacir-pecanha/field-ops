import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface BooleanInputProps {
  value: boolean | string | null;
  onChange: (value: boolean) => void;
  error?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * BooleanInput (SPEC-003 / TASK-003)
 *
 * Seletor binário (Sim / Não) em formato de botões largos com feedback tátil e visual de alto contraste.
 */
export const BooleanInput = memo(function BooleanInput({
  value,
  onChange,
  error,
  disabled = false,
  testID = 'boolean-input',
}: BooleanInputProps) {
  let isTrue = false;
  let isFalse = false;

  if (value === true || value === 'true' || value === 'sim' || value === 'SIM') {
    isTrue = true;
  } else if (value === false || value === 'false' || value === 'nao' || value === 'não' || value === 'NAO') {
    isFalse = true;
  }

  const handleSelect = (val: boolean) => {
    if (disabled) return;
    onChange(val);
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.buttonRow}>
        {/* Opção Sim */}
        <TouchableOpacity
          testID={`${testID}-yes`}
          accessibilityRole="button"
          accessibilityState={{ selected: isTrue, disabled }}
          accessibilityLabel="Sim"
          activeOpacity={0.8}
          disabled={disabled}
          style={[
            styles.optionButton,
            isTrue && styles.yesButtonSelected,
            disabled && styles.disabledButton,
          ]}
          onPress={() => handleSelect(true)}
        >
          <Text
            style={[
              styles.buttonText,
              isTrue && styles.yesButtonTextSelected,
              disabled && styles.disabledText,
            ]}
          >
            ✓ Sim
          </Text>
        </TouchableOpacity>

        {/* Opção Não */}
        <TouchableOpacity
          testID={`${testID}-no`}
          accessibilityRole="button"
          accessibilityState={{ selected: isFalse, disabled }}
          accessibilityLabel="Não"
          activeOpacity={0.8}
          disabled={disabled}
          style={[
            styles.optionButton,
            isFalse && styles.noButtonSelected,
            disabled && styles.disabledButton,
          ]}
          onPress={() => handleSelect(false)}
        >
          <Text
            style={[
              styles.buttonText,
              isFalse && styles.noButtonTextSelected,
              disabled && styles.disabledText,
            ]}
          >
            ✕ Não
          </Text>
        </TouchableOpacity>
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
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.m,
  },
  optionButton: {
    flex: 1,
    minHeight: 52, // Ergonomia para campo
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.s,
  },
  buttonText: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  yesButtonSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: '#e8f0fe',
    borderWidth: 2,
  },
  yesButtonTextSelected: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  noButtonSelected: {
    borderColor: tokens.colors.secondary,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
  },
  noButtonTextSelected: {
    color: tokens.colors.text,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  disabledButton: {
    backgroundColor: tokens.colors.background,
    opacity: 0.5,
  },
  disabledText: {
    color: tokens.colors.textMuted,
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
});
