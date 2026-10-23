import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface DateInputProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  testID?: string;
}

/**
 * Retorna a data atual no formato ISO 8601 (YYYY-MM-DD)
 */
function getTodayIsoString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DateInput (SPEC-003 / TASK-003)
 *
 * Seletor de data compatível com campo e com o padrão ISO 8601 (YYYY-MM-DD).
 * Inclui atalho 'Hoje' para agilizar preenchimento de checklists em campo.
 */
export const DateInput = memo(function DateInput({
  value,
  onChange,
  error,
  disabled = false,
  minDate,
  maxDate,
  testID = 'date-input',
}: DateInputProps) {
  const [internalText, setInternalText] = useState(value ?? '');

  useEffect(() => {
    setInternalText(value ?? '');
  }, [value]);

  const handleTextChange = (text: string) => {
    setInternalText(text);
    onChange(text);
  };

  const handleSelectToday = () => {
    if (disabled) return;
    const today = getTodayIsoString();
    setInternalText(today);
    onChange(today);
  };

  const handleClear = () => {
    if (disabled) return;
    setInternalText('');
    onChange('');
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.inputRow}>
        <TextInput
          testID={`${testID}-text-input`}
          style={[
            styles.input,
            !!error && styles.inputError,
            disabled && styles.disabledInput,
          ]}
          value={internalText}
          onChangeText={handleTextChange}
          placeholder="AAAA-MM-DD (ex: 2026-10-23)"
          placeholderTextColor={tokens.colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          editable={!disabled}
          accessibilityLabel="Data no formato AAAA-MM-DD"
        />

        {/* Atalho 'Hoje' */}
        <TouchableOpacity
          testID={`${testID}-today-button`}
          style={[styles.todayButton, disabled && styles.disabledButton]}
          onPress={handleSelectToday}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Preencher data de hoje"
        >
          <Text style={styles.todayButtonText}>Hoje</Text>
        </TouchableOpacity>

        {/* Botão Limpar */}
        {!!internalText && !disabled && (
          <TouchableOpacity
            testID={`${testID}-clear-button`}
            style={styles.clearButton}
            onPress={handleClear}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpar data"
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dica de limites quando houver */}
      {(minDate || maxDate) && (
        <Text style={styles.limitsText}>
          {minDate ? `Mín: ${minDate} ` : ''}
          {maxDate ? `Máx: ${maxDate}` : ''}
        </Text>
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
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.text,
  },
  inputError: {
    borderColor: tokens.colors.danger,
    borderWidth: 1.5,
  },
  disabledInput: {
    backgroundColor: tokens.colors.background,
    opacity: 0.6,
  },
  todayButton: {
    minHeight: 52,
    paddingHorizontal: tokens.spacing.m,
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  clearButton: {
    minHeight: 52,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  clearButtonText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: tokens.colors.border,
  },
  limitsText: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
  },
});
