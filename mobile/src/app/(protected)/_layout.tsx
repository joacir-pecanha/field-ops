import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function ProtectedLayout() {
  const { isAuthenticated, isInitialized } = useAuth();

  // Guard de rotas protegidas: impede renderização se desautenticado (RT-03, CA-03, RF-04)
  if (isInitialized && !isAuthenticated) {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="inspections" />
    </Stack>
  );
}
