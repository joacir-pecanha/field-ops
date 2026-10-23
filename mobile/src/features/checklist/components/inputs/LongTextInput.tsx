import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { tokens } from '../../../../design-system/tokens';

export interface LongTextInputProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  testID?: string;
}

/**
 * LongTextInput (SPEC-003 / TASK-003)
 *
 * Área de texto multilinha com rolagem interna, contador de caracteres e altura confortável.
 */
export const LongTextInput = memo(function LongTextInput({
  value,
  onChange,
  error,
  disabled = false,
  maxLength = 2000,
  placeholder = 'Descreva detalhadamente as observações ou medições...',
  testID = 'long-text-input',
}: LongTextInputProps) {
  const [internalText, setInternalText] = useState(value ?? '');

  useEffect(() => {
    setInternalText(value ?? '');
  }, [value]);

  const handleChange = (text: string) => {
    setInternalText(text);
    onChange(text);
  };

  return (
    <View style={styles.container} testID={testID}>
      <TextInput
        testID={`${testID}-input`}
        style={[
          styles.textArea,
          !!error && styles.inputError,
          disabled && styles.disabledInput,
        ]}
        value={internalText}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        multiline
        numberOfLines={4}
        maxLength={maxLength}
        textAlignVertical="top"
        editable={!disabled}
        accessibilityLabel="Entrada de texto longo"
      />

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
  textArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.m,
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
