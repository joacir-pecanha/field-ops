import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { initDatabase } from '@/infrastructure/database';
import { Text, View } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbInitialized(true))
      .catch((e) => console.error('Failed to initialize database', e));
  }, []);

  useEffect(() => {
    const inProtectedGroup = segments[0] === '(protected)';

    if (!isAuthenticated && inProtectedGroup) {
      // Redireciona para o login se não estiver autenticado e tentar acessar uma rota protegida
      router.replace('/(public)/login');
    } else if (isAuthenticated && !inProtectedGroup) {
      // Redireciona para o início protegido se já estiver autenticado e tentar acessar rotas públicas (como login)
      router.replace('/(protected)/(tabs)');
    }
  }, [isAuthenticated, segments, dbInitialized]);

  if (!dbInitialized) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text>Carregando banco de dados...</Text></View>;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(protected)" />
    </Stack>
  );
}
