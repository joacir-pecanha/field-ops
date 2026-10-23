import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { TextInput, Button, tokens } from '@/design-system';
import { useAuth } from '@/features/auth/context/AuthContext';
import { loginSchema } from '@/features/auth/schemas/authSchemas';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const { login, isLoading, error: authError, clearError } = useAuth();

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (authError) {
      clearError();
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (authError) {
      clearError();
    }
  };

  const handleLogin = async () => {
    clearError();
    // Validação com schema Zod (RT-04)
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const formattedErrors: { email?: string; password?: string } = {};
      validation.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as 'email' | 'password';
        if (fieldName && !formattedErrors[fieldName]) {
          formattedErrors[fieldName] = issue.message;
        }
      });
      setFieldErrors(formattedErrors);
      return;
    }

    setFieldErrors({});

    try {
      await login({
        email: validation.data.email,
        password: validation.data.password,
      });
    } catch {
      // O erro já é registrado no estado pelo authStore e exibido no banner de alerta
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>FieldOps</Text>
          <Text style={styles.subtitle}>Acesse suas inspeções</Text>
        </View>

        <View style={styles.form}>
          {authError && (
            <View
              style={styles.errorBanner}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          )}

          <TextInput
            label="E-mail"
            placeholder="tecnico@empresa.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={handleEmailChange}
            error={fieldErrors.email}
            accessibilityLabel="Campo de e-mail"
            accessibilityHint="Informe seu e-mail cadastrado"
            editable={!isLoading}
          />

          <TextInput
            label="Senha"
            placeholder="Sua senha"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={handlePasswordChange}
            error={fieldErrors.password}
            accessibilityLabel="Campo de senha"
            accessibilityHint="Informe sua senha de acesso"
            editable={!isLoading}
          />

          <Button
            title="Entrar"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={isLoading || !email.trim() || !password}
            accessibilityLabel="Botão entrar"
            accessibilityHint="Toque para autenticar e entrar no aplicativo"
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
  errorBanner: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.m,
    marginBottom: tokens.spacing.m,
  },
  errorBannerText: {
    color: tokens.colors.danger,
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.medium,
    textAlign: 'center',
  },
  offlineNotice: {
    marginTop: tokens.spacing.l,
    textAlign: 'center',
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSizes.small,
  },
});
