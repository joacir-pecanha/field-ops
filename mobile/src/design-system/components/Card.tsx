import React from 'react';
import { View, StyleSheet, ViewProps, TouchableOpacity } from 'react-native';
import { tokens } from '../tokens';

interface CardProps extends ViewProps {
  onPress?: () => void;
}

export function Card({ style, children, onPress, ...props }: CardProps) {
  const CardComponent = onPress ? TouchableOpacity : View;
  const touchableProps = onPress ? { activeOpacity: 0.8, onPress } : {};

  return (
    <CardComponent 
      style={[styles.card, style]} 
      {...touchableProps}
      {...props as any}
    >
      {children}
    </CardComponent>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    padding: tokens.spacing.m,
    marginBottom: tokens.spacing.m,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    // Sombra leve para destacar
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});
