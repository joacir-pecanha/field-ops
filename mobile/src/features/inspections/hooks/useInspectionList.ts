import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiClient } from '@/infrastructure/http/apiClient';
import {
  inspectionRepository as defaultInspectionRepo,
  InspectionRepository,
  isInspectionOverdue,
  isInspectionPendingSync,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  outboxRepository as defaultOutboxRepo,
  OutboxRepository,
} from '@/infrastructure/database/repositories/outboxRepository';
import {
  type Inspection,
  type InspectionFilterParams,
  type InspectionFilterTab,
  type InspectionPriority,
  type InspectionSummaryMetrics,
} from '@/infrastructure/database/types';
import {
  networkMonitor as defaultNetworkMonitor,
  type INetworkMonitor,
} from '@/infrastructure/sync/networkMonitor';

export const EMPTY_INSPECTIONS_MESSAGE = 'Nenhuma inspeção atribuída no momento';
export const EMPTY_FILTERED_INSPECTIONS_MESSAGE =
  'Nenhuma inspeção encontrada para os filtros selecionados.';
export const OFFLINE_REFRESH_SNACKBAR_MESSAGE =
  'Sem conexão com o servidor. Exibindo dados salvos no dispositivo.';

export interface SnackbarState {
  visible: boolean;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface InspectionListItem extends Inspection {
  isOverdue: boolean;
  isPendingSync: boolean;
  isOfflineOnly: boolean;
}

export interface LoadInspectionsParams {
  technicianId?: string | null;
  statusFilter?: InspectionFilterTab | string;
  searchQuery?: string;
  priorityFilter?: InspectionPriority | 'TODAS';
  onlyOverdue?: boolean;
  onlyDueToday?: boolean;
  inspectionRepository?: InspectionRepository;
  outboxRepository?: OutboxRepository;
  referenceDate?: Date;
}

export interface LoadInspectionsResult {
  items: InspectionListItem[];
  metrics: InspectionSummaryMetrics;
  pendingSyncIds: Set<string>;
  isEmpty: boolean;
  emptyMessage: string | null;
}

export interface RefreshInspectionsParams extends LoadInspectionsParams {
  networkMonitor?: INetworkMonitor;
  fetchRemoteAssigned?: (technicianId?: string | null) => Promise<any[]>;
}

export interface RefreshInspectionsResult extends LoadInspectionsResult {
  refreshedFromNetwork: boolean;
  snackbar: SnackbarState | null;
}

export interface UseInspectionListInitialData extends Partial<LoadInspectionsResult> {
  snackbar?: SnackbarState | null;
  isOnline?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export interface UseInspectionListOptions {
  technicianId?: string | null;
  initialStatusFilter?: InspectionFilterTab;
  initialSearchQuery?: string;
  initialPriorityFilter?: InspectionPriority | 'TODAS';
  onlyOverdue?: boolean;
  onlyDueToday?: boolean;
  autoLoad?: boolean;
  initialData?: UseInspectionListInitialData;
  inspectionRepository?: InspectionRepository;
  outboxRepository?: OutboxRepository;
  networkMonitor?: INetworkMonitor;
  fetchRemoteAssigned?: (technicianId?: string | null) => Promise<any[]>;
}

/**
 * Converte o DTO retornado por GET /api/v1/inspections/assigned para a entidade local Inspection.
 */
export function mapRemoteInspectionToLocal(remote: any): Inspection {
  const id = String(remote.id ?? remote.remoteId ?? remote.remote_id ?? '');
  const clientName = remote.clientName ?? remote.client_name ?? remote.client ?? '';
  const siteName = remote.siteName ?? remote.site_name ?? remote.site ?? '';
  const equipmentName =
    remote.equipmentName ?? remote.equipment_name ?? remote.equipment ?? 'Inspeção de Local';
  const dueDate = remote.dueDate ?? remote.scheduledFor ?? remote.due_date ?? null;

  return {
    id,
    remote_id: String(remote.remoteId ?? remote.remote_id ?? id),
    template_id: String(remote.templateId ?? remote.template_id ?? ''),
    template_version:
      remote.templateVersionNumber ?? remote.templateVersion ?? remote.template_version ?? 1,
    client_name: clientName,
    site_name: siteName,
    site_address: remote.siteAddress ?? remote.site_address ?? null,
    equipment_name: equipmentName,
    equipment_code: remote.equipmentCode ?? remote.equipment_code ?? null,
    equipment_qr_code: remote.equipmentQrCode ?? remote.equipment_qr_code ?? null,
    status: remote.status ?? 'ATRIBUÍDA',
    priority: remote.priority ?? 'MEDIA',
    due_date: dueDate,
    started_at: remote.startedAtDevice ?? remote.startedAtServer ?? remote.started_at ?? null,
    completed_at:
      remote.completedAtDevice ?? remote.submittedAtServer ?? remote.completed_at ?? null,
    sync_status: 'SINCRONIZADO',
    rejection_reason: remote.canceledReason ?? remote.rejection_reason ?? null,
    created_at: remote.createdAt ?? remote.created_at,
    updated_at: remote.updatedAt ?? remote.updated_at,
    technician_id: remote.technicianId ?? remote.technician_id ?? null,
    technician_name: remote.technicianName ?? remote.technician_name ?? null,
    title: remote.title ?? remote.templateTitle ?? null,
    instructions: remote.instructions ?? null,
    client: clientName,
    site: siteName,
    equipment: equipmentName,
  };
}

/**
 * Executa a consulta primária em SQLite com filtros locais e métricas sem depender da rede (RT-01, RF-06).
 */
export async function loadInspectionsFromLocal(
  params: LoadInspectionsParams = {}
): Promise<LoadInspectionsResult> {
  const inspectionRepo = params.inspectionRepository ?? defaultInspectionRepo;
  const outboxRepo = params.outboxRepository ?? defaultOutboxRepo;
  const referenceDate = params.referenceDate ?? new Date();

  const filterParams: InspectionFilterParams = {
    technicianId: params.technicianId,
    status: params.statusFilter ?? 'TODAS',
    searchQuery: params.searchQuery,
    priority: params.priorityFilter,
    onlyOverdue: params.onlyOverdue,
    onlyDueToday: params.onlyDueToday,
  };

  const [filteredInspections, outboxOps, metrics] = await Promise.all([
    inspectionRepo.findWithFilters(filterParams, referenceDate),
    outboxRepo.findAll(),
    inspectionRepo.getSummaryMetrics(params.technicianId, referenceDate),
  ]);

  const activeOutboxIds = new Set<string>(
    outboxOps
      .filter(
        (op) =>
          op.entity_type === 'INSPECTION' &&
          Boolean(op.global_id) &&
          (op.status === 'PENDING' ||
            op.status === 'ERROR' ||
            op.status === 'SYNCING' ||
            op.status === 'CONFLICT')
      )
      .map((op) => op.global_id)
  );

  const pendingSyncIds = new Set<string>();
  const items: InspectionListItem[] = filteredInspections.map((insp) => {
    const overdue = isInspectionOverdue(insp, referenceDate);
    const pendingSync = isInspectionPendingSync(insp, activeOutboxIds);
    if (pendingSync) {
      pendingSyncIds.add(insp.id);
    }
    return {
      ...insp,
      isOverdue: overdue,
      isPendingSync: pendingSync,
      isOfflineOnly: !insp.remote_id,
    };
  });

  const hasActiveFilters = Boolean(
    (params.statusFilter && params.statusFilter !== 'TODAS') ||
      params.searchQuery?.trim() ||
      (params.priorityFilter && params.priorityFilter !== 'TODAS') ||
      params.onlyOverdue ||
      params.onlyDueToday
  );

  const isEmpty = items.length === 0;
  const emptyMessage = isEmpty
    ? hasActiveFilters && metrics.total > 0
      ? EMPTY_FILTERED_INSPECTIONS_MESSAGE
      : EMPTY_INSPECTIONS_MESSAGE
    : null;

  return {
    items,
    metrics,
    pendingSyncIds,
    isEmpty,
    emptyMessage,
  };
}

/**
 * Atualiza inspeções atribuídas a partir da API mantendo dados locais intactos em falhas de rede (RT-03, EX-02).
 */
export async function refreshInspectionsFromRemote(
  params: RefreshInspectionsParams = {}
): Promise<RefreshInspectionsResult> {
  const inspectionRepo = params.inspectionRepository ?? defaultInspectionRepo;
  const netMonitor = params.networkMonitor ?? defaultNetworkMonitor;
  const fetchRemote =
    params.fetchRemoteAssigned ??
    ((technicianId?: string | null) =>
      apiClient.get<any[]>('/api/v1/inspections/assigned', {
        params: technicianId ? { technicianId } : undefined,
      }));

  const isOnline = await netMonitor.isOnline();
  if (!isOnline) {
    const local = await loadInspectionsFromLocal(params);
    return {
      ...local,
      refreshedFromNetwork: false,
      snackbar: {
        visible: true,
        message: OFFLINE_REFRESH_SNACKBAR_MESSAGE,
        type: 'warning',
      },
    };
  }

  try {
    const remoteList = await fetchRemote(params.technicianId);
    if (Array.isArray(remoteList) && remoteList.length > 0) {
      const mapped = remoteList.map(mapRemoteInspectionToLocal).filter((item) => Boolean(item.id));
      await inspectionRepo.upsertMany(mapped);
      if (typeof inspectionRepo.syncRemoteSnapshots === 'function') {
        for (const remote of remoteList) {
          const remoteId = String(remote?.id ?? remote?.remoteId ?? remote?.remote_id ?? '');
          if (remoteId && Array.isArray(remote?.items) && remote.items.length > 0) {
            await inspectionRepo.syncRemoteSnapshots(remoteId, remote.items);
          }
        }
      }
    }
    const local = await loadInspectionsFromLocal(params);
    return {
      ...local,
      refreshedFromNetwork: true,
      snackbar: null,
    };
  } catch {
    // EX-02 & RT-03: Preserva dados locais intactos e exibe snackbar discreto
    const local = await loadInspectionsFromLocal(params);
    return {
      ...local,
      refreshedFromNetwork: false,
      snackbar: {
        visible: true,
        message: OFFLINE_REFRESH_SNACKBAR_MESSAGE,
        type: 'warning',
      },
    };
  }
}

/**
 * Hook reativo de listagem e filtragem offline-first de inspeções atribuídas (TASK-013 Passo 2).
 */
export function useInspectionList(options: UseInspectionListOptions = {}) {
  const { user } = useAuth();
  const technicianId = options.technicianId !== undefined ? options.technicianId : user?.id ?? null;

  const inspectionRepo = options.inspectionRepository ?? defaultInspectionRepo;
  const outboxRepo = options.outboxRepository ?? defaultOutboxRepo;
  const netMonitor = options.networkMonitor ?? defaultNetworkMonitor;
  const fetchRemoteRef = useRef(options.fetchRemoteAssigned);
  fetchRemoteRef.current = options.fetchRemoteAssigned;

  const [statusFilter, setStatusFilter] = useState<InspectionFilterTab>(
    options.initialStatusFilter ?? 'TODAS'
  );
  const [searchQuery, setSearchQuery] = useState<string>(options.initialSearchQuery ?? '');
  const [priorityFilter, setPriorityFilter] = useState<InspectionPriority | 'TODAS'>(
    options.initialPriorityFilter ?? 'TODAS'
  );
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(Boolean(options.onlyOverdue));
  const [onlyDueToday, setOnlyDueToday] = useState<boolean>(Boolean(options.onlyDueToday));

  const initialData = options.initialData;
  const [items, setItems] = useState<InspectionListItem[]>(() => initialData?.items ?? []);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(
    () => initialData?.pendingSyncIds ?? new Set()
  );
  const [metrics, setMetrics] = useState<InspectionSummaryMetrics>(
    () =>
      initialData?.metrics ?? {
        total: 0,
        today: 0,
        overdue: 0,
        delayed: 0,
        inProgress: 0,
        pending: 0,
        completed: 0,
        pendingSync: 0,
      }
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    initialData?.isLoading ?? (initialData ? false : options.autoLoad !== false)
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    initialData?.isRefreshing ?? false
  );
  const [isOnline, setIsOnline] = useState<boolean>(initialData?.isOnline ?? true);
  const [isEmpty, setIsEmpty] = useState<boolean>(
    initialData?.isEmpty ?? (initialData?.items ? initialData.items.length === 0 : false)
  );
  const [emptyMessage, setEmptyMessage] = useState<string | null>(
    initialData?.emptyMessage ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(
    initialData?.snackbar ?? null
  );

  const dismissSnackbar = useCallback(() => {
    setSnackbar(null);
  }, []);

  const reloadLocal = useCallback(async () => {
    try {
      const result = await loadInspectionsFromLocal({
        technicianId,
        statusFilter,
        searchQuery,
        priorityFilter,
        onlyOverdue,
        onlyDueToday,
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
      });

      setItems(result.items);
      setMetrics(result.metrics);
      setPendingSyncIds(result.pendingSyncIds);
      setIsEmpty(result.isEmpty);
      setEmptyMessage(result.emptyMessage);
      setError(null);
    } catch (err: any) {
      console.warn('[useInspectionList] Falha ao consultar SQLite local:', err);
      setItems([]);
      setIsEmpty(true);
      setEmptyMessage(EMPTY_INSPECTIONS_MESSAGE);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    technicianId,
    statusFilter,
    searchQuery,
    priorityFilter,
    onlyOverdue,
    onlyDueToday,
    inspectionRepo,
    outboxRepo,
  ]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshInspectionsFromRemote({
        technicianId,
        statusFilter,
        searchQuery,
        priorityFilter,
        onlyOverdue,
        onlyDueToday,
        inspectionRepository: inspectionRepo,
        outboxRepository: outboxRepo,
        networkMonitor: netMonitor,
        fetchRemoteAssigned: fetchRemoteRef.current,
      });

      setItems(result.items);
      setMetrics(result.metrics);
      setPendingSyncIds(result.pendingSyncIds);
      setIsEmpty(result.isEmpty);
      setEmptyMessage(result.emptyMessage);
      setError(null);
      if (result.snackbar) {
        setSnackbar(result.snackbar);
      }
      return result;
    } finally {
      setIsRefreshing(false);
    }
  }, [
    technicianId,
    statusFilter,
    searchQuery,
    priorityFilter,
    onlyOverdue,
    onlyDueToday,
    inspectionRepo,
    outboxRepo,
    netMonitor,
  ]);

  useEffect(() => {
    if (options.autoLoad !== false) {
      reloadLocal();
    }
  }, [reloadLocal, options.autoLoad]);

  useEffect(() => {
    const unsubscribe = netMonitor.subscribe((online) => {
      setIsOnline(online);
    });
    return () => {
      unsubscribe();
    };
  }, [netMonitor]);

  const countsByTab = useMemo(
    () => ({
      TODAS: metrics.total,
      PENDENTES: metrics.pending,
      EM_ANDAMENTO: metrics.inProgress,
      CONCLUÍDAS: metrics.completed,
    }),
    [metrics]
  );

  return {
    items,
    inspections: items,
    metrics,
    countsByTab,
    pendingSyncIds,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    onlyOverdue,
    setOnlyOverdue,
    onlyDueToday,
    setOnlyDueToday,
    isLoading,
    isRefreshing,
    isOnline,
    isEmpty,
    emptyMessage,
    error,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  };
}
