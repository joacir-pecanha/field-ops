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
  setSyncing: (isSyncing) => set({ isSyncing }),
  setOnline: (isOnline) => set({ isOnline }),
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
  const store = useSyncStore();

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

      store.setOnline(online);
      store.setCounts(pendingOps.length, errorOps.length, allOps);
    } catch (err) {
      console.warn('[useSyncStatus] Erro ao atualizar status:', err);
    }
  }, [store]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    store.setSyncing(true);
    try {
      const result = await outboxEngine.sync();

      if (result.success) {
        store.incrementSyncedCount(result.processedCount);
        store.setLastSync('SUCCESS', result.message);
      } else if (result.reason === 'OFFLINE') {
        store.setLastSync('OFFLINE', result.message);
      } else if (result.reason === 'PARTIAL_ERROR') {
        store.incrementSyncedCount(result.processedCount);
        store.setLastSync('PARTIAL', result.message);
      } else {
        store.setLastSync('ERROR', result.message);
      }

      await refreshStatus();
      return result;
    } finally {
      store.setSyncing(false);
    }
  }, [store, refreshStatus]);

  const setMockOnline = useCallback(
    (online: boolean | null) => {
      networkMonitor.setMockStatus(online);
      store.setOnline(online ?? true);
      refreshStatus();
    },
    [store, refreshStatus]
  );

  useEffect(() => {
    refreshStatus();

    const unsubscribe = networkMonitor.subscribe((online) => {
      store.setOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshStatus, store]);

  return {
    pendingCount: store.pendingCount,
    syncedCount: store.syncedCount,
    errorCount: store.errorCount,
    isSyncing: store.isSyncing,
    isOnline: store.isOnline,
    lastSyncAt: store.lastSyncAt,
    lastSyncResult: store.lastSyncResult,
    lastSyncMessage: store.lastSyncMessage,
    operations: store.operations,
    syncNow,
    refreshStatus,
    setMockOnline,
  };
}
