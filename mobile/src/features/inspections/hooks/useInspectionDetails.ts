import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiClient } from '@/infrastructure/http/apiClient';
import {
  inspectionRepository as defaultInspectionRepo,
  InspectionRepository,
  resolveInspectionAction,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistSection,
  type Inspection,
  type InspectionActionConfig,
  type InspectionDetailsData,
  type InspectionEvidence,
  type OutboxOperation,
} from '@/infrastructure/database/types';
import {
  networkMonitor as defaultNetworkMonitor,
  type INetworkMonitor,
} from '@/infrastructure/sync/networkMonitor';
import {
  mapRemoteInspectionToLocal,
  OFFLINE_REFRESH_SNACKBAR_MESSAGE,
  type SnackbarState,
} from './useInspectionList';

export const PERMISSION_DENIED_MESSAGE =
  'Permissão negada: esta inspeção está atribuída a outro técnico.';
export const INSPECTION_NOT_FOUND_MESSAGE =
  'Inspeção não encontrada no armazenamento local.';

export interface InspectionEquipmentInfo {
  name: string;
  code: string | null;
  qrCode: string | null;
  hasEquipment: boolean;
}

export interface InspectionSiteInfo {
  name: string;
  address: string | null;
  fullAddress: string;
}

export interface LoadInspectionDetailsParams {
  inspectionId: string | undefined | null;
  technicianId?: string | null;
  userRole?: string | null;
  inspectionRepository?: InspectionRepository;
  networkMonitor?: INetworkMonitor;
  fetchRemoteById?: (id: string) => Promise<any>;
  onPermissionDenied?: (message: string) => void;
  referenceDate?: Date;
}

export interface LoadInspectionDetailsResult {
  details: InspectionDetailsData | null;
  inspection: Inspection | null;
  equipment: InspectionEquipmentInfo | null;
  site: InspectionSiteInfo | null;
  progress: InspectionDetailsData['progress'];
  isOverdue: boolean;
  isPendingSync: boolean;
  action: InspectionActionConfig;
  isForbidden: boolean;
  permissionDeniedMessage: string | null;
  notFound: boolean;
  snackbar: SnackbarState | null;
}

export interface UseInspectionDetailsOptions {
  technicianId?: string | null;
  userRole?: string | null;
  autoLoad?: boolean;
  inspectionRepository?: InspectionRepository;
  networkMonitor?: INetworkMonitor;
  fetchRemoteById?: (id: string) => Promise<any>;
  onPermissionDenied?: (message: string) => void;
}

const DEFAULT_PROGRESS: InspectionDetailsData['progress'] = {
  totalItems: 0,
  answeredItems: 0,
  requiredItems: 0,
  pendingRequiredItems: 0,
  nonConformitiesCount: 0,
  evidencesCount: 0,
  percentage: 0,
};

function isPrivilegedUserRole(userRole?: string | null): boolean {
  const normalized = String(userRole ?? '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'SUPERVISOR';
}

function hasInspectionPermission(
  inspection: Pick<Inspection, 'technician_id'>,
  technicianId?: string | null,
  userRole?: string | null
): boolean {
  if (isPrivilegedUserRole(userRole)) {
    return true;
  }
  if (!technicianId || !inspection.technician_id) {
    return true;
  }
  return inspection.technician_id === technicianId;
}

export function extractEquipmentInfo(
  inspection: Inspection | null
): InspectionEquipmentInfo | null {
  if (!inspection) {
    return null;
  }
  const name = inspection.equipment_name || inspection.equipment || '';
  const code = inspection.equipment_code ?? null;
  const qrCode = inspection.equipment_qr_code ?? null;
  return {
    name,
    code,
    qrCode,
    hasEquipment: Boolean(name || code || qrCode),
  };
}

export function extractSiteInfo(inspection: Inspection | null): InspectionSiteInfo | null {
  if (!inspection) {
    return null;
  }
  const name = inspection.site_name || inspection.site || '';
  const address = inspection.site_address ?? null;
  const fullAddress = [name, address].filter(Boolean).join(' — ');
  return {
    name,
    address,
    fullAddress,
  };
}

function buildSuccessResult(
  details: InspectionDetailsData,
  snackbar: SnackbarState | null = null
): LoadInspectionDetailsResult {
  return {
    details,
    inspection: details.inspection,
    equipment: extractEquipmentInfo(details.inspection),
    site: extractSiteInfo(details.inspection),
    progress: details.progress,
    isOverdue: details.isOverdue,
    isPendingSync: details.isPendingSync,
    action: details.action,
    isForbidden: false,
    permissionDeniedMessage: null,
    notFound: false,
    snackbar,
  };
}

function buildForbiddenResult(
  onPermissionDenied?: (message: string) => void
): LoadInspectionDetailsResult {
  onPermissionDenied?.(PERMISSION_DENIED_MESSAGE);
  return {
    details: null,
    inspection: null,
    equipment: null,
    site: null,
    progress: DEFAULT_PROGRESS,
    isOverdue: false,
    isPendingSync: false,
    action: resolveInspectionAction('APROVADA'),
    isForbidden: true,
    permissionDeniedMessage: PERMISSION_DENIED_MESSAGE,
    notFound: false,
    snackbar: null,
  };
}

function buildNotFoundResult(snackbar: SnackbarState | null = null): LoadInspectionDetailsResult {
  return {
    details: null,
    inspection: null,
    equipment: null,
    site: null,
    progress: DEFAULT_PROGRESS,
    isOverdue: false,
    isPendingSync: false,
    action: resolveInspectionAction('APROVADA'),
    isForbidden: false,
    permissionDeniedMessage: null,
    notFound: true,
    snackbar,
  };
}

/**
 * Carrega detalhes completos da inspeção a partir do SQLite local e valida permissão de acesso (RF-01, RF-05, RF-06, EX-01).
 */
export async function loadInspectionDetails(
  params: LoadInspectionDetailsParams
): Promise<LoadInspectionDetailsResult> {
  const { inspectionId, technicianId, userRole, onPermissionDenied } = params;
  if (!inspectionId) {
    return buildNotFoundResult();
  }

  const inspectionRepo = params.inspectionRepository ?? defaultInspectionRepo;
  const netMonitor = params.networkMonitor ?? defaultNetworkMonitor;
  const referenceDate = params.referenceDate ?? new Date();

  const localDetails = await inspectionRepo.findByIdWithDetails(inspectionId, referenceDate);
  if (localDetails) {
    if (!hasInspectionPermission(localDetails.inspection, technicianId, userRole)) {
      return buildForbiddenResult(onPermissionDenied);
    }
    return buildSuccessResult(localDetails);
  }

  if (!params.fetchRemoteById) {
    return buildNotFoundResult();
  }

  const isOnline = await netMonitor.isOnline();
  if (!isOnline) {
    return buildNotFoundResult();
  }

  try {
    const remote = await params.fetchRemoteById(inspectionId);
    if (!remote) {
      return buildNotFoundResult();
    }

    const mapped = mapRemoteInspectionToLocal(remote);
    if (!hasInspectionPermission(mapped, technicianId, userRole)) {
      return buildForbiddenResult(onPermissionDenied);
    }

    await inspectionRepo.upsertMany([mapped]);
    const hydrated = await inspectionRepo.findByIdWithDetails(mapped.id, referenceDate);
    return hydrated ? buildSuccessResult(hydrated) : buildNotFoundResult();
  } catch (err: any) {
    if (err?.status === 403) {
      return buildForbiddenResult(onPermissionDenied);
    }
    return buildNotFoundResult({
      visible: true,
      message: OFFLINE_REFRESH_SNACKBAR_MESSAGE,
      type: 'warning',
    });
  }
}

/**
 * Atualiza detalhes da inspeção via API preservando dados locais intactos quando offline ou em falha de rede (RT-03, EX-02).
 */
export async function refreshInspectionDetails(
  params: LoadInspectionDetailsParams
): Promise<LoadInspectionDetailsResult> {
  const { inspectionId, technicianId, userRole, onPermissionDenied } = params;
  if (!inspectionId) {
    return buildNotFoundResult();
  }

  const inspectionRepo = params.inspectionRepository ?? defaultInspectionRepo;
  const netMonitor = params.networkMonitor ?? defaultNetworkMonitor;
  const referenceDate = params.referenceDate ?? new Date();
  const fetchRemote =
    params.fetchRemoteById ??
    ((id: string) => apiClient.get<any>(`/api/v1/inspections/${id}`));

  const localBefore = await inspectionRepo.findByIdWithDetails(inspectionId, referenceDate);
  if (localBefore && !hasInspectionPermission(localBefore.inspection, technicianId, userRole)) {
    return buildForbiddenResult(onPermissionDenied);
  }

  const isOnline = await netMonitor.isOnline();
  if (!isOnline) {
    const offlineSnackbar: SnackbarState = {
      visible: true,
      message: OFFLINE_REFRESH_SNACKBAR_MESSAGE,
      type: 'warning',
    };
    return localBefore
      ? buildSuccessResult(localBefore, offlineSnackbar)
      : buildNotFoundResult(offlineSnackbar);
  }

  try {
    const remote = await fetchRemote(inspectionId);
    if (remote) {
      const mapped = mapRemoteInspectionToLocal(remote);
      if (!hasInspectionPermission(mapped, technicianId, userRole)) {
        return buildForbiddenResult(onPermissionDenied);
      }
      await inspectionRepo.upsertMany([mapped]);
    }
    const localAfter = await inspectionRepo.findByIdWithDetails(inspectionId, referenceDate);
    return localAfter ? buildSuccessResult(localAfter) : buildNotFoundResult();
  } catch (err: any) {
    if (err?.status === 403) {
      return buildForbiddenResult(onPermissionDenied);
    }
    const errorSnackbar: SnackbarState = {
      visible: true,
      message: OFFLINE_REFRESH_SNACKBAR_MESSAGE,
      type: 'warning',
    };
    return localBefore
      ? buildSuccessResult(localBefore, errorSnackbar)
      : buildNotFoundResult(errorSnackbar);
  }
}

/**
 * Hook reativo para detalhes offline-first de uma inspeção (TASK-013 Passo 2).
 */
export function useInspectionDetails(
  inspectionId: string | undefined | null,
  options: UseInspectionDetailsOptions = {}
) {
  const { user } = useAuth();
  const technicianId = options.technicianId !== undefined ? options.technicianId : user?.id ?? null;
  const userRole = options.userRole !== undefined ? options.userRole : user?.role ?? null;

  const inspectionRepo = options.inspectionRepository ?? defaultInspectionRepo;
  const netMonitor = options.networkMonitor ?? defaultNetworkMonitor;

  const fetchRemoteRef = useRef(options.fetchRemoteById);
  fetchRemoteRef.current = options.fetchRemoteById;
  const onPermissionDeniedRef = useRef(options.onPermissionDenied);
  onPermissionDeniedRef.current = options.onPermissionDenied;

  const [details, setDetails] = useState<InspectionDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(options.autoLoad !== false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);
  const [permissionDeniedMessage, setPermissionDeniedMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  const dismissSnackbar = useCallback(() => {
    setSnackbar(null);
  }, []);

  const applyResult = useCallback((result: LoadInspectionDetailsResult) => {
    setDetails(result.details);
    setIsForbidden(result.isForbidden);
    setPermissionDeniedMessage(result.permissionDeniedMessage);
    setNotFound(result.notFound);
    setError(result.notFound ? INSPECTION_NOT_FOUND_MESSAGE : null);
    if (result.snackbar) {
      setSnackbar(result.snackbar);
    }
  }, []);

  const reloadLocal = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await loadInspectionDetails({
        inspectionId,
        technicianId,
        userRole,
        inspectionRepository: inspectionRepo,
        networkMonitor: netMonitor,
        fetchRemoteById: fetchRemoteRef.current,
        onPermissionDenied: (msg) => onPermissionDeniedRef.current?.(msg),
      });
      applyResult(result);
    } catch (err: any) {
      setDetails(null);
      setError(err?.message || 'Não foi possível carregar os detalhes da inspeção.');
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId, technicianId, userRole, inspectionRepo, netMonitor, applyResult]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshInspectionDetails({
        inspectionId,
        technicianId,
        userRole,
        inspectionRepository: inspectionRepo,
        networkMonitor: netMonitor,
        fetchRemoteById: fetchRemoteRef.current,
        onPermissionDenied: (msg) => onPermissionDeniedRef.current?.(msg),
      });
      applyResult(result);
      return result;
    } finally {
      setIsRefreshing(false);
    }
  }, [inspectionId, technicianId, userRole, inspectionRepo, netMonitor, applyResult]);

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

  const inspection = details?.inspection ?? null;
  const equipment = useMemo(() => extractEquipmentInfo(inspection), [inspection]);
  const site = useMemo(() => extractSiteInfo(inspection), [inspection]);
  const action = useMemo(
    () => (details?.action ? details.action : resolveInspectionAction(inspection?.status ?? 'APROVADA')),
    [details?.action, inspection?.status]
  );

  const sections: ChecklistSection[] = details?.sections ?? [];
  const items: ChecklistItem[] = details?.items ?? [];
  const responses: ChecklistResponse[] = details?.responses ?? [];
  const evidences: InspectionEvidence[] = details?.evidences ?? [];
  const pendingOperations: OutboxOperation[] = details?.pendingOperations ?? [];

  return {
    details,
    inspection,
    sections,
    items,
    responses,
    evidences,
    pendingOperations,
    equipment,
    site,
    progress: details?.progress ?? DEFAULT_PROGRESS,
    isOverdue: details?.isOverdue ?? false,
    isPendingSync: details?.isPendingSync ?? false,
    action,
    isLoading,
    isRefreshing,
    isOnline,
    isForbidden,
    permissionDeniedMessage,
    notFound,
    error,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  };
}
