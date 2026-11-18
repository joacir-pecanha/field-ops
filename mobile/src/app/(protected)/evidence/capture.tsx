import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  useCameraPermission,
  type CameraPermissionState,
} from '@/features/scanner/hooks/useCameraPermission';
import {
  PhotoPreviewModal,
  captureAndSaveEvidence,
  type FileSystemAdapter,
  type PhotoCaptureDependencies,
} from '@/features/evidence';

export interface CapturedDraftPhoto {
  uri: string;
  width?: number;
  height?: number;
  exif?: Record<string, unknown> | null;
  simulatedStorageFull?: boolean;
}

export interface CaptureEvidenceScreenProps {
  inspectionId?: string;
  itemId?: string;
  itemTitle?: string;
  nonConformityId?: string;
  isNonConformity?: boolean;
  initialPermissionState?: Partial<CameraPermissionState>;
  initialPreviewPhoto?: CapturedDraftPhoto | null;
  initialCameraMountError?: string | null;
  autoCheckPermission?: boolean;
  captureDependencies?: PhotoCaptureDependencies;
}

const EVIDENCE_CONSENT_MESSAGE =
  'O FieldOps precisa acessar a câmera do dispositivo para capturar fotografias técnicas de evidência e vincular ao item do checklist ou não conformidade.';

function createSimulatedTechnicalPhoto(kind: 'conformity' | 'anomaly'): CapturedDraftPhoto {
  const width = 2560;
  const height = 1440;
  const isAnomaly = kind === 'anomaly';
  const title = isAnomaly
    ? 'NAO CONFORMIDADE - VAZAMENTO / AVARIA'
    : 'EVIDENCIA DE CONFORMIDADE TECNICA';
  const subtitle = isAnomaly
    ? 'Registro simulado 2560x1440 para redimensionamento 1920x1080'
    : 'Equipamento verificado em campo - 2560x1440 -> 1920x1080';

  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = isAnomaly ? '#450A0A' : '#0F172A';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = isAnomaly ? '#EF4444' : '#22C55E';
        ctx.lineWidth = 18;
        ctx.strokeRect(48, 48, width - 96, height - 96);

        ctx.fillStyle = isAnomaly ? '#DC2626' : '#0284C7';
        ctx.fillRect(140, 220, width - 280, 260);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 74px sans-serif';
        ctx.fillText(title, 200, 345);
        ctx.font = '44px sans-serif';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(subtitle, 200, 425);

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(140, 560, width - 280, 580);

        ctx.fillStyle = isAnomaly ? '#FCA5A5' : '#86EFAC';
        ctx.font = 'bold 54px monospace';
        ctx.fillText(`FIELDOPS CAMERA CAPTURE • ${new Date().toISOString()}`, 200, 720);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '40px monospace';
        ctx.fillText('ORIGEM: 2560x1440 -> SAIDA: max 1920x1080 JPEG 0.8', 200, 820);
        ctx.fillText('METADADOS EXIF/GPS SENSIVEIS SERAO SANITIZADOS', 200, 900);

        return {
          uri: canvas.toDataURL('image/png'),
          width,
          height,
          exif: {
            Make: 'FieldOps-Camera-Sim',
            Model: 'FieldCam-Pro',
            GPSLatitude: -23.50153,
            GPSLongitude: -47.45256,
            SerialNumber: 'SENSITIVE-SERIAL-001',
          },
        };
      }
    } catch {
      // Fallback para SVG data URL caso canvas esteja indisponível
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="${isAnomaly ? '#450A0A' : '#0F172A'}"/>
    <rect x="40" y="40" width="1200" height="640" fill="none" stroke="${isAnomaly ? '#EF4444' : '#22C55E'}" stroke-width="8"/>
    <text x="80" y="180" fill="#FFFFFF" font-size="38" font-family="sans-serif" font-weight="bold">${title}</text>
    <text x="80" y="250" fill="#CBD5E1" font-size="24" font-family="monospace">${subtitle}</text>
  </svg>`;

  return {
    uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width,
    height,
    exif: {
      Make: 'FieldOps-Sim',
      GPSLatitude: -23.50153,
      GPSLongitude: -47.45256,
    },
  };
}

export default function CaptureEvidenceScreen(props: CaptureEvidenceScreenProps) {
  const {
    inspectionId: propInspectionId,
    itemId: propItemId,
    itemTitle: propItemTitle,
    nonConformityId: propNonConformityId,
    isNonConformity: propIsNonConformity,
    initialPermissionState,
    initialPreviewPhoto = null,
    initialCameraMountError = null,
    autoCheckPermission = true,
    captureDependencies,
  } = props ?? {};

  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    inspectionId?: string;
    itemId?: string;
    itemTitle?: string;
    nonConformityId?: string;
    isNonConformity?: string;
  }>();

  const resolvedInspectionId = useMemo(() => {
    const raw = propInspectionId ?? params.inspectionId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || undefined;
  }, [propInspectionId, params.inspectionId]);

  const resolvedItemId = useMemo(() => {
    const raw = propItemId ?? params.itemId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || undefined;
  }, [propItemId, params.itemId]);

  const resolvedItemTitle = useMemo(() => {
    const raw = propItemTitle ?? params.itemTitle;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || undefined;
  }, [propItemTitle, params.itemTitle]);

  const resolvedNonConformityId = useMemo(() => {
    const raw = propNonConformityId ?? params.nonConformityId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || undefined;
  }, [propNonConformityId, params.nonConformityId]);

  const resolvedIsNonConformity = useMemo(() => {
    if (typeof propIsNonConformity === 'boolean') {
      return propIsNonConformity;
    }
    const raw = Array.isArray(params.isNonConformity)
      ? params.isNonConformity[0]
      : params.isNonConformity;
    return raw === 'true' || Boolean(resolvedNonConformityId);
  }, [propIsNonConformity, params.isNonConformity, resolvedNonConformityId]);

  const permission = useCameraPermission({
    autoCheck: autoCheckPermission && !initialPermissionState,
    initialState: initialPermissionState,
    initialConsent: initialPermissionState?.hasExplicitConsent ?? false,
  });

  const cameraRef = useRef<CameraView | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState<string | null>(
    initialCameraMountError
  );
  const [pendingPhoto, setPendingPhoto] = useState<CapturedDraftPhoto | null>(
    initialPreviewPhoto
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [captureBannerError, setCaptureBannerError] = useState<string | null>(null);
  const [simulatorExpanded, setSimulatorExpanded] = useState(Platform.OS === 'web');

  const navigateBack = useCallback(
    (saved = false) => {
      if (resolvedInspectionId) {
        router.replace({
          pathname: '/(protected)/inspections/[inspectionId]',
          params: {
            inspectionId: resolvedInspectionId,
            openChecklist: 'true',
            ...(resolvedItemId ? { focusItemId: resolvedItemId } : {}),
            ...(saved ? { evidenceSaved: 'true' } : {}),
          },
        });
        return;
      }
      if (typeof router.back === 'function') {
        router.back();
      }
    },
    [router, resolvedInspectionId, resolvedItemId]
  );

  const handleTakePhoto = useCallback(async () => {
    if (isCapturing || isSaving) return;
    setCaptureBannerError(null);

    if (!cameraRef.current || typeof cameraRef.current.takePictureAsync !== 'function') {
      setCaptureBannerError(
        'Hardware de câmera indisponível neste ambiente. Utilize o simulador abaixo para testar o fluxo completo.'
      );
      return;
    }

    setIsCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: Platform.OS === 'web',
        exif: true,
      });

      if (!picture?.uri) {
        setCaptureBannerError('Nenhuma imagem foi retornada pela câmera. Tente novamente.');
        return;
      }

      setPreviewError(null);
      setPendingPhoto({
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
        exif: (picture.exif as Record<string, unknown> | undefined) ?? null,
      });
    } catch (err: any) {
      setCaptureBannerError(
        err?.message ||
          'Não foi possível capturar a foto pela câmera. Verifique permissões ou utilize o simulador abaixo.'
      );
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, isSaving]);

  const handleConfirmSavePhoto = useCallback(async () => {
    if (!pendingPhoto || isSaving) return;
    if (!resolvedInspectionId) {
      setPreviewError('Inspeção de destino não identificada.');
      return;
    }

    setIsSaving(true);
    setPreviewError(null);

    try {
      let deps: PhotoCaptureDependencies | undefined = captureDependencies;
      if (pendingPhoto.simulatedStorageFull) {
        const lowDiskFs: FileSystemAdapter = {
          documentDirectory: 'fieldops-web://documents/',
          cacheDirectory: 'fieldops-web://cache/',
          getInfoAsync: async () => ({ exists: true, isDirectory: true }),
          makeDirectoryAsync: async () => {},
          copyAsync: async () => {},
          deleteAsync: async () => {},
          getFreeDiskStorageAsync: async () => 1024, // 1 KB livre -> dispara EX-01
        };
        deps = {
          ...(captureDependencies ?? {}),
          fileSystem: lowDiskFs,
        };
      }

      const result = await captureAndSaveEvidence(
        {
          inspectionId: resolvedInspectionId,
          itemId: resolvedItemId ?? null,
          nonConformityId:
            resolvedNonConformityId ??
            (resolvedIsNonConformity && resolvedItemId
              ? `nc_${resolvedInspectionId}_${resolvedItemId}`
              : null),
          sourceUri: pendingPhoto.uri,
          originalWidth: pendingPhoto.width,
          originalHeight: pendingPhoto.height,
          rawMetadata: pendingPhoto.exif ?? null,
          technicianId: user?.id ?? null,
          userRole: user?.role ?? null,
          onStorageAlert: (title, message) => {
            if (typeof Alert?.alert === 'function') {
              Alert.alert(title, message);
            }
          },
        },
        deps
      );

      if (!result.success) {
        setPreviewError(result.alertMessage || result.message);
        if (result.code === 'INSUFFICIENT_STORAGE' && typeof Alert?.alert === 'function') {
          Alert.alert(
            result.alertTitle || 'Armazenamento Insuficiente',
            result.alertMessage || result.message
          );
        }
        return;
      }

      setPendingPhoto(null);
      navigateBack(true);
    } catch (err: any) {
      setPreviewError(
        err?.message || 'Erro inesperado ao salvar a fotografia localmente.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    pendingPhoto,
    isSaving,
    resolvedInspectionId,
    resolvedItemId,
    resolvedNonConformityId,
    resolvedIsNonConformity,
    captureDependencies,
    user?.id,
    user?.role,
    navigateBack,
  ]);

  const handleRetakePhoto = useCallback(() => {
    setPendingPhoto(null);
    setPreviewError(null);
  }, []);

  const showConsentGate = !permission.hasExplicitConsent;
  const showDeniedFallback =
    permission.hasExplicitConsent &&
    (permission.status === 'denied' ||
      permission.status === 'blocked' ||
      !permission.granted ||
      Boolean(cameraMountError));

  return (
    <SafeAreaView testID="evidence-capture-screen" style={styles.container}>
      {showConsentGate ? (
        <ScrollView contentContainerStyle={styles.gateScrollContent}>
          <View testID="evidence-consent-card" style={styles.gateCard}>
            <View style={styles.gateIconBadge}>
              <MaterialIcons name="photo-camera" size={40} color={tokens.colors.primary} />
            </View>
            <Text style={styles.gateTitle}>Permissão de Câmera para Evidências</Text>
            <Text style={styles.gateDescription}>{EVIDENCE_CONSENT_MESSAGE}</Text>

            {resolvedItemTitle ? (
              <View style={styles.contextBox}>
                <Text style={styles.contextBoxLabel}>
                  {resolvedIsNonConformity ? 'NÃO CONFORMIDADE' : 'ITEM DO CHECKLIST'}
                </Text>
                <Text style={styles.contextBoxTitle}>{resolvedItemTitle}</Text>
              </View>
            ) : null}

            <Button
              testID="evidence-consent-allow-btn"
              title="Autorizar Câmera e Fotografar"
              variant="primary"
              isLoading={permission.isLoading}
              disabled={permission.isLoading}
              onPress={() => void permission.requestExplicitPermission()}
              style={styles.fullWidthBtn}
            />
            <TouchableOpacity
              testID="evidence-consent-back-btn"
              style={styles.textLinkBtn}
              onPress={() => navigateBack(false)}
            >
              <Text style={styles.textLinkLabel}>Voltar ao Checklist</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : showDeniedFallback ? (
        <ScrollView contentContainerStyle={styles.gateScrollContent}>
          <View testID="evidence-permission-denied-card" style={styles.gateCard}>
            <View style={[styles.gateIconBadge, styles.deniedIconBadge]}>
              <MaterialIcons name="no-photography" size={40} color={tokens.colors.danger} />
            </View>
            <Text style={styles.gateTitle}>
              {permission.status === 'blocked'
                ? 'Câmera Bloqueada no Dispositivo'
                : cameraMountError
                  ? 'Câmera Indisponível neste Ambiente'
                  : 'Permissão de Câmera Recusada'}
            </Text>
            <Text style={styles.gateDescription}>
              {cameraMountError
                ? `${cameraMountError} Em ambiente Web sem webcam, utilize o Simulador de Captura abaixo para testar o pipeline de compressão e persistência.`
                : permission.guidanceMessage ||
                  'Autorize o acesso à câmera para capturar fotografias técnicas da inspeção.'}
            </Text>

            {permission.status === 'blocked' ? (
              <Button
                testID="evidence-open-settings-btn"
                title="Abrir Configurações do Dispositivo"
                variant="primary"
                onPress={() => void permission.openSystemSettings()}
                style={styles.fullWidthBtn}
              />
            ) : (
              <Button
                testID="evidence-retry-permission-btn"
                title="Tentar Autorizar Câmera Novamente"
                variant="primary"
                isLoading={permission.isLoading}
                onPress={() => {
                  setCameraMountError(null);
                  void permission.requestExplicitPermission();
                }}
                style={styles.fullWidthBtn}
              />
            )}

            <TouchableOpacity
              testID="evidence-denied-back-btn"
              style={styles.textLinkBtn}
              onPress={() => navigateBack(false)}
            >
              <Text style={styles.textLinkLabel}>Voltar para Inspeção</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.cameraStage}>
          <CameraView
            ref={cameraRef}
            testID="evidence-camera-view"
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            enableTorch={torchEnabled}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(event) => {
              setCameraMountError(
                event?.message ||
                  'Não foi possível inicializar a câmera neste navegador/dispositivo.'
              );
            }}
          />

          <View style={styles.cameraOverlay} pointerEvents="box-none">
            <View style={styles.topBar}>
              <TouchableOpacity
                testID="evidence-back-btn"
                style={styles.roundIconBtn}
                onPress={() => navigateBack(false)}
                accessibilityRole="button"
                accessibilityLabel="Voltar da câmera de evidências"
              >
                <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.topCenter}>
                <Text style={styles.topTitle}>Capturar Evidência</Text>
                <Text style={styles.topSubtitle} numberOfLines={1}>
                  {resolvedItemTitle ||
                    (resolvedIsNonConformity
                      ? 'Registro de Não Conformidade'
                      : 'Evidência da Inspeção')}
                </Text>
              </View>

              <TouchableOpacity
                testID="evidence-torch-toggle"
                style={[
                  styles.roundIconBtn,
                  torchEnabled && styles.roundIconBtnActive,
                ]}
                onPress={() => setTorchEnabled((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={torchEnabled ? 'Desligar lanterna' : 'Ligar lanterna'}
              >
                <MaterialIcons
                  name={torchEnabled ? 'flash-on' : 'flash-off'}
                  size={22}
                  color={torchEnabled ? tokens.colors.text : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.frameGuide} pointerEvents="none">
              <View style={styles.frameBox}>
                <Text style={styles.frameHint}>
                  Enquadre o componente ou anomalia • Máx. 1920×1080 JPEG
                </Text>
              </View>
            </View>

            <View style={styles.bottomBar}>
              {captureBannerError ? (
                <View testID="evidence-capture-error" style={styles.inlineAlert}>
                  <MaterialIcons name="warning" size={16} color="#FEF3C7" />
                  <Text style={styles.inlineAlertText}>{captureBannerError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                testID="evidence-shutter-btn"
                style={[
                  styles.shutterButton,
                  (isCapturing || isSaving) && styles.shutterButtonDisabled,
                ]}
                disabled={isCapturing || isSaving}
                onPress={() => void handleTakePhoto()}
                accessibilityRole="button"
                accessibilityLabel="Capturar foto de evidência"
              >
                <View style={styles.shutterInner}>
                  <MaterialIcons name="photo-camera" size={28} color={tokens.colors.primary} />
                </View>
              </TouchableOpacity>
              <Text style={styles.shutterLabel}>
                {isCapturing
                  ? 'Capturando...'
                  : cameraReady
                    ? 'Toque para Fotografar'
                    : 'Aguardando Câmera / Pronto'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Dock Simulador para validação em Expo Web / dispositivos sem webcam */}
      <View style={styles.simulatorDock}>
        <TouchableOpacity
          testID="evidence-simulator-toggle"
          style={styles.simulatorToggle}
          onPress={() => setSimulatorExpanded((prev) => !prev)}
          accessibilityRole="button"
        >
          <MaterialIcons name="science" size={16} color={tokens.colors.info} />
          <Text style={styles.simulatorToggleText}>
            Simulador de Captura em Campo (Validação) • {Platform.OS.toUpperCase()}
          </Text>
          <MaterialIcons
            name={simulatorExpanded ? 'expand-more' : 'expand-less'}
            size={18}
            color="#E2E8F0"
          />
        </TouchableOpacity>

        {simulatorExpanded ? (
          <View testID="evidence-simulator-panel" style={styles.simulatorPanel}>
            <Text style={styles.simulatorSectionLabel}>
              Gerar imagem 2560×1440 para testar Pré-visualização + Compressão 1920×1080 + UUID:
            </Text>
            <View style={styles.simulatorRow}>
              <TouchableOpacity
                testID="sim-capture-conformity-btn"
                style={styles.simChipPrimary}
                onPress={() => {
                  setPreviewError(null);
                  setPendingPhoto(createSimulatedTechnicalPhoto('conformity'));
                }}
              >
                <Text style={styles.simChipPrimaryText}>Foto Conformidade</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="sim-capture-anomaly-btn"
                style={styles.simChipDanger}
                onPress={() => {
                  setPreviewError(null);
                  setPendingPhoto(createSimulatedTechnicalPhoto('anomaly'));
                }}
              >
                <Text style={styles.simChipDangerText}>Foto Não Conformidade</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="sim-storage-full-btn"
                style={styles.simChipWarn}
                onPress={() => {
                  setPreviewError(null);
                  setPendingPhoto({
                    ...createSimulatedTechnicalPhoto('anomaly'),
                    simulatedStorageFull: true,
                  });
                }}
              >
                <Text style={styles.simChipWarnText}>Simular Disco Cheio (EX-01)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <PhotoPreviewModal
        visible={Boolean(pendingPhoto)}
        photoUri={pendingPhoto?.uri ?? null}
        width={pendingPhoto?.width}
        height={pendingPhoto?.height}
        itemTitle={resolvedItemTitle}
        isNonConformity={resolvedIsNonConformity}
        isSaving={isSaving}
        errorMessage={previewError}
        onConfirm={() => void handleConfirmSavePhoto()}
        onRetake={handleRetakePhoto}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  gateScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.m,
  },
  gateCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.large,
    padding: tokens.spacing.l,
    alignItems: 'center',
    gap: tokens.spacing.s,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  gateIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
  },
  deniedIconBadge: {
    backgroundColor: '#FEE2E2',
  },
  gateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
  },
  gateDescription: {
    fontSize: 14,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: tokens.spacing.xs,
  },
  contextBox: {
    width: '100%',
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
    marginBottom: tokens.spacing.xs,
  },
  contextBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  contextBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 2,
  },
  fullWidthBtn: {
    width: '100%',
  },
  textLinkBtn: {
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.m,
  },
  textLinkLabel: {
    color: tokens.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  cameraStage: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    padding: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  roundIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  roundIconBtnActive: {
    backgroundColor: tokens.colors.warning,
    borderColor: tokens.colors.warning,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  topSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  frameGuide: {
    flex: 1,
    padding: tokens.spacing.l,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameBox: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 4 / 3,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: tokens.borderRadius.medium,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: tokens.spacing.s,
  },
  frameHint: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    textAlign: 'center',
  },
  bottomBar: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingVertical: tokens.spacing.m,
    paddingHorizontal: tokens.spacing.m,
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  inlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: '#92400E',
    borderRadius: tokens.borderRadius.small,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: tokens.spacing.xs,
  },
  inlineAlertText: {
    flex: 1,
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '600',
  },
  shutterButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#93C5FD',
  },
  shutterButtonDisabled: {
    opacity: 0.6,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  simulatorDock: {
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  simulatorToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  simulatorToggleText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  simulatorPanel: {
    paddingHorizontal: tokens.spacing.m,
    paddingBottom: tokens.spacing.m,
    gap: tokens.spacing.s,
  },
  simulatorSectionLabel: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  simulatorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  simChipPrimary: {
    backgroundColor: tokens.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.small,
  },
  simChipPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  simChipDanger: {
    backgroundColor: tokens.colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.small,
  },
  simChipDangerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  simChipWarn: {
    backgroundColor: '#B45309',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.borderRadius.small,
  },
  simChipWarnText: {
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '700',
  },
});
