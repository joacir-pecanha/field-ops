import { Stack } from 'expo-router';
import { tokens } from '@/design-system';

export default function InspectionsStackLayout() {
  return (
    <Stack screenOptions={{ 
      headerStyle: { backgroundColor: tokens.colors.surface },
      headerTintColor: tokens.colors.primary,
      headerTitleStyle: { fontWeight: 'bold' }
    }}>
      <Stack.Screen 
        name="[id]/index" 
        options={{ title: 'Detalhes da Inspeção' }} 
      />
    </Stack>
  );
}
