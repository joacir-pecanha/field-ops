import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface ShortTextInputProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  testID?: string;
}

/**
 * ShortTextInput (SPEC-003 / TASK-003)
 *
 * Input de linha única com contador de caracteres, botão de limpeza rápida e alto contraste.
 * RT-02: Gerencia estado interno para digitação instantânea sem renderizar itens irmãos.
 */
export const ShortTextInput = memo(function ShortTextInput({
  value,
  onChange,
  error,
  disabled = false,
  maxLength = 255,
  placeholder = 'Digite a resposta...',
  testID = 'short-text-input',
}: ShortTextInputProps) {
  const [internalText, setInternalText] = useState(value ?? '');

  useEffect(() => {
    setInternalText(value ?? '');
  }, [value]);

  const handleChange = (text: string) => {
    setInternalText(text);
    onChange(text);
  };

  const handleClear = () => {
    if (disabled) return;
    setInternalText('');
    onChange('');
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.inputWrapper}>
        <TextInput
          testID={`${testID}-input`}
          style={[
            styles.input,
            !!error && styles.inputError,
            disabled && styles.disabledInput,
          ]}
          value={internalText}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textMuted}
          maxLength={maxLength}
          editable={!disabled}
          accessibilityLabel="Entrada de texto curto"
        />

        {!!internalText && !disabled && (
          <TouchableOpacity
            testID={`${testID}-clear`}
            style={styles.clearButton}
            onPress={handleClear}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpar texto"
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footerRow}>
        {!!error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : (
          <View />
        )}
        <Text style={styles.counterText}>
          {internalText.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: tokens.spacing.xs,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingRight: 48,
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
  clearButton: {
    position: 'absolute',
    right: tokens.spacing.s,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
  },
  counterText: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
    marginLeft: 'auto',
  },
  errorText: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.danger,
    flex: 1,
  },
});
