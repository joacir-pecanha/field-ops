import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface NumericInputProps {
  value: number | string | null;
  onChange: (value: number | null) => void;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  testID?: string;
}

/**
 * NumericInput (SPEC-003 / TASK-003)
 *
 * Input numérico ergonômico com suporte a digitação decimal e botões de incremento/decremento.
 * Ideal para inspeções em campo com uso de luvas ou medições rápidas.
 */
export const NumericInput = memo(function NumericInput({
  value,
  onChange,
  error,
  disabled = false,
  min,
  max,
  step = 1,
  placeholder = '0',
  testID = 'numeric-input',
}: NumericInputProps) {
  const [internalText, setInternalText] = useState<string>(
    value !== null && value !== undefined ? String(value) : ''
  );

  useEffect(() => {
    setInternalText(value !== null && value !== undefined ? String(value) : '');
  }, [value]);

  const parseNumber = (text: string): number | null => {
    if (!text || text.trim() === '') return null;
    const sanitized = text.replace(',', '.').trim();
    const parsed = Number(sanitized);
    return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
  };

  const handleTextChange = (text: string) => {
    setInternalText(text);
    const parsed = parseNumber(text);
    onChange(parsed);
  };

  const handleStep = (direction: 'up' | 'down') => {
    if (disabled) return;
    const currentNum = parseNumber(internalText) ?? (min !== undefined ? min : 0);
    const delta = direction === 'up' ? step : -step;
    let nextNum = Number((currentNum + delta).toFixed(2));

    if (min !== undefined && nextNum < min) nextNum = min;
    if (max !== undefined && nextNum > max) nextNum = max;

    const nextStr = String(nextNum);
    setInternalText(nextStr);
    onChange(nextNum);
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.inputRow}>
        {/* Botão Decrementar (-) */}
        <TouchableOpacity
          testID={`${testID}-decrement`}
          style={[styles.stepButton, disabled && styles.disabledButton]}
          onPress={() => handleStep('down')}
          disabled={disabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Diminuir valor"
        >
          <Text style={styles.stepButtonText}>−</Text>
        </TouchableOpacity>

        {/* Campo de Entrada Numérica */}
        <TextInput
          testID={`${testID}-input`}
          style={[
            styles.input,
            !!error && styles.inputError,
            disabled && styles.disabledInput,
          ]}
          value={internalText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textMuted}
          keyboardType="decimal-pad"
          editable={!disabled}
          accessibilityLabel="Valor numérico"
        />

        {/* Botão Incrementar (+) */}
        <TouchableOpacity
          testID={`${testID}-increment`}
          style={[styles.stepButton, disabled && styles.disabledButton]}
          onPress={() => handleStep('up')}
          disabled={disabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Aumentar valor"
        >
          <Text style={styles.stepButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Indicador de limites Min / Max */}
      {(min !== undefined || max !== undefined) && (
        <View style={styles.limitsRow}>
          {min !== undefined && (
            <Text style={styles.limitBadge}>Mín: {min}</Text>
          )}
          {max !== undefined && (
            <Text style={styles.limitBadge}>Máx: {max}</Text>
          )}
        </View>
      )}

      {/* Mensagem de Erro */}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    fontSize: tokens.typography.fontSizes.regular + 2,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
    textAlign: 'center',
  },
  inputError: {
    borderColor: tokens.colors.danger,
    borderWidth: 1.5,
  },
  disabledInput: {
    backgroundColor: tokens.colors.background,
    opacity: 0.6,
  },
  disabledButton: {
    borderColor: tokens.colors.border,
    opacity: 0.5,
  },
  limitsRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.xs,
  },
  limitBadge: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
    backgroundColor: tokens.colors.background,
    paddingHorizontal: tokens.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.small,
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
});
