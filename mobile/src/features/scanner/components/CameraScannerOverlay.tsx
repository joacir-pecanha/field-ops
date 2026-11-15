import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '@/design-system/tokens';
import type { EquipmentSummary } from '../services/qrValidator';

export type ScannerOverlayStatus =
  | 'idle'
  | 'processing'
  | 'matched'
  | 'divergence'
  | 'unrecognized'
  | 'out_of_scope';

export interface CameraScannerOverlayProps {
  expectedEquipment?: EquipmentSummary | null;
  overlayStatus?: ScannerOverlayStatus;
  statusMessage?: string | null;
  torchEnabled: boolean;
  onToggleTorch: () => void;
  onOpenManualEntry: () => void;
  onBack?: () => void;
  onRetryScan?: () => void;
  testID?: string;
}

/**
 * Aciona resposta tátil segura (RF-05) sem falhar em ambientes Web ou testes unitários.
 */
export function triggerScanFeedback(kind: 'match' | 'error'): void {
  try {
    if (Platform.OS === 'web') {
      return;
    }
    if (typeof Vibration?.vibrate === 'function') {
      Vibration.vibrate(kind === 'match' ? 90 : [0, 80, 60, 120]);
    }
  } catch {
    // Silencioso caso dispositivo não possua motor háptico
  }
}

function getReticleColor(status: ScannerOverlayStatus): string {
  switch (status) {
    case 'matched':
      return tokens.colors.success;
    case 'divergence':
    case 'out_of_scope':
      return tokens.colors.danger;
    case 'unrecognized':
      return tokens.colors.warning;
    case 'processing':
      return tokens.colors.info;
    case 'idle':
    default:
      return '#FFFFFF';
  }
}

function getHelperInstruction(status: ScannerOverlayStatus): string {
  switch (status) {
    case 'processing':
      return 'Validando equipamento no catálogo offline...';
    case 'matched':
      return 'Equipamento confirmado! Abrindo checklist...';
    case 'divergence':
      return 'Divergência detectada. Confirme ou cancele no alerta.';
    case 'unrecognized':
      return 'Código QR não identificado. Tente aproximar ou digite manualmente.';
    case 'out_of_scope':
      return 'Equipamento fora do escopo atribuído ao seu usuário.';
    case 'idle':
    default:
      return 'Posicione o QR Code da etiqueta dentro da mira central';
  }
}

export function CameraScannerOverlay({
  expectedEquipment,
  overlayStatus = 'idle',
  statusMessage,
  torchEnabled,
  onToggleTorch,
  onOpenManualEntry,
  onBack,
  onRetryScan,
  testID = 'camera-scanner-overlay',
}: CameraScannerOverlayProps) {
  const reticleColor = getReticleColor(overlayStatus);
  const instructionText = getHelperInstruction(overlayStatus);

  return (
    <View testID={testID} style={styles.root} pointerEvents="box-none">
      {/* Faixa superior escura com cabeçalho e lanterna (RT-02) */}
      <View style={styles.topMask}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            testID="scanner-back-btn"
            style={styles.iconButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar da tela do scanner"
          >
            <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Scanner de QR Code</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {expectedEquipment
                ? `Esperado: ${expectedEquipment.name}`
                : 'Leitura offline (SQLite local)'}
            </Text>
          </View>

          <TouchableOpacity
            testID="scanner-torch-toggle"
            style={[
              styles.iconButton,
              torchEnabled && styles.iconButtonActive,
            ]}
            onPress={onToggleTorch}
            accessibilityRole="button"
            accessibilityLabel={
              torchEnabled ? 'Desligar lanterna' : 'Ligar lanterna'
            }
          >
            <MaterialIcons
              name={torchEnabled ? 'flash-on' : 'flash-off'}
              size={22}
              color={torchEnabled ? tokens.colors.text : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {expectedEquipment ? (
          <View style={styles.expectedPill} testID="scanner-expected-pill">
            <MaterialIcons name="qr-code-2" size={16} color={tokens.colors.info} />
            <Text style={styles.expectedPillText} numberOfLines={1}>
              {expectedEquipment.code} • QR: {expectedEquipment.qrCode}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Linha central com máscara lateral e mira */}
      <View style={styles.middleRow} pointerEvents="box-none">
        <View style={styles.sideMask} />
        <View testID="scanner-reticle" style={styles.reticleBox}>
          <View style={[styles.corner, styles.cornerTopLeft, { borderColor: reticleColor }]} />
          <View style={[styles.corner, styles.cornerTopRight, { borderColor: reticleColor }]} />
          <View style={[styles.corner, styles.cornerBottomLeft, { borderColor: reticleColor }]} />
          <View style={[styles.corner, styles.cornerBottomRight, { borderColor: reticleColor }]} />

          <View style={styles.scanLineContainer}>
            <View style={[styles.scanLine, { backgroundColor: reticleColor }]} />
          </View>
        </View>
        <View style={styles.sideMask} />
      </View>

      {/* Faixa inferior com feedback e fallback manual (EX-01, EX-02, RF-05, RF-07) */}
      <View style={styles.bottomMask}>
        <Text testID="scanner-instruction-text" style={styles.instructionText}>
          {instructionText}
        </Text>

        {overlayStatus === 'matched' ? (
          <View testID="scanner-match-banner" style={styles.matchBanner}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.bannerText}>
              {statusMessage || 'Equipamento identificado e validado!'}
            </Text>
          </View>
        ) : null}

        {overlayStatus === 'unrecognized' ? (
          <View testID="scanner-unrecognized-banner" style={styles.unrecognizedBanner}>
            <View style={styles.bannerHeaderRow}>
              <MaterialIcons name="help-outline" size={20} color="#FFFFFF" />
              <Text style={styles.bannerText}>
                {statusMessage || 'Código QR não identificado no FieldOps'}
              </Text>
            </View>
            {onRetryScan ? (
              <TouchableOpacity
                testID="scanner-retry-btn"
                style={styles.retryPill}
                onPress={onRetryScan}
                accessibilityRole="button"
              >
                <Text style={styles.retryPillText}>Ler outro QR Code</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {overlayStatus === 'out_of_scope' ? (
          <View testID="scanner-scope-banner" style={styles.scopeBanner}>
            <View style={styles.bannerHeaderRow}>
              <MaterialIcons name="block" size={20} color="#FFFFFF" />
              <Text style={styles.bannerText}>
                {statusMessage ||
                  'Acesso negado: equipamento fora do escopo atribuído ao técnico.'}
              </Text>
            </View>
            {onRetryScan ? (
              <TouchableOpacity
                testID="scanner-retry-btn"
                style={styles.retryPill}
                onPress={onRetryScan}
                accessibilityRole="button"
              >
                <Text style={styles.retryPillText}>Tentar outro equipamento</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.bottomActions}>
          <TouchableOpacity
            testID="scanner-manual-entry-btn"
            style={styles.manualButton}
            onPress={onOpenManualEntry}
            accessibilityRole="button"
            accessibilityLabel="QR Code danificado ou ilegível, digitar código manualmente"
          >
            <MaterialIcons name="keyboard" size={18} color="#FFFFFF" />
            <Text style={styles.manualButtonText}>
              QR Code danificado ou ilegível? Digitar código
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const RETICLE_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const MASK_COLOR = 'rgba(15, 23, 42, 0.70)';

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topMask: {
    backgroundColor: MASK_COLOR,
    paddingTop: tokens.spacing.m,
    paddingBottom: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.s,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  iconButtonActive: {
    backgroundColor: tokens.colors.warning,
    borderColor: tokens.colors.warning,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: tokens.typography.fontSizes.regular,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
  },
  expectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  expectedPillText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
  },
  middleRow: {
    flexDirection: 'row',
    height: RETICLE_SIZE,
    alignItems: 'stretch',
  },
  sideMask: {
    flex: 1,
    backgroundColor: MASK_COLOR,
  },
  reticleBox: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 8,
  },
  scanLineContainer: {
    width: RETICLE_SIZE - 28,
    alignItems: 'center',
  },
  scanLine: {
    width: '100%',
    height: 2,
    opacity: 0.75,
  },
  bottomMask: {
    flex: 1,
    backgroundColor: MASK_COLOR,
    paddingHorizontal: tokens.spacing.m,
    paddingTop: tokens.spacing.m,
    paddingBottom: tokens.spacing.l,
    justifyContent: 'flex-start',
    gap: tokens.spacing.s,
  },
  instructionText: {
    color: '#F8FAFC',
    fontSize: tokens.typography.fontSizes.small,
    textAlign: 'center',
    fontWeight: '500',
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
    backgroundColor: tokens.colors.success,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
  },
  unrecognizedBanner: {
    backgroundColor: '#B45309',
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
    gap: tokens.spacing.xs,
  },
  scopeBanner: {
    backgroundColor: tokens.colors.danger,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
    gap: tokens.spacing.xs,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s,
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  retryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  retryPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomActions: {
    marginTop: 'auto',
    paddingTop: tokens.spacing.s,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.s,
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: tokens.borderRadius.medium,
    paddingVertical: 12,
    paddingHorizontal: tokens.spacing.m,
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
