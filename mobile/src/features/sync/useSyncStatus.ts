import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { outboxRepository, type OutboxOperation } from '@/infrastructure/database';
import { networkMonitor, outboxEngine, type SyncResult } from '@/infrastructure/sync';

export interface SyncState {
  pendingCount: number;
  syncedCount: number;
  errorCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncAt: string | null;
  lastSyncResult: 'SUCCESS' | 'ERROR' | 'OFFLINE' | 'PARTIAL' | null;
  lastSyncMessage: string | null;
  operations: OutboxOperation[];

  // Actions
  setCounts: (pending: number, error: number, operations: OutboxOperation[]) => void;
  setSyncing: (isSyncing: boolean) => void;
  setOnline: (isOnline: boolean) => void;
  setLastSync: (
    result: 'SUCCESS' | 'ERROR' | 'OFFLINE' | 'PARTIAL',
    message: string,
    timestamp?: string
  ) => void;
  incrementSyncedCount: (amount: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  syncedCount: 0,
  errorCount: 0,
  isSyncing: false,
  isOnline: true,
  lastSyncAt: null,
  lastSyncResult: null,
  lastSyncMessage: null,
  operations: [],

  setCounts: (pending, error, operations) =>
    set({ pendingCount: pending, errorCount: error, operations }),
  setSyncing: (isSyncing) =>
    set((state) => (state.isSyncing === isSyncing ? state : { isSyncing })),
  setOnline: (isOnline) =>
    set((state) => (state.isOnline === isOnline ? state : { isOnline })),
  setLastSync: (result, message, timestamp = new Date().toISOString()) =>
    set({ lastSyncResult: result, lastSyncMessage: message, lastSyncAt: timestamp }),
  incrementSyncedCount: (amount) =>
    set((state) => ({ syncedCount: state.syncedCount + amount })),
}));

/**
 * Hook reativo para visualização e controle da sincronização Outbox.
 * Integra SQLite durável, Zustand para estado em tempo real e NetworkMonitor.
 */
export function useSyncStatus() {
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const syncedCount = useSyncStore((s) => s.syncedCount);
  const errorCount = useSyncStore((s) => s.errorCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const isOnline = useSyncStore((s) => s.isOnline);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const lastSyncResult = useSyncStore((s) => s.lastSyncResult);
  const lastSyncMessage = useSyncStore((s) => s.lastSyncMessage);
  const operations = useSyncStore((s) => s.operations);

  const refreshStatus = useCallback(async () => {
    try {
      const allOps = await outboxRepository.findAll();
      const pendingOps = allOps.filter(
        (op) => op.status === 'PENDING' || op.status === 'ERROR' || op.status === 'SYNCING'
      );
      const errorOps = allOps.filter(
        (op) => op.status === 'ERROR' || op.status === 'CONFLICT'
      );
      const online = await networkMonitor.isOnline();

      const { setOnline, setCounts } = useSyncStore.getState();
      setOnline(online);
      setCounts(pendingOps.length, errorOps.length, allOps);
    } catch (err) {
      console.warn('[useSyncStatus] Erro ao atualizar status:', err);
    }
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    const { setSyncing, incrementSyncedCount, setLastSync } = useSyncStore.getState();
    setSyncing(true);
    try {
      const result = await outboxEngine.sync();

      if (result.success) {
        incrementSyncedCount(result.processedCount);
        setLastSync('SUCCESS', result.message);
      } else if (result.reason === 'OFFLINE') {
        setLastSync('OFFLINE', result.message);
      } else if (result.reason === 'PARTIAL_ERROR') {
        incrementSyncedCount(result.processedCount);
        setLastSync('PARTIAL', result.message);
      } else {
        setLastSync('ERROR', result.message);
      }

      await refreshStatus();
      return result;
    } finally {
      setSyncing(false);
    }
  }, [refreshStatus]);

  const setMockOnline = useCallback(
    (online: boolean | null) => {
      networkMonitor.setMockStatus(online);
      useSyncStore.getState().setOnline(online ?? true);
      refreshStatus();
    },
    [refreshStatus]
  );

  useEffect(() => {
    refreshStatus();

    const unsubscribe = networkMonitor.subscribe((online) => {
      useSyncStore.getState().setOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshStatus]);

  return {
    pendingCount,
    syncedCount,
    errorCount,
    isSyncing,
    isOnline,
    lastSyncAt,
    lastSyncResult,
    lastSyncMessage,
    operations,
    syncNow,
    refreshStatus,
    setMockOnline,
  };
}
