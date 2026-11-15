export {
  CONSENT_PROMPT_MESSAGE,
  PERMISSION_BLOCKED_GUIDANCE,
  PERMISSION_DENIED_GUIDANCE,
  resolveCameraPermissionState,
  useCameraPermission,
  type CameraPermissionState,
  type CameraPermissionStatus,
  type RawCameraPermission,
  type UseCameraPermissionOptions,
} from './hooks/useCameraPermission';

export {
  DEFAULT_SCAN_DEBOUNCE_MS,
  FIELDOPS_KNOWN_EQUIPMENT_CATALOG,
  MIN_DIVERGENCE_JUSTIFICATION_LENGTH,
  OUT_OF_SCOPE_QR_MESSAGE,
  QrScanSessionGuard,
  UNRECOGNIZED_QR_MESSAGE,
  clearEquipmentVerificationRecords,
  confirmEquipmentVerification,
  createQrScanDebounceController,
  getEquipmentVerificationRecord,
  normalizeQrCodeValue,
  validateScannedQrCode,
  type ConfirmVerificationDependencies,
  type EquipmentSummary,
  type EquipmentVerificationConfirmation,
  type EquipmentVerificationRecord,
  type KnownEquipmentCatalogEntry,
  type QrInputSource,
  type QrScanDebounceController,
  type QrValidationOutcome,
  type QrValidationRequest,
  type QrValidationResult,
  type QrValidatorDependencies,
  type VerificationConfirmationMode,
} from './services/qrValidator';

export {
  CameraScannerOverlay,
  triggerScanFeedback,
  type CameraScannerOverlayProps,
  type ScannerOverlayStatus,
} from './components/CameraScannerOverlay';

export {
  DivergenceModal,
  type DivergenceModalProps,
} from './components/DivergenceModal';

export {
  ManualCodeModal,
  type ManualCodeModalProps,
  type ManualCodeSubmitPayload,
  type ManualEntryReason,
} from './components/ManualCodeModal';
