export {
  CRITICAL_DESCRIPTION_REQUIRED_MESSAGE,
  CRITICAL_PHOTO_REQUIRED_MESSAGE,
  MIN_DETAILED_DESCRIPTION_LENGTH,
  NON_CONFORMITY_SEVERITIES,
  NON_CONFORMITY_SEVERITY_META,
  NonConformitySeverityEnum,
  READ_ONLY_NON_CONFORMITY_MESSAGE,
  isCriticalSeverity,
  isNonConformitySeverity,
  requiresCompulsoryEvidenceAndDescription,
  type CreateNonConformityInput,
  type DeleteNonConformityOptions,
  type DeleteNonConformityResult,
  type DeleteNonConformityResultCode,
  type FindNonConformitiesOptions,
  type NonConformity,
  type NonConformityBusinessStatus,
  type NonConformityMutationResult,
  type NonConformityMutationResultCode,
  type NonConformitySeverity,
  type NonConformitySeverityGroup,
  type NonConformitySeverityMeta,
  type NonConformitySyncStatus,
  type UpdateNonConformityInput,
} from './domain/types';

export {
  nonConformitySchema,
  nonConformitySeveritySchema,
  normalizeNonConformityPayload,
  validateNonConformity,
  type NonConformitySchemaInput,
  type NonConformitySchemaOutput,
  type NonConformityValidationResult,
} from './schemas/nonConformitySchema';

export {
  NonConformityRepository,
  ensureNonConformitiesTable,
  nonConformityRepository,
  type NonConformityCounts,
  type NonConformityRepositoryDependencies,
  type NonConformityRow,
} from './services/nonConformityRepository';

export {
  NonConformityFormModal,
  type NonConformityDraftSnapshot,
  type NonConformityFormModalProps,
  type NonConformityFormSubmitPayload,
} from './components/NonConformityFormModal';

export {
  useNonConformityDraftStore,
  type NonConformityPendingDraft,
  type NonConformityReturnRoute,
} from './store/nonConformityDraftStore';
