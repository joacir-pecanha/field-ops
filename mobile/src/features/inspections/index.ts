export {
  InspectionCard,
  PriorityBadge,
  SyncStatusBadge,
  getPriorityConfig,
  getSyncStatusConfig,
  type InspectionCardProps,
  type PriorityBadgeProps,
  type SyncStatusBadgeProps,
  type PriorityBadgeConfig,
  type SyncBadgeConfig,
} from './components/InspectionCard';

export {
  useInspectionList,
  loadInspectionsFromLocal,
  refreshInspectionsFromRemote,
  mapRemoteInspectionToLocal,
  EMPTY_INSPECTIONS_MESSAGE,
  EMPTY_FILTERED_INSPECTIONS_MESSAGE,
  OFFLINE_REFRESH_SNACKBAR_MESSAGE,
  type InspectionListItem,
  type LoadInspectionsParams,
  type LoadInspectionsResult,
  type RefreshInspectionsParams,
  type RefreshInspectionsResult,
  type UseInspectionListOptions,
  type SnackbarState,
} from './hooks/useInspectionList';

export {
  useInspectionDetails,
  loadInspectionDetails,
  refreshInspectionDetails,
  extractEquipmentInfo,
  extractSiteInfo,
  PERMISSION_DENIED_MESSAGE,
  INSPECTION_NOT_FOUND_MESSAGE,
  type InspectionEquipmentInfo,
  type InspectionSiteInfo,
  type LoadInspectionDetailsParams,
  type LoadInspectionDetailsResult,
  type UseInspectionDetailsOptions,
} from './hooks/useInspectionDetails';

export {
  useInspectionProgress,
  calculateInspectionProgress,
  isChecklistItemAnswered,
  type InspectionProgressSummary,
  type PendingInspectionItem,
  type PendingItemReason,
  type UseInspectionProgressInput,
} from './hooks/useInspectionProgress';

export {
  PendingItemsModal,
  type PendingItemsModalProps,
} from './components/PendingItemsModal';

export {
  AWAITING_SYNC_LABEL,
  InspectionLifecycleError,
  completeInspection,
  ensureInspectionLocationsTable,
  getInspectionLocations,
  isInspectionReadOnly,
  saveChecklistResponse,
  startInspection,
  type CompleteInspectionParams,
  type CompleteInspectionResult,
  type InspectionLifecycleDependencies,
  type InspectionLocationRecord,
  type InspectionLocationsResult,
  type LifecycleErrorCode,
  type LocationStage,
  type SaveChecklistResponseParams,
  type SaveChecklistResponseResult,
  type StartInspectionParams,
  type StartInspectionResult,
} from './services/inspectionLifecycleService';
