import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import { resolveRenderableEvidenceUri } from '@/features/evidence';
import {
  CRITICAL_PHOTO_REQUIRED_MESSAGE,
  MIN_DETAILED_DESCRIPTION_LENGTH,
  NON_CONFORMITY_SEVERITIES,
  NON_CONFORMITY_SEVERITY_META,
  READ_ONLY_NON_CONFORMITY_MESSAGE,
  requiresCompulsoryEvidenceAndDescription,
  type NonConformity,
  type NonConformitySeverity,
} from '../domain/types';
import { validateNonConformity } from '../schemas/nonConformitySchema';

export interface NonConformityDraftSnapshot {
  inspectionId: string;
  editingNonConformityId?: string | null;
  itemId: string | null;
  itemTitle: string | null;
  title: string;
  description: string;
  severity: NonConformitySeverity;
  evidenceUris: string[];
  evidenceIds: string[];
}

export interface NonConformityFormSubmitPayload {
  id?: string;
  inspection_id: string;
  item_id: string | null;
  item_title: string | null;
  title: string;
  description: string;
  severity: NonConformitySeverity;
  evidence_uris: string[];
  evidence_ids: string[];
}

export interface NonConformityFormModalProps {
  visible: boolean;
  inspectionId: string;
  itemId?: string | null;
  itemTitle?: string | null;
  initialNonConformity?: NonConformity | null;
  initialSeverity?: NonConformitySeverity;
  initialTitle?: string;
  initialDescription?: string;
  initialEvidenceUris?: string[];
  initialEvidenceIds?: string[];
  preferDraftValues?: boolean;
  readOnly?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (payload: NonConformityFormSubmitPayload) => void | Promise<void>;
  onDeleteOrCancel?: (nonConformity: NonConformity) => void | Promise<void>;
  onAttachPhoto?: (draft: NonConformityDraftSnapshot) => void;
  testID?: string;
}

function dedupeStrings(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * NonConformityFormModal (TASK-017 / Passo 3)
 *
 * Modal para registro, classificação de criticidade (BAIXA, MEDIA, ALTA, CRITICA),
 * anexo de evidência fotográfica e edição/exclusão offline de não conformidades.
 *
 * - RF-01 / RF-02: Vincula à inspeção e opcionalmente a um item específico do checklist.
 * - RF-03 / RF-04: Seletores de criticidade com cores de advertência e exigência compulsória de
 *   descrição detalhada + fotografia quando ALTA ou CRITICA.
 * - EX-01 / CA-02: Bloqueia o botão de salvar e exibe alerta destacado quando item crítico não possui foto.
 * - EX-02: Bloqueia edição/exclusão em inspeções concluídas ou aprovadas.
 */
export function NonConformityFormModal({
  visible,
  inspectionId,
  itemId = null,
  itemTitle = null,
  initialNonConformity = null,
  initialSeverity = 'MEDIA',
  initialTitle = '',
  initialDescription = '',
  initialEvidenceUris = [],
  initialEvidenceIds = [],
  preferDraftValues = false,
  readOnly = false,
  isSaving = false,
  isDeleting = false,
  errorMessage = null,
  onClose,
  onSubmit,
  onDeleteOrCancel,
  onAttachPhoto,
  testID = 'non-conformity-form-modal',
}: NonConformityFormModalProps) {
  const effectiveItemId = preferDraftValues
    ? itemId ?? null
    : initialNonConformity?.item_id ?? itemId ?? null;
  const effectiveItemTitle = preferDraftValues
    ? itemTitle ?? null
    : initialNonConformity?.item_title ?? itemTitle ?? null;

  const [attachToItem, setAttachToItem] = useState<boolean>(Boolean(effectiveItemId));
  const [title, setTitle] = useState<string>(
    preferDraftValues ? initialTitle : initialNonConformity?.title ?? initialTitle
  );
  const [description, setDescription] = useState<string>(
    preferDraftValues
      ? initialDescription
      : initialNonConformity?.description ?? initialDescription
  );
  const [severity, setSeverity] = useState<NonConformitySeverity>(
    preferDraftValues
      ? initialSeverity
      : initialNonConformity?.severity ?? initialSeverity
  );
  const [evidenceUris, setEvidenceUris] = useState<string[]>(() =>
    preferDraftValues
      ? dedupeStrings(initialEvidenceUris)
      : dedupeStrings([
          ...(initialNonConformity?.evidence_uris ?? []),
          ...initialEvidenceUris,
        ])
  );
  const [evidenceIds, setEvidenceIds] = useState<string[]>(() =>
    preferDraftValues
      ? dedupeStrings(initialEvidenceIds)
      : dedupeStrings([
          ...(initialNonConformity?.evidence_ids ?? []),
          ...initialEvidenceIds,
        ])
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const nextItemId = preferDraftValues
      ? itemId ?? null
      : initialNonConformity?.item_id ?? itemId ?? null;
    setAttachToItem(Boolean(nextItemId));
    setTitle(
      preferDraftValues ? initialTitle : initialNonConformity?.title ?? initialTitle
    );
    setDescription(
      preferDraftValues
        ? initialDescription
        : initialNonConformity?.description ?? initialDescription
    );
    setSeverity(
      preferDraftValues
        ? initialSeverity
        : initialNonConformity?.severity ?? initialSeverity
    );
    setEvidenceUris(
      preferDraftValues
        ? dedupeStrings(initialEvidenceUris)
        : dedupeStrings([
            ...(initialNonConformity?.evidence_uris ?? []),
            ...initialEvidenceUris,
          ])
    );
    setEvidenceIds(
      preferDraftValues
        ? dedupeStrings(initialEvidenceIds)
        : dedupeStrings([
            ...(initialNonConformity?.evidence_ids ?? []),
            ...initialEvidenceIds,
          ])
    );
    setFieldErrors({});
    setSubmitError(null);
  }, [
    visible,
    preferDraftValues,
    initialNonConformity,
    itemId,
    initialTitle,
    initialDescription,
    initialSeverity,
    initialEvidenceUris,
    initialEvidenceIds,
  ]);

  const severityMeta = NON_CONFORMITY_SEVERITY_META[severity];
  const requiresStrictEvidence = requiresCompulsoryEvidenceAndDescription(severity);
  const totalPhotosCount = evidenceUris.length + evidenceIds.length;
  const missingRequiredPhoto = requiresStrictEvidence && totalPhotosCount === 0;
  const trimmedDescriptionLength = description.trim().length;
  const isBusy = isSaving || isDeleting;
  const isSaveBlocked = readOnly || isBusy || missingRequiredPhoto;

  const isAlreadySynced = Boolean(
    initialNonConformity &&
      (initialNonConformity.sync_status === 'SINCRONIZADO' ||
        Boolean(initialNonConformity.remote_id))
  );

  const displayedPhotoItems = useMemo(() => {
    return evidenceUris.map((uri, index) => ({
      uri,
      id: evidenceIds[index] ?? null,
    }));
  }, [evidenceUris, evidenceIds]);

  if (!visible) {
    return null;
  }

  const resolvedScopedItemId = attachToItem ? effectiveItemId : null;
  const resolvedScopedItemTitle = attachToItem ? effectiveItemTitle : null;

  const handleRemoveEvidenceAt = (indexToRemove: number) => {
    if (readOnly || isBusy) return;
    setEvidenceUris((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setEvidenceIds((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleTriggerAttachPhoto = () => {
    if (readOnly || isBusy || !onAttachPhoto) return;
    onAttachPhoto({
      inspectionId,
      editingNonConformityId: initialNonConformity?.id ?? null,
      itemId: resolvedScopedItemId,
      itemTitle: resolvedScopedItemTitle,
      title,
      description,
      severity,
      evidenceUris,
      evidenceIds,
    });
  };

  const handleSavePress = async () => {
    if (isSaveBlocked) return;

    const payload: NonConformityFormSubmitPayload = {
      ...(initialNonConformity?.id ? { id: initialNonConformity.id } : {}),
      inspection_id: inspectionId,
      item_id: resolvedScopedItemId,
      item_title: resolvedScopedItemTitle,
      title: title.trim(),
      description: description.trim(),
      severity,
      evidence_uris: evidenceUris,
      evidence_ids: evidenceIds,
    };

    const validation = validateNonConformity(payload);
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      setSubmitError(
        validation.fieldErrors.evidence_uris ??
          validation.errors[0] ??
          'Revise os campos obrigatórios antes de salvar.'
      );
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    await onSubmit(payload);
  };

  const modalCard = (
    <View style={styles.backdrop}>
      <View
        testID={testID}
        style={[
          styles.dialogCard,
          { borderColor: severityMeta.accentColor },
        ]}
      >
        {/* Cabeçalho com indicação de criticidade e fechamento */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: severityMeta.badgeBg,
              borderBottomColor: severityMeta.badgeBorder,
            },
          ]}
        >
          <View
            style={[
              styles.headerIconCircle,
              { backgroundColor: severityMeta.accentColor },
            ]}
          >
            <MaterialIcons
              name={severityMeta.icon}
              size={22}
              color={tokens.colors.textInverse}
            />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>
              {readOnly
                ? 'Detalhes da Não Conformidade'
                : initialNonConformity
                  ? 'Editar Não Conformidade'
                  : 'Registrar Não Conformidade'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: severityMeta.badgeText }]}>
              Severidade {severityMeta.label.toUpperCase()} • {severityMeta.description}
            </Text>
          </View>
          <TouchableOpacity
            testID="nc-close-icon-btn"
            style={styles.closeIconBtn}
            onPress={onClose}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Fechar formulário de não conformidade"
          >
            <MaterialIcons name="close" size={20} color={tokens.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner Somente Leitura (EX-02) */}
          {readOnly && (
            <View
              testID="nc-readonly-banner"
              style={styles.readOnlyBanner}
              accessibilityRole="alert"
            >
              <MaterialIcons name="lock" size={18} color="#92400E" />
              <Text style={styles.readOnlyText}>{READ_ONLY_NON_CONFORMITY_MESSAGE}</Text>
            </View>
          )}

          {/* Vínculo Contextual: Item do Checklist ou Inspeção Geral (RF-01 / RF-02) */}
          <View testID="nc-scope-badge" style={styles.scopeCard}>
            <View style={styles.scopeRow}>
              <MaterialIcons
                name={resolvedScopedItemId ? 'fact-check' : 'assignment'}
                size={18}
                color={tokens.colors.primary}
              />
              <View style={styles.scopeTextWrap}>
                <Text style={styles.scopeOverline}>
                  {resolvedScopedItemId
                    ? 'VINCULADA AO ITEM DO CHECKLIST'
                    : 'VINCULADA À INSPEÇÃO COMO UM TODO'}
                </Text>
                <Text style={styles.scopeTitle}>
                  {resolvedScopedItemId
                    ? resolvedScopedItemTitle || `Item #${resolvedScopedItemId}`
                    : `Inspeção #${inspectionId}`}
                </Text>
              </View>
            </View>

            {Boolean(effectiveItemId) && !readOnly && (
              <View style={styles.scopeToggleRow}>
                <TouchableOpacity
                  testID="nc-scope-item-btn"
                  style={[
                    styles.scopeChip,
                    attachToItem && styles.scopeChipActive,
                  ]}
                  onPress={() => setAttachToItem(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: attachToItem }}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      attachToItem && styles.scopeChipTextActive,
                    ]}
                  >
                    Item específico
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="nc-scope-inspection-btn"
                  style={[
                    styles.scopeChip,
                    !attachToItem && styles.scopeChipActive,
                  ]}
                  onPress={() => setAttachToItem(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !attachToItem }}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      !attachToItem && styles.scopeChipTextActive,
                    ]}
                  >
                    Inspeção geral
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Seletor de Criticidade com Cores de Advertência (RF-03 / Passo 3) */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Criticidade / Severidade <Text style={styles.requiredMark}>*</Text>
            </Text>
            <View testID="nc-severity-selector" style={styles.severityGrid}>
              {NON_CONFORMITY_SEVERITIES.map((sevKey) => {
                const meta = NON_CONFORMITY_SEVERITY_META[sevKey];
                const isSelected = severity === sevKey;

                return (
                  <TouchableOpacity
                    key={sevKey}
                    testID={`nc-severity-${sevKey}`}
                    style={[
                      styles.severityButton,
                      isSelected && {
                        backgroundColor: meta.badgeBg,
                        borderColor: meta.accentColor,
                        borderWidth: 2,
                      },
                      readOnly && styles.disabledControl,
                    ]}
                    disabled={readOnly || isBusy}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSeverity(sevKey);
                      setSubmitError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Criticidade ${meta.label}`}
                    accessibilityState={{ selected: isSelected, disabled: readOnly }}
                  >
                    <View style={styles.severityBtnTop}>
                      <MaterialIcons
                        name={meta.icon}
                        size={18}
                        color={isSelected ? meta.accentColor : tokens.colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.severityBtnLabel,
                          isSelected && { color: meta.badgeText, fontWeight: '700' },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.severityBtnHint,
                        isSelected && { color: meta.badgeText },
                      ]}
                      numberOfLines={2}
                    >
                      {meta.requiresPhotoEvidence ? 'Foto + desc. obrig.' : 'Registro padrão'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!fieldErrors.severity && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {fieldErrors.severity}
              </Text>
            )}
          </View>

          {/* Título da Não Conformidade */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Título da Ocorrência <Text style={styles.requiredMark}>*</Text>
            </Text>
            <TextInput
              testID="nc-title-input"
              style={[
                styles.input,
                !!fieldErrors.title && styles.inputError,
                readOnly && styles.disabledInput,
              ]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => ({ ...prev, title: '' }));
                }
              }}
              placeholder="Ex: Vazamento hidráulico na mangueira principal"
              placeholderTextColor={tokens.colors.textMuted}
              editable={!readOnly && !isBusy}
              maxLength={160}
              accessibilityLabel="Título da não conformidade"
            />
            {!!fieldErrors.title && (
              <Text
                testID="nc-title-error"
                style={styles.errorText}
                accessibilityRole="alert"
              >
                {fieldErrors.title}
              </Text>
            )}
          </View>

          {/* Descrição Detalhada (Compulsória para ALTA / CRITICA - RF-04) */}
          <View style={styles.fieldBlock}>
            <View style={styles.labelRowBetween}>
              <Text style={styles.fieldLabel}>
                Descrição Detalhada{' '}
                {requiresStrictEvidence && <Text style={styles.requiredMark}>*</Text>}
              </Text>
              {requiresStrictEvidence && (
                <Text
                  style={[
                    styles.charCounter,
                    trimmedDescriptionLength < MIN_DETAILED_DESCRIPTION_LENGTH
                      ? styles.charCounterPending
                      : styles.charCounterOk,
                  ]}
                >
                  {trimmedDescriptionLength}/{MIN_DETAILED_DESCRIPTION_LENGTH} mín.
                </Text>
              )}
            </View>

            <TextInput
              testID="nc-description-input"
              style={[
                styles.textArea,
                !!fieldErrors.description && styles.inputError,
                readOnly && styles.disabledInput,
              ]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => ({ ...prev, description: '' }));
                }
              }}
              placeholder={
                requiresStrictEvidence
                  ? 'Descreva em detalhes o defeito, risco operacional e local exato da anomalia...'
                  : 'Descreva a irregularidade observada em campo...'
              }
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!readOnly && !isBusy}
              accessibilityLabel="Descrição detalhada da não conformidade"
            />
            {!!fieldErrors.description && (
              <Text
                testID="nc-description-error"
                style={styles.errorText}
                accessibilityRole="alert"
              >
                {fieldErrors.description}
              </Text>
            )}
          </View>

          {/* Evidências Fotográficas e Alerta EX-01 */}
          <View style={styles.fieldBlock}>
            <View style={styles.labelRowBetween}>
              <Text style={styles.fieldLabel}>
                Evidências Fotográficas ({totalPhotosCount}){' '}
                {requiresStrictEvidence && <Text style={styles.requiredMark}>*</Text>}
              </Text>
              <Text
                style={[
                  styles.photoRequirementPill,
                  requiresStrictEvidence
                    ? styles.photoRequirementStrict
                    : styles.photoRequirementOptional,
                ]}
              >
                {requiresStrictEvidence ? 'Obrigatória' : 'Opcional'}
              </Text>
            </View>

            {/* EX-01 / CA-02: Alerta em destaque quando criticidade crítica/alta não possui foto */}
            {missingRequiredPhoto && (
              <View
                testID="nc-critical-photo-alert"
                style={styles.criticalPhotoAlert}
                accessibilityRole="alert"
              >
                <MaterialIcons name="add-a-photo" size={20} color="#991B1B" />
                <Text style={styles.criticalPhotoAlertText}>
                  {CRITICAL_PHOTO_REQUIRED_MESSAGE}
                </Text>
              </View>
            )}

            {displayedPhotoItems.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosStrip}
              >
                {displayedPhotoItems.map((photo, index) => (
                  <View
                    key={`${photo.uri}-${index}`}
                    testID={`nc-evidence-thumb-${index}`}
                    style={styles.photoCard}
                  >
                    <Image
                      source={{ uri: resolveRenderableEvidenceUri(photo.uri) }}
                      style={styles.photoThumb}
                      resizeMode="cover"
                    />
                    {!readOnly && (
                      <TouchableOpacity
                        testID={`nc-remove-photo-btn-${index}`}
                        style={styles.removePhotoBtn}
                        onPress={() => handleRemoveEvidenceAt(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover foto ${index + 1}`}
                      >
                        <MaterialIcons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyPhotosBox}>
                <MaterialIcons
                  name="photo-camera"
                  size={18}
                  color={tokens.colors.textMuted}
                />
                <Text style={styles.emptyPhotosText}>
                  Nenhuma fotografia anexada a esta ocorrência.
                </Text>
              </View>
            )}

            {!readOnly && onAttachPhoto && (
              <TouchableOpacity
                testID="nc-attach-photo-btn"
                style={[
                  styles.attachPhotoBtn,
                  missingRequiredPhoto && styles.attachPhotoBtnUrgent,
                ]}
                activeOpacity={0.85}
                disabled={isBusy}
                onPress={handleTriggerAttachPhoto}
                accessibilityRole="button"
                accessibilityLabel="Anexar fotografia como evidência"
              >
                <MaterialIcons
                  name="add-a-photo"
                  size={18}
                  color={missingRequiredPhoto ? tokens.colors.danger : tokens.colors.primary}
                />
                <Text
                  style={[
                    styles.attachPhotoBtnText,
                    missingRequiredPhoto && { color: tokens.colors.danger },
                  ]}
                >
                  {totalPhotosCount > 0
                    ? 'Capturar Outra Fotografia'
                    : 'Capturar Fotografia de Evidência'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Erro geral retornado pela submissão ou repositório */}
          {(submitError || errorMessage) && !missingRequiredPhoto && (
            <View
              testID="nc-submit-error-banner"
              style={styles.submitErrorBox}
              accessibilityRole="alert"
            >
              <MaterialIcons name="error-outline" size={18} color="#991B1B" />
              <Text style={styles.submitErrorText}>
                {errorMessage || submitError}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Rodapé de Ações */}
        <View style={styles.footer}>
          {!readOnly && (
            <Button
              testID="nc-save-btn"
              title={
                isSaving
                  ? 'Salvando Offline...'
                  : initialNonConformity
                    ? 'Atualizar Não Conformidade'
                    : 'Salvar Não Conformidade'
              }
              variant={severity === 'CRITICA' ? 'danger' : 'primary'}
              isLoading={isSaving}
              disabled={isSaveBlocked}
              onPress={() => void handleSavePress()}
              accessibilityLabel="Salvar não conformidade"
            />
          )}

          {!readOnly && initialNonConformity && onDeleteOrCancel && (
            <Button
              testID="nc-delete-btn"
              title={
                isDeleting
                  ? 'Processando...'
                  : isAlreadySynced
                    ? 'Cancelar Apontamento (Auditoria)'
                    : 'Excluir Apontamento'
              }
              variant="danger"
              isLoading={isDeleting}
              disabled={isBusy}
              onPress={() => void onDeleteOrCancel(initialNonConformity)}
            />
          )}

          <Button
            testID="nc-cancel-btn"
            title={readOnly ? 'Fechar' : 'Cancelar'}
            variant="secondary"
            disabled={isBusy}
            onPress={onClose}
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document === 'undefined') {
    return modalCard;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isBusy ? undefined : onClose}
    >
      {modalCard}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    borderWidth: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderBottomWidth: 1,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.m,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 17,
  },
  scopeCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
    gap: tokens.spacing.s,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  scopeTextWrap: {
    flex: 1,
  },
  scopeOverline: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primary,
    letterSpacing: 0.5,
  },
  scopeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 1,
  },
  scopeToggleRow: {
    flexDirection: 'row',
    gap: tokens.spacing.s,
  },
  scopeChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.s,
    borderRadius: tokens.borderRadius.small,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
  },
  scopeChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: tokens.colors.primary,
  },
  scopeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  scopeChipTextActive: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  requiredMark: {
    color: tokens.colors.danger,
  },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  charCounter: {
    fontSize: 11,
    fontWeight: '700',
  },
  charCounterPending: {
    color: '#B45309',
  },
  charCounterOk: {
    color: tokens.colors.success,
  },
  severityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.s,
  },
  severityButton: {
    width: '48%',
    minHeight: 62,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.s,
    justifyContent: 'center',
    gap: 3,
  },
  severityBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.text,
  },
  severityBtnHint: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  disabledControl: {
    opacity: 0.65,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.s,
    fontSize: 14,
    color: tokens.colors.text,
  },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.m,
    paddingVertical: tokens.spacing.s + 2,
    fontSize: 14,
    color: tokens.colors.text,
  },
  inputError: {
    borderColor: tokens.colors.danger,
    borderWidth: 1.5,
  },
  disabledInput: {
    backgroundColor: tokens.colors.background,
    color: tokens.colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: tokens.colors.danger,
    fontWeight: '600',
  },
  photoRequirementPill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  photoRequirementStrict: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  photoRequirementOptional: {
    backgroundColor: '#E2E8F0',
    color: '#475569',
  },
  criticalPhotoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  criticalPhotoAlertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    lineHeight: 18,
  },
  photosStrip: {
    gap: tokens.spacing.s,
    paddingVertical: 2,
  },
  photoCard: {
    width: 84,
    height: 84,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  emptyPhotosText: {
    flex: 1,
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  attachPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    minHeight: 46,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: tokens.spacing.m,
  },
  attachPhotoBtnUrgent: {
    borderColor: tokens.colors.danger,
    backgroundColor: '#FEF2F2',
  },
  attachPhotoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  submitErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  footer: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
});
