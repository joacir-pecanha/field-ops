import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { initDatabase } from '@/infrastructure/database';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/design-system/tokens';

function NavigationGuard() {
  const { isAuthenticated, isInitialized, initializeAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbInitialized(true))
      .catch((e) => console.error('Failed to initialize database', e));
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isInitialized || !dbInitialized) return;

    const inProtectedGroup = segments[0] === '(protected)';

    if (!isAuthenticated && inProtectedGroup) {
      // Redireciona para o login se não estiver autenticado e tentar acessar uma rota protegida (RT-03)
      router.replace('/(public)/login');
    } else if (isAuthenticated && !inProtectedGroup) {
      // Redireciona para o início protegido se já estiver autenticado e tentar acessar rotas públicas
      router.replace('/(protected)/(tabs)');
    }
  }, [isAuthenticated, isInitialized, dbInitialized, segments, router]);

  if (!dbInitialized || !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.loadingText}>Iniciando FieldOps...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(protected)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.background,
  },
  loadingText: {
    marginTop: tokens.spacing.m,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
  },
});
