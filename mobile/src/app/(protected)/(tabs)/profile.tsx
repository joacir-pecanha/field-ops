import React from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { tokens } from '@/design-system/tokens';
import { Button } from '@/design-system/components/Button';
import { useAuth } from '@/features/auth/context/AuthContext';
import { seedDatabase } from '@/infrastructure/database';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const currentUser = {
    name: user?.name || 'Técnico FieldOps',
    email: user?.email || 'tecnico@fieldops.com',
    role: user?.role || 'TECHNICIAN',
    phone: user?.phone || 'Não informado',
  };

  const handleSeed = async () => {
    try {
      await seedDatabase();
      Alert.alert('Sucesso', 'Banco de dados populado com dados de teste!');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao popular banco de dados.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{currentUser.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{currentUser.name}</Text>
        <Text style={styles.role}>{currentUser.role}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dados Pessoais</Text>
        <View style={styles.infoRow}>
          <MaterialIcons name="email" size={20} color={tokens.colors.textMuted} />
          <Text style={styles.infoText}>{currentUser.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="phone" size={20} color={tokens.colors.textMuted} />
          <Text style={styles.infoText}>{currentUser.phone}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desenvolvimento</Text>
        <Button 
          title="Popular Banco de Dados (Seed)" 
          onPress={handleSeed} 
          variant="secondary"
          style={styles.devButton}
        />
      </View>

      <View style={styles.footer}>
        <Button 
          title="Sair" 
          onPress={handleLogout} 
          variant="danger" 
        />
        <Text style={styles.version}>Versão 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: tokens.spacing.l,
  },
  header: {
    alignItems: 'center',
    marginBottom: tokens.spacing.xl,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.m,
  },
  avatarText: {
    color: tokens.colors.surface,
    fontSize: 32,
    fontWeight: tokens.typography.fontWeights.bold,
  },
  name: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
  },
  role: {
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
  },
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.m,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.m,
    paddingVertical: tokens.spacing.xs,
  },
  infoText: {
    marginLeft: tokens.spacing.m,
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.text,
  },
  devButton: {
    marginBottom: tokens.spacing.s,
  },
  footer: {
    marginTop: tokens.spacing.xl,
    paddingTop: tokens.spacing.l,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  version: {
    textAlign: 'center',
    marginTop: tokens.spacing.m,
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.fontSizes.small,
  },
});
