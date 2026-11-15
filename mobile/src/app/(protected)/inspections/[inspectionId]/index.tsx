import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/design-system/components/Button';
import { Card } from '@/design-system/components/Card';
import { StatusBadge, type InspectionStatus } from '@/design-system/components/StatusBadge';
import { tokens } from '@/design-system/tokens';
import {
  INSPECTION_NOT_FOUND_MESSAGE,
  PERMISSION_DENIED_MESSAGE,
  PriorityBadge,
  SyncStatusBadge,
  type UseInspectionDetailsOptions,
  useInspectionDetails,
} from '@/features/inspections';
import { DynamicItemRenderer } from '@/features/checklist';
import { getEquipmentVerificationRecord } from '@/features/scanner/services/qrValidator';
import { getDatabase } from '@/infrastructure/database/db';
import { inspectionRepository } from '@/infrastructure/database/repositories/inspectionRepository';
import { outboxRepository } from '@/infrastructure/database/repositories/outboxRepository';
import {
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistSection,
} from '@/infrastructure/database/types';
import { generateUUID } from '@/infrastructure/sync/uuid';

export interface InspectionDetailsScreenProps {
  inspectionId?: string;
  detailsOptions?: UseInspectionDetailsOptions;
}

function formatDateTime(isoDate?: string | null): string {
  if (!isoDate) {
    return 'Não definida';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return `${parsed.toLocaleDateString('pt-BR')} às ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatResponseTypeLabel(type: string): string {
  switch (type) {
    case 'CONFORMITY':
      return 'Conformidade';
    case 'BOOLEAN':
      return 'Sim / Não';
    case 'NUMBER':
      return 'Numérico';
    case 'SINGLE_CHOICE':
      return 'Seleção Única';
    case 'DATE':
      return 'Data';
    case 'TEXT_LONG':
      return 'Texto Longo';
    default:
      return 'Texto';
  }
}

function parseStoredResponseValue(
  item: ChecklistItem,
  rawValue?: string | null
): unknown {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return item.response_type === 'BOOLEAN' ? undefined : '';
  }
  if (item.response_type === 'BOOLEAN') {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
  }
  if (item.response_type === 'NUMBER') {
    const num = Number(rawValue);
    return Number.isFinite(num) ? num : rawValue;
  }
  return rawValue;
}

function serializeChecklistValue(nextValue: unknown): string {
  if (nextValue === null || nextValue === undefined) {
    return '';
  }
  if (typeof nextValue === 'string') {
    return nextValue;
  }
  if (typeof nextValue === 'boolean' || typeof nextValue === 'number') {
    return String(nextValue);
  }
  try {
    return JSON.stringify(nextValue);
  } catch {
    return String(nextValue);
  }
}

export default function InspectionDetailsScreen(props: InspectionDetailsScreenProps) {
  const { inspectionId: propInspectionId, detailsOptions } = props ?? {};
  const router = useRouter();
  const params = useLocalSearchParams<{
    inspectionId?: string;
    id?: string;
    qrVerified?: string;
    openChecklist?: string;
    scannedCode?: string;
    divergenceJustified?: string;
  }>();
  const resolvedId = useMemo(() => {
    const raw = propInspectionId ?? params.inspectionId ?? params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [propInspectionId, params.inspectionId, params.id]);

  const {
    inspection,
    sections,
    items,
    responses,
    equipment,
    site,
    progress,
    isOverdue,
    isPendingSync,
    action,
    isLoading,
    isRefreshing,
    isForbidden,
    permissionDeniedMessage,
    notFound,
    snackbar,
    dismissSnackbar,
    reloadLocal,
    refresh,
  } = useInspectionDetails(resolvedId, detailsOptions);

  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [isChecklistInteractive, setIsChecklistInteractive] = useState(
    Boolean(params.openChecklist === 'true' || params.qrVerified === 'true')
  );
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);
  const isFirstFocusRef = useRef(true);

  useEffect(() => {
    if (params.openChecklist === 'true' || params.qrVerified === 'true') {
      setIsChecklistInteractive(true);
      setActionFeedback({
        type: 'success',
        text:
          params.divergenceJustified === 'true'
            ? 'Divergência registrada com justificativa. Checklist liberado para preenchimento offline.'
            : 'Equipamento validado via QR Code! Preencha os itens do checklist abaixo.',
      });
    }
  }, [params.openChecklist, params.qrVerified, params.divergenceJustified]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      reloadLocal();
    }, [reloadLocal])
  );

  // EX-01: Redireciona de volta para a lista quando tentativa de acesso não autorizado é detectada
  useEffect(() => {
    if (!isForbidden) {
      return;
    }
    const timer = setTimeout(() => {
      router.replace('/(protected)/(tabs)/inspections');
    }, 2200);
    return () => clearTimeout(timer);
  }, [isForbidden, router]);

  const respondedItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of responses) {
      if (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') {
        ids.add(r.item_id);
      }
    }
    return ids;
  }, [responses]);

  const responseByItemId = useMemo(() => {
    const map = new Map<string, ChecklistResponse>();
    for (const r of responses) {
      map.set(r.item_id, r);
    }
    return map;
  }, [responses]);

  const verificationRecord = inspection
    ? getEquipmentVerificationRecord(inspection.id)
    : null;
  const isQrVerified = Boolean(verificationRecord) || params.qrVerified === 'true';
  const isEditableInspection = action.type === 'START' || action.type === 'CONTINUE';

  const handleSaveChecklistAnswer = useCallback(
    async (
      item: ChecklistItem,
      nextValue: unknown,
      nonConformityDescription?: string
    ) => {
      if (!inspection) return;
      const serialized = serializeChecklistValue(nextValue);
      const isNonConformity =
        item.response_type === 'CONFORMITY' && serialized === 'NON_CONFORMING' ? 1 : 0;
      const respondedAt = new Date().toISOString();
      const existing = responseByItemId.get(item.id);
      const responseId = existing?.id ?? generateUUID();
      const finalNcDescription =
        isNonConformity === 1
          ? nonConformityDescription ?? existing?.non_conformity_description ?? null
          : null;

      try {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO checklist_responses (
            id, item_id, inspection_id, value, is_non_conformity, non_conformity_description, responded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_id) DO UPDATE SET
            value = excluded.value,
            is_non_conformity = excluded.is_non_conformity,
            non_conformity_description = excluded.non_conformity_description,
            responded_at = excluded.responded_at;`,
          [
            responseId,
            item.id,
            inspection.id,
            serialized,
            isNonConformity,
            finalNcDescription,
            respondedAt,
          ]
        );

        await inspectionRepository.update(inspection.id, {
          status:
            inspection.status === 'ATRIBUÍDA' || inspection.status === 'RASCUNHO'
              ? 'EM_ANDAMENTO'
              : inspection.status,
          started_at: inspection.started_at ?? respondedAt,
          sync_status: 'PENDENTE',
        });

        await outboxRepository.create({
          id: generateUUID(),
          entity_type: 'CHECKLIST_RESPONSE',
          global_id: responseId,
          operation_type: 'SUBMIT_RESPONSE',
          payload: JSON.stringify({
            id: responseId,
            inspectionId: inspection.id,
            itemId: item.id,
            value: serialized,
            isNonConformity: isNonConformity === 1,
            nonConformityDescription: finalNcDescription,
            respondedAt,
          }),
          status: 'PENDING',
        });

        await reloadLocal();
      } catch {
        setActionFeedback({
          type: 'info',
          text: 'Não foi possível salvar a resposta no SQLite local neste momento.',
        });
      }
    },
    [inspection, responseByItemId, reloadLocal]
  );

  const groupedSections = useMemo(() => {
    const bySection = new Map<string, ChecklistItem[]>();
    for (const item of items) {
      const list = bySection.get(item.section_id) ?? [];
      list.push(item);
      bySection.set(item.section_id, list);
    }

    if (sections.length === 0 && items.length > 0) {
      return [
        {
          section: {
            id: 'default-section',
            inspection_id: inspection?.id ?? '',
            title: 'Itens do Checklist',
            order_index: 0,
          } as ChecklistSection,
          sectionItems: items,
        },
      ];
    }

    return sections.map((sec) => ({
      section: sec,
      sectionItems: bySection.get(sec.id) ?? [],
    }));
  }, [sections, items, inspection?.id]);

  const handlePrimaryAction = useCallback(async () => {
    if (!inspection) return;

    if (action.type === 'START') {
      if (!isQrVerified) {
        router.push({
          pathname: '/(protected)/scanner',
          params: { inspectionId: inspection.id },
        });
        return;
      }

      setIsUpdatingAction(true);
      setActionFeedback(null);
      try {
        await inspectionRepository.update(inspection.id, {
          status: 'EM_ANDAMENTO',
          started_at: inspection.started_at ?? new Date().toISOString(),
          sync_status: 'PENDENTE',
        });
        await reloadLocal();
        setIsChecklistInteractive(true);
        setActionFeedback({
          type: 'success',
          text: 'Inspeção iniciada no dispositivo (EM_ANDAMENTO). Você já pode responder ao checklist abaixo.',
        });
      } finally {
        setIsUpdatingAction(false);
      }
      return;
    }

    if (action.type === 'CONTINUE') {
      setIsChecklistInteractive(true);
      setActionFeedback({
        type: 'info',
        text: `Checklist interativo ativo (${progress.answeredItems}/${progress.totalItems} itens respondidos). As respostas são salvas offline automaticamente.`,
      });
      return;
    }

    setActionFeedback({
      type: 'info',
      text: `Modo consulta (somente leitura) para inspeção no estado ${inspection.status}.`,
    });
  }, [
    inspection,
    action.type,
    isQrVerified,
    progress.answeredItems,
    progress.totalItems,
    reloadLocal,
    router,
  ]);

  // EX-01: Tela de Permissão Negada
  if (isForbidden) {
    return (
      <View testID="inspection-forbidden-view" style={styles.centeredState}>
        <View style={styles.forbiddenIconCircle}>
          <MaterialIcons name="lock-outline" size={44} color={tokens.colors.danger} />
        </View>
        <Text style={styles.centeredTitle}>Permissão Negada</Text>
        <Text style={styles.centeredDescription}>
          {permissionDeniedMessage || PERMISSION_DENIED_MESSAGE}
        </Text>
        <Text style={styles.redirectHint}>
          Retornando para a lista de inspeções...
        </Text>
        <View style={styles.centeredBtnWrap}>
          <Button
            testID="inspection-forbidden-back-btn"
            title="Voltar para Minhas Inspeções"
            onPress={() => router.replace('/(protected)/(tabs)/inspections')}
            variant="danger"
          />
        </View>
      </View>
    );
  }

  if (isLoading && !inspection) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.centeredDescription}>
          Carregando detalhes da inspeção no SQLite...
        </Text>
      </View>
    );
  }

  if (notFound || !inspection) {
    return (
      <View testID="inspection-not-found-view" style={styles.centeredState}>
        <MaterialIcons name="find-in-page" size={52} color={tokens.colors.textMuted} />
        <Text style={styles.centeredTitle}>Inspeção Não Encontrada</Text>
        <Text style={styles.centeredDescription}>
          {INSPECTION_NOT_FOUND_MESSAGE}
        </Text>
        <View style={styles.centeredBtnWrap}>
          <Button
            title={isRefreshing ? 'Buscando...' : 'Tentar Atualizar do Servidor'}
            onPress={() => {
              void refresh();
            }}
            isLoading={isRefreshing}
            disabled={isRefreshing}
            variant="primary"
          />
          <Button
            title="Voltar para a Lista"
            onPress={() => router.replace('/(protected)/(tabs)/inspections')}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  const effectiveSyncStatus = isPendingSync
    ? inspection.sync_status && inspection.sync_status !== 'SINCRONIZADO'
      ? inspection.sync_status
      : 'PENDENTE'
    : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void refresh();
            }}
          />
        }
      >
        {/* Faixas de alerta de atraso ou motivo de reprovação/cancelamento */}
        {isOverdue && (
          <View testID="details-overdue-banner" style={styles.overdueBanner}>
            <MaterialIcons name="warning" size={18} color={tokens.colors.textInverse} />
            <Text style={styles.overdueBannerText}>
              Prazo limite ultrapassado • Inspeção em atraso
            </Text>
          </View>
        )}

        {!!inspection.rejection_reason && (
          <Card style={styles.rejectionCard}>
            <View style={styles.rowIconHeader}>
              <MaterialIcons name="error-outline" size={20} color={tokens.colors.danger} />
              <Text style={styles.rejectionTitle}>Observação / Motivo Registrado</Text>
            </View>
            <Text style={styles.rejectionText}>{inspection.rejection_reason}</Text>
          </Card>
        )}

        {actionFeedback && (
          <View
            testID="details-action-feedback"
            style={[
              styles.feedbackBanner,
              actionFeedback.type === 'success'
                ? styles.feedbackSuccess
                : styles.feedbackInfo,
            ]}
          >
            <MaterialIcons
              name={actionFeedback.type === 'success' ? 'check-circle' : 'info-outline'}
              size={18}
              color={
                actionFeedback.type === 'success'
                  ? tokens.colors.success
                  : tokens.colors.primary
              }
            />
            <Text style={styles.feedbackText}>{actionFeedback.text}</Text>
          </View>
        )}

        {/* Cabeçalho principal */}
        <Card style={styles.sectionCard}>
          <Text style={styles.clientOverline}>CLIENTE</Text>
          <Text testID="details-client-name" style={styles.clientName}>
            {inspection.client_name || inspection.client}
          </Text>
          {!!inspection.title && (
            <Text testID="details-title" style={styles.inspectionTitle}>
              {inspection.title}
            </Text>
          )}

          <View style={styles.badgesRow}>
            <StatusBadge status={inspection.status as InspectionStatus} />
            <PriorityBadge priority={inspection.priority} />
            {effectiveSyncStatus && (
              <SyncStatusBadge syncStatus={effectiveSyncStatus} />
            )}
          </View>
        </Card>

        {/* Equipamento e QR Code previsto (RF-05) */}
        <Card testID="details-equipment-card" style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="build" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Equipamento</Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Nome do Equipamento</Text>
            <Text testID="details-equipment-name" style={styles.fieldValue}>
              {equipment?.name || 'Não especificado'}
            </Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Código</Text>
            <Text testID="details-equipment-code" style={styles.fieldValue}>
              {equipment?.code || 'Não informado'}
            </Text>
          </View>

          <View style={styles.qrBox}>
            <MaterialIcons name="qr-code-2" size={28} color={tokens.colors.primary} />
            <View style={styles.qrTextContainer}>
              <Text style={styles.qrLabel}>QR CODE PREVISTO</Text>
              <Text testID="details-equipment-qrcode" style={styles.qrValue}>
                {equipment?.qrCode || 'Não cadastrado'}
              </Text>
            </View>
          </View>

          {isQrVerified && (
            <View
              testID="details-qr-verified-badge"
              style={[
                styles.verifiedPill,
                verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                params.divergenceJustified === 'true'
                  ? styles.verifiedPillWarning
                  : styles.verifiedPillSuccess,
              ]}
            >
              <MaterialIcons
                name="verified"
                size={16}
                color={
                  verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                  params.divergenceJustified === 'true'
                    ? '#92400E'
                    : '#166534'
                }
              />
              <Text
                style={[
                  styles.verifiedPillText,
                  verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                  params.divergenceJustified === 'true'
                    ? styles.verifiedPillTextWarning
                    : styles.verifiedPillTextSuccess,
                ]}
              >
                {verificationRecord?.mode === 'DIVERGENCE_OVERRIDE' ||
                params.divergenceJustified === 'true'
                  ? 'Divergência justificada • equipamento liberado'
                  : `Equipamento validado em campo${
                      verificationRecord?.scannedCode || params.scannedCode
                        ? ` (${verificationRecord?.scannedCode || params.scannedCode})`
                        : ''
                    }`}
              </Text>
            </View>
          )}

          {isEditableInspection && (
            <Button
              testID="details-scan-qr-button"
              title={
                isQrVerified
                  ? 'Revalidar QR Code do Equipamento'
                  : 'Validar Equipamento (QR Code)'
              }
              variant={isQrVerified ? 'secondary' : 'primary'}
              onPress={() =>
                router.push({
                  pathname: '/(protected)/scanner',
                  params: { inspectionId: inspection.id },
                })
              }
              style={styles.scanQrButton}
            />
          )}
        </Card>

        {/* Localização e Endereço Completo (RF-05) */}
        <Card testID="details-site-card" style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Local e Endereço</Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Unidade / Local</Text>
            <Text testID="details-site-name" style={styles.fieldValue}>
              {site?.name || 'Local não informado'}
            </Text>
          </View>

          <View style={styles.detailField}>
            <Text style={styles.fieldLabel}>Endereço Completo</Text>
            <Text testID="details-site-address" style={styles.fieldValueMuted}>
              {site?.address || site?.fullAddress || 'Endereço não cadastrado'}
            </Text>
          </View>
        </Card>

        {/* Prazos e Instruções de Campo */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="event-note" size={20} color={tokens.colors.primary} />
            <Text style={styles.cardTitle}>Prazos e Instruções</Text>
          </View>

          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Data prevista:</Text>
            <Text
              style={[
                styles.timelineValue,
                isOverdue && { color: tokens.colors.danger },
              ]}
            >
              {formatDateTime(inspection.due_date)}
            </Text>
          </View>

          {!!inspection.started_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Iniciada em:</Text>
              <Text style={styles.timelineValue}>
                {formatDateTime(inspection.started_at)}
              </Text>
            </View>
          )}

          {!!inspection.completed_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Concluída em:</Text>
              <Text style={styles.timelineValue}>
                {formatDateTime(inspection.completed_at)}
              </Text>
            </View>
          )}

          {!!inspection.technician_name && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Técnico:</Text>
              <Text style={styles.timelineValue}>{inspection.technician_name}</Text>
            </View>
          )}

          {!!inspection.instructions && (
            <View style={styles.instructionsBox}>
              <Text style={styles.fieldLabel}>Instruções da Ordem</Text>
              <Text style={styles.instructionsText}>{inspection.instructions}</Text>
            </View>
          )}
        </Card>

        {/* Resumo de Progresso e Itens do Checklist Offline */}
        <Card testID="details-checklist-card" style={styles.sectionCard}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="fact-check" size={20} color={tokens.colors.primary} />
              <Text style={styles.cardTitle}>Progresso do Checklist</Text>
            </View>
            <Text style={styles.progressPercent}>{progress.percentage}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` },
              ]}
            />
          </View>

          <View style={styles.progressStatsGrid}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>
                {progress.answeredItems}/{progress.totalItems}
              </Text>
              <Text style={styles.statLabel}>Respondidos</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{progress.pendingRequiredItems}</Text>
              <Text style={styles.statLabel}>Obrig. pendentes</Text>
            </View>
            <View style={styles.statChip}>
              <Text
                style={[
                  styles.statValue,
                  progress.nonConformitiesCount > 0 && { color: tokens.colors.danger },
                ]}
              >
                {progress.nonConformitiesCount}
              </Text>
              <Text style={styles.statLabel}>Não conf.</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{progress.evidencesCount}</Text>
              <Text style={styles.statLabel}>Evidências</Text>
            </View>
          </View>

          {groupedSections.length === 0 ? (
            <Text style={styles.noItemsText}>
              Nenhum item de snapshot encontrado localmente para esta inspeção.
            </Text>
          ) : (
            groupedSections.map(({ section, sectionItems }) => (
              <View key={section.id} style={styles.checklistSectionBlock}>
                <Text style={styles.checklistSectionTitle}>
                  {section.title} ({sectionItems.length})
                </Text>
                {sectionItems.map((item) => {
                  const isAnswered = respondedItemIds.has(item.id);
                  const currentResponse = responseByItemId.get(item.id);
                  return (
                    <View key={item.id} style={styles.checklistItemBlock}>
                      <View style={styles.checklistItemRow}>
                        <MaterialIcons
                          name={
                            isAnswered
                              ? 'check-circle'
                              : 'radio-button-unchecked'
                          }
                          size={16}
                          color={
                            isAnswered
                              ? tokens.colors.success
                              : tokens.colors.textMuted
                          }
                        />
                        <View style={styles.checklistItemTextWrap}>
                          <Text style={styles.checklistItemTitle}>
                            {item.title}
                            {Boolean(item.required) ? ' *' : ''}
                          </Text>
                          <Text style={styles.checklistItemMeta}>
                            {formatResponseTypeLabel(item.response_type)}
                          </Text>
                        </View>
                      </View>

                      {isChecklistInteractive && isEditableInspection && (
                        <View style={styles.interactiveInputWrap}>
                          <DynamicItemRenderer
                            testID={`checklist-item-input-${item.id}`}
                            item={item}
                            value={parseStoredResponseValue(item, currentResponse?.value)}
                            nonConformityDescription={
                              currentResponse?.non_conformity_description ?? ''
                            }
                            onChange={(val) =>
                              void handleSaveChecklistAnswer(
                                item,
                                val,
                                currentResponse?.non_conformity_description ?? undefined
                              )
                            }
                            onNonConformityDescriptionChange={(desc) =>
                              void handleSaveChecklistAnswer(
                                item,
                                currentResponse?.value ?? 'NON_CONFORMING',
                                desc
                              )
                            }
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Rodapé fixo com botão de ação dinâmico (RF-05, CA-03) */}
      <View style={styles.footerBar}>
        <Button
          testID="inspection-action-button"
          title={action.label}
          variant={action.variant}
          isLoading={isUpdatingAction}
          disabled={isUpdatingAction || action.disabled}
          onPress={handlePrimaryAction}
          accessibilityLabel={action.label}
        />
      </View>

      {/* Snackbar discreto em falha de refresh (EX-02, RT-03) */}
      {snackbar?.visible && (
        <View
          testID="details-offline-snackbar"
          style={styles.snackbar}
          accessibilityRole="alert"
        >
          <MaterialIcons name="cloud-off" size={18} color={tokens.colors.textInverse} />
          <Text style={styles.snackbarText}>{snackbar.message}</Text>
          <TouchableOpacity onPress={dismissSnackbar} accessibilityLabel="Fechar aviso">
            <Text style={styles.snackbarAction}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: tokens.spacing.m,
    paddingBottom: tokens.spacing.xxl + 24,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
    backgroundColor: tokens.colors.background,
    gap: tokens.spacing.s,
  },
  forbiddenIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8d7da',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.s,
  },
  centeredTitle: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    textAlign: 'center',
  },
  centeredDescription: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  redirectHint: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.danger,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  centeredBtnWrap: {
    width: '100%',
    maxWidth: 320,
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.m,
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.danger,
    paddingVertical: tokens.spacing.s + 2,
    paddingHorizontal: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    marginBottom: tokens.spacing.m,
  },
  overdueBannerText: {
    flex: 1,
    color: tokens.colors.textInverse,
    fontWeight: tokens.typography.fontWeights.bold,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
  rejectionCard: {
    backgroundColor: '#fff5f5',
    borderColor: tokens.colors.danger,
    marginBottom: tokens.spacing.m,
  },
  rowIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  rejectionTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.danger,
  },
  rejectionText: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    marginBottom: tokens.spacing.m,
  },
  feedbackSuccess: {
    backgroundColor: '#e6f4ea',
    borderColor: '#b7ebc6',
  },
  feedbackInfo: {
    backgroundColor: '#e7f1ff',
    borderColor: '#b6d4fe',
  },
  feedbackText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: tokens.spacing.m,
  },
  clientOverline: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  clientName: {
    fontSize: tokens.typography.fontSizes.large,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginTop: 2,
  },
  inspectionTitle: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacing.s,
    marginTop: tokens.spacing.m,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  detailField: {
    marginBottom: tokens.spacing.s,
  },
  fieldLabel: {
    fontSize: tokens.typography.fontSizes.small,
    color: tokens.colors.textMuted,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
  },
  fieldValueMuted: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  qrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s + 4,
    backgroundColor: '#f0f6ff',
    borderWidth: 1,
    borderColor: '#cfe2ff',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 4,
    marginTop: tokens.spacing.xs,
  },
  qrTextContainer: {
    flex: 1,
  },
  qrLabel: {
    fontSize: tokens.typography.fontSizes.small - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
  },
  qrValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs + 1,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    gap: tokens.spacing.s,
  },
  timelineLabel: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
  },
  timelineValue: {
    fontSize: tokens.typography.fontSizes.small + 1,
    fontWeight: tokens.typography.fontWeights.medium,
    color: tokens.colors.text,
    textAlign: 'right',
    flex: 1,
  },
  instructionsBox: {
    marginTop: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  instructionsText: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  progressPercent: {
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.primary,
    marginBottom: tokens.spacing.s,
  },
  progressTrack: {
    height: 8,
    borderRadius: tokens.borderRadius.round,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    marginBottom: tokens.spacing.m,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.round,
  },
  progressStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.m,
  },
  statChip: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    fontSize: tokens.typography.fontSizes.regular - 1,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
  },
  statLabel: {
    fontSize: tokens.typography.fontSizes.small - 2,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  noItemsText: {
    fontSize: tokens.typography.fontSizes.small + 1,
    color: tokens.colors.textMuted,
    fontStyle: 'italic',
  },
  checklistSectionBlock: {
    marginTop: tokens.spacing.s,
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    gap: tokens.spacing.xs,
  },
  checklistSectionTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    fontWeight: tokens.typography.fontWeights.bold,
    color: tokens.colors.text,
    marginBottom: 2,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.xs + 2,
    paddingVertical: 4,
  },
  checklistItemTextWrap: {
    flex: 1,
  },
  checklistItemTitle: {
    fontSize: tokens.typography.fontSizes.small + 2,
    color: tokens.colors.text,
  },
  checklistItemMeta: {
    fontSize: tokens.typography.fontSizes.small - 1,
    color: tokens.colors.textMuted,
  },
  checklistItemBlock: {
    gap: tokens.spacing.xs,
  },
  interactiveInputWrap: {
    paddingLeft: tokens.spacing.m,
    paddingBottom: tokens.spacing.s,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 6,
    paddingHorizontal: tokens.spacing.s,
    marginTop: tokens.spacing.s,
  },
  verifiedPillSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  verifiedPillWarning: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  verifiedPillText: {
    flex: 1,
    fontSize: tokens.typography.fontSizes.small,
    fontWeight: tokens.typography.fontWeights.medium,
  },
  verifiedPillTextSuccess: {
    color: '#166534',
  },
  verifiedPillTextWarning: {
    color: '#92400E',
  },
  scanQrButton: {
    marginTop: tokens.spacing.s,
  },
  footerBar: {
    padding: tokens.spacing.m,
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  snackbar: {
    position: 'absolute',
    left: tokens.spacing.m,
    right: tokens.spacing.m,
    bottom: 92,
    backgroundColor: '#212529',
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: tokens.spacing.s + 4,
    paddingHorizontal: tokens.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  snackbarText: {
    flex: 1,
    color: tokens.colors.textInverse,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
  snackbarAction: {
    color: '#90caf9',
    fontWeight: tokens.typography.fontWeights.bold,
    fontSize: tokens.typography.fontSizes.small + 1,
  },
});
