import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import { tokens } from '../tokens';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export function Button({ title, variant = 'primary', isLoading = false, style, disabled, ...props }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  let backgroundColor = tokens.colors.primary;
  let textColor = tokens.colors.textInverse;

  if (isDanger) {
    backgroundColor = tokens.colors.danger;
  } else if (isSecondary) {
    backgroundColor = tokens.colors.secondary;
  }

  if (disabled) {
    backgroundColor = tokens.colors.border;
    textColor = tokens.colors.textMuted;
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }, style]}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.l,
    borderRadius: tokens.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52, // Área de toque acessível para campo
  },
  text: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
  },
});
