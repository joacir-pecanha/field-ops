import React, { useState } from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, tokens } from '@/design-system';
import { useAuthStore } from '@/features/auth/store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = () => {
    setIsLoading(true);
    // Simula uma chamada de API
    setTimeout(() => {
      setIsLoading(false);
      login(email);
    }, 1000);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>FieldOps</Text>
          <Text style={styles.subtitle}>Acesse suas inspeções</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="E-mail"
            placeholder="tecnico@empresa.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            label="Senha"
            placeholder="Sua senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button 
            title="Entrar" 
            onPress={handleLogin} 
            isLoading={isLoading}
            disabled={!email || !password}
          />
          
          <Text style={styles.offlineNotice}>
            Modo offline disponível após o primeiro acesso com rede.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.l,
  },
  header: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
  },
  form: {
    width: '100%',
  },
  offlineNotice: {
    marginTop: tokens.spacing.l,
    textAlign: 'center',
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSizes.small,
  },
});
