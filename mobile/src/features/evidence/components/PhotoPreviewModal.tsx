import React from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import { resolveRenderableEvidenceUri } from '../services/photoStorageService';

export interface PhotoPreviewModalProps {
  visible: boolean;
  photoUri: string | null;
  width?: number;
  height?: number;
  itemTitle?: string | null;
  nonConformityLabel?: string | null;
  isNonConformity?: boolean;
  isSaving?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onRetake: () => void;
}

/**
 * Modal de pré-visualização imediata após captura da câmera (Passo 3 / RF-02 / RF-03 / EX-01).
 * Permite confirmar o salvamento (compressão + UUID + pasta permanente) ou descartar/refazer.
 */
export function PhotoPreviewModal({
  visible,
  photoUri,
  width,
  height,
  itemTitle,
  nonConformityLabel,
  isNonConformity = false,
  isSaving = false,
  errorMessage,
  onConfirm,
  onRetake,
}: PhotoPreviewModalProps) {
  if (!visible || !photoUri) {
    return null;
  }

  const displayUri = resolveRenderableEvidenceUri(photoUri);

  const content = (
    <View style={styles.backdrop}>
      <View testID="photo-preview-modal" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="photo-camera" size={22} color={tokens.colors.primary} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Pré-visualização da Evidência</Text>
            <Text style={styles.subtitle}>
              Confirme a nitidez e o enquadramento antes de salvar offline.
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
        >
          {(itemTitle || nonConformityLabel || isNonConformity) && (
            <View
              testID="photo-preview-association-badge"
              style={[
                styles.associationBox,
                isNonConformity && styles.associationBoxNc,
              ]}
            >
              <MaterialIcons
                name={isNonConformity ? 'report-problem' : 'fact-check'}
                size={18}
                color={isNonConformity ? tokens.colors.danger : tokens.colors.primary}
              />
              <View style={styles.associationTextWrap}>
                <Text
                  style={[
                    styles.associationOverline,
                    isNonConformity && { color: tokens.colors.danger },
                  ]}
                >
                  {isNonConformity
                    ? 'EVIDÊNCIA DE NÃO CONFORMIDADE'
                    : 'ITEM DO CHECKLIST VINCULADO'}
                </Text>
                <Text style={styles.associationTitle}>
                  {nonConformityLabel || itemTitle || 'Evidência da Inspeção'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.imageFrame}>
            <Image
              testID="photo-preview-image"
              source={{ uri: displayUri }}
              style={styles.previewImage}
              resizeMode="contain"
              accessibilityLabel="Pré-visualização da foto capturada"
            />
          </View>

          <View style={styles.processingBanner}>
            <MaterialIcons name="compress" size={16} color="#1E40AF" />
            <Text style={styles.processingText}>
              Otimização: máx. 1920x1080 px • JPEG 80% • Miniatura leve • Metadados EXIF sanitizados
              {width && height ? ` (Origem: ${width}×${height} px)` : ''}
            </Text>
          </View>

          {!!errorMessage && (
            <View
              testID="photo-preview-storage-error"
              style={styles.errorBox}
              accessibilityRole="alert"
            >
              <MaterialIcons name="sd-storage" size={20} color={tokens.colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            testID="photo-preview-confirm-btn"
            title={isSaving ? 'Processando e Salvando...' : 'Confirmar e Salvar Foto'}
            variant="primary"
            isLoading={isSaving}
            disabled={isSaving}
            onPress={onConfirm}
          />
          <Button
            testID="photo-preview-retake-btn"
            title="Refazer / Descartar"
            variant="secondary"
            disabled={isSaving}
            onPress={onRetake}
          />
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'web' && typeof document === 'undefined') {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSaving ? undefined : onRetake}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.m,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    backgroundColor: '#F8FAFC',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  bodyScroll: {
    maxHeight: 440,
  },
  bodyContent: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  associationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    padding: tokens.spacing.s + 2,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  associationBoxNc: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  associationTextWrap: {
    flex: 1,
  },
  associationOverline: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primary,
    letterSpacing: 0.6,
  },
  associationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 2,
  },
  imageFrame: {
    width: '100%',
    height: 240,
    borderRadius: tokens.borderRadius.medium,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: '#EFF6FF',
    padding: tokens.spacing.s,
    borderRadius: tokens.borderRadius.small,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  processingText: {
    flex: 1,
    fontSize: 11,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.s,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s + 2,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 18,
  },
  footer: {
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: '#F8FAFC',
  },
});
