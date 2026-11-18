import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import type { EvidenceStatus } from '@/infrastructure/database/types';
import type { EvidenceRecord } from '../services/photoCaptureService';
import { resolveRenderableEvidenceUri } from '../services/photoStorageService';

export interface EvidenceGalleryProps {
  evidences: EvidenceRecord[];
  readOnly?: boolean;
  title?: string;
  emptyMessage?: string | null;
  hideWhenEmpty?: boolean;
  onDeleteEvidence?: (evidence: EvidenceRecord) => void;
  deletingId?: string | null;
  initialExpandedId?: string | null;
  testID?: string;
}

function getStatusBadgeMeta(status: EvidenceStatus): {
  label: string;
  bg: string;
  color: string;
} {
  switch (status) {
    case 'UPLOADED':
      return { label: 'Enviada', bg: '#DCFCE7', color: '#166534' };
    case 'UPLOADING':
      return { label: 'Enviando', bg: '#DBEAFE', color: '#1D4ED8' };
    case 'FAILED':
      return { label: 'Erro envio', bg: '#FEE2E2', color: '#991B1B' };
    case 'PENDING':
    default:
      return { label: 'Pendente', bg: '#FEF3C7', color: '#92400E' };
  }
}

function formatFileSizeKb(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return 'Tamanho n/d';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatCapturedDate(iso?: string | null): string {
  if (!iso) return 'Agora';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return `${parsed.toLocaleDateString('pt-BR')} ${parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function canDeleteEvidenceLocally(
  evidence: Pick<EvidenceRecord, 'status'>,
  readOnly: boolean
): boolean {
  if (readOnly) {
    return false;
  }
  return evidence.status !== 'UPLOADED' && evidence.status !== 'UPLOADING';
}

/**
 * Galeria local de miniaturas de evidências com expansão em tela cheia e exclusão segura (Passo 4 / RF-04 / RT-03 / EX-02 / CA-02).
 */
export function EvidenceGallery({
  evidences,
  readOnly = false,
  title = 'Evidências Fotográficas',
  emptyMessage = null,
  hideWhenEmpty = false,
  onDeleteEvidence,
  deletingId = null,
  initialExpandedId = null,
  testID = 'evidence-gallery',
}: EvidenceGalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);

  const expandedEvidence = useMemo(
    () => evidences.find((ev) => ev.id === expandedId) ?? null,
    [evidences, expandedId]
  );

  if (evidences.length === 0) {
    if (hideWhenEmpty || !emptyMessage) {
      return null;
    }
    return (
      <View testID={`${testID}-empty`} style={styles.emptyBox}>
        <MaterialIcons name="photo-library" size={18} color={tokens.colors.textMuted} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const expandedModalContent = expandedEvidence ? (
    <View style={styles.modalBackdrop}>
      <View testID="evidence-expanded-modal" style={styles.modalCard}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderText}>
            <Text style={styles.modalTitle}>Evidência Fotográfica</Text>
            <Text style={styles.modalUuid} numberOfLines={1}>
              UUID: {expandedEvidence.id}
            </Text>
          </View>
          <TouchableOpacity
            testID="evidence-expanded-close-btn"
            style={styles.closeIconBtn}
            onPress={() => setExpandedId(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar visualização da foto"
          >
            <MaterialIcons name="close" size={22} color={tokens.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.expandedImageWrap}>
          <Image
            testID="evidence-expanded-image"
            source={{
              uri: resolveRenderableEvidenceUri(
                expandedEvidence.local_uri || expandedEvidence.thumbnail_uri
              ),
            }}
            style={styles.expandedImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Arquivo:</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {expandedEvidence.file_name || `${expandedEvidence.id}.jpg`}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Status:</Text>
            <Text style={styles.metaValue}>
              {getStatusBadgeMeta(expandedEvidence.status).label}
              {readOnly ? ' (Somente leitura)' : ''}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Resolução / Tamanho:</Text>
            <Text style={styles.metaValue}>
              {expandedEvidence.width && expandedEvidence.height
                ? `${expandedEvidence.width}×${expandedEvidence.height} px`
                : 'Máx. 1920×1080 px'}{' '}
              • {formatFileSizeKb(expandedEvidence.file_size)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Capturada em:</Text>
            <Text style={styles.metaValue}>
              {formatCapturedDate(expandedEvidence.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.modalFooter}>
          {canDeleteEvidenceLocally(expandedEvidence, readOnly) && onDeleteEvidence ? (
            <Button
              testID="evidence-expanded-delete-btn"
              title={
                deletingId === expandedEvidence.id
                  ? 'Excluindo...'
                  : 'Excluir Foto Local'
              }
              variant="danger"
              isLoading={deletingId === expandedEvidence.id}
              disabled={deletingId === expandedEvidence.id}
              onPress={() => {
                onDeleteEvidence(expandedEvidence);
                setExpandedId(null);
              }}
            />
          ) : null}
          <Button
            title="Fechar"
            variant="secondary"
            onPress={() => setExpandedId(null)}
          />
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="photo-library" size={16} color={tokens.colors.primary} />
          <Text style={styles.titleText}>
            {title} ({evidences.length})
          </Text>
        </View>
        {readOnly && (
          <View testID={`${testID}-readonly-badge`} style={styles.readOnlyPill}>
            <MaterialIcons name="lock" size={12} color="#166534" />
            <Text style={styles.readOnlyText}>Somente leitura</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {evidences.map((evidence) => {
          const thumbUri = resolveRenderableEvidenceUri(
            evidence.thumbnail_uri || evidence.local_uri
          );
          const statusMeta = getStatusBadgeMeta(evidence.status);
          const deletable =
            Boolean(onDeleteEvidence) && canDeleteEvidenceLocally(evidence, readOnly);

          return (
            <View
              key={evidence.id}
              testID={`evidence-card-${evidence.id}`}
              style={styles.thumbCard}
            >
              <TouchableOpacity
                testID={`evidence-thumb-${evidence.id}`}
                style={styles.thumbTouchable}
                activeOpacity={0.85}
                onPress={() => setExpandedId(evidence.id)}
                accessibilityRole="button"
                accessibilityLabel={`Expandir evidência ${evidence.file_name || evidence.id}`}
              >
                <Image
                  source={{ uri: thumbUri }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />

                {Boolean(evidence.non_conformity_id) && (
                  <View style={styles.ncTag}>
                    <Text style={styles.ncTagText}>NC</Text>
                  </View>
                )}

                <View style={styles.expandHintOverlay}>
                  <MaterialIcons name="zoom-in" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={styles.thumbFooter}>
                <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                  <Text style={[styles.statusText, { color: statusMeta.color }]}>
                    {statusMeta.label}
                  </Text>
                </View>

                {deletable && (
                  <TouchableOpacity
                    testID={`evidence-delete-btn-${evidence.id}`}
                    style={styles.deleteBtn}
                    disabled={deletingId === evidence.id}
                    onPress={() => onDeleteEvidence?.(evidence)}
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir foto ${evidence.id}`}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={16}
                      color={tokens.colors.danger}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {expandedEvidence &&
        (Platform.OS === 'web' && typeof document === 'undefined' ? (
          expandedModalContent
        ) : (
          <Modal
            visible={Boolean(expandedEvidence)}
            transparent
            animationType="fade"
            onRequestClose={() => setExpandedId(null)}
          >
            {expandedModalContent}
          </Modal>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tokens.spacing.s,
    paddingTop: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: tokens.spacing.xs + 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  readOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  carouselContent: {
    gap: tokens.spacing.s,
    paddingVertical: 2,
  },
  thumbCard: {
    width: 112,
    borderRadius: tokens.borderRadius.medium,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
  },
  thumbTouchable: {
    width: '100%',
    height: 84,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  ncTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: tokens.colors.danger,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ncTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  expandHintOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flex: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    padding: tokens.spacing.s,
    borderRadius: tokens.borderRadius.small,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    marginTop: tokens.spacing.xs,
  },
  emptyText: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '92%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  modalHeaderText: {
    flex: 1,
    paddingRight: tokens.spacing.s,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  modalUuid: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  closeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedImageWrap: {
    width: '100%',
    height: 300,
    backgroundColor: '#0F172A',
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
  metaBox: {
    padding: tokens.spacing.m,
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  metaLabel: {
    fontSize: 12,
    color: tokens.colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.text,
    flex: 1,
    textAlign: 'right',
  },
  modalFooter: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
});
