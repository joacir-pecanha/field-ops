import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { tokens } from '@/design-system/tokens';
import { Card } from '@/design-system/components/Card';
import { Button } from '@/design-system/components/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { InspectionRepository, OutboxRepository } from '@/infrastructure/database';
import { useFocusEffect } from 'expo-router';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    today: 0,
    delayed: 0,
    pendingSync: 0,
  });

  const loadMetrics = async () => {
    try {
      const inspectionRepo = new InspectionRepository();
      const outboxRepo = new OutboxRepository();

      const inspections = await inspectionRepo.findAll();
      const pendingSyncs = await outboxRepo.findPendingOperations();

      const todayStr = new Date().toISOString().split('T')[0];
      
      const todayCount = inspections.filter(i => 
        i.due_date && i.due_date.startsWith(todayStr)
      ).length;

      const delayedCount = inspections.filter(i => {
        if (!i.due_date) return false;
        const due = new Date(i.due_date);
        return due < new Date() && i.status !== 'SUBMITTED' && i.status !== 'APPROVED';
      }).length;

      setMetrics({
        today: todayCount,
        delayed: delayedCount,
        pendingSync: pendingSyncs.length,
      });
    } catch (e) {
      console.error('Error loading metrics', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadMetrics();
    }, [])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, Joacir</Text>
        <Text style={styles.subtitle}>Visão geral das suas inspeções</Text>
      </View>

      <View style={styles.metricsContainer}>
        <Card style={styles.metricCard}>
          <MaterialIcons name="event" size={24} color={tokens.colors.primary} />
          <Text style={styles.metricValue}>{metrics.today}</Text>
          <Text style={styles.metricLabel}>Para hoje</Text>
        </Card>
        
        <Card style={styles.metricCard}>
          <MaterialIcons name="warning" size={24} color={tokens.colors.danger} />
          <Text style={[styles.metricValue, { color: tokens.colors.danger }]}>{metrics.delayed}</Text>
          <Text style={styles.metricLabel}>Atrasadas</Text>
        </Card>

        <Card style={styles.metricCard}>
          <MaterialIcons name="sync" size={24} color={tokens.colors.warning} />
          <Text style={styles.metricValue}>{metrics.pendingSync}</Text>
          <Text style={styles.metricLabel}>Pendentes</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Ações Rápidas</Text>
      <View style={styles.actionsContainer}>
        <Button 
          title="Sincronizar Dados" 
          onPress={() => {}} 
          variant="primary"
          style={styles.actionButton}
        />
        <Button 
          title="Ler QR Code" 
          onPress={() => {}} 
          variant="secondary"
          style={styles.actionButton}
        />
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
    padding: tokens.spacing.m,
  },
  header: {
    marginBottom: tokens.spacing.l,
  },
  greeting: {
    fontSize: tokens.typography.fontSizes.xlarge,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  subtitle: {
    fontSize: tokens.typography.fontSizes.regular,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xl,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: tokens.spacing.xs,
    alignItems: 'center',
    padding: tokens.spacing.s,
  },
  metricValue: {
    fontSize: tokens.typography.fontSizes.xlarge,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: tokens.spacing.s,
  },
  metricLabel: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.m,
  },
  actionsContainer: {
    gap: tokens.spacing.m,
  },
  actionButton: {
    width: '100%',
  },
});
