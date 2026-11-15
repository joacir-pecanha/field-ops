import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/design-system/components/Button';
import { tokens } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  inspectionRepository,
  isInspectionAssignedToTechnician,
} from '@/infrastructure/database/repositories/inspectionRepository';
import {
  CameraScannerOverlay,
  DivergenceModal,
  ManualCodeModal,
  OUT_OF_SCOPE_QR_MESSAGE,
  confirmEquipmentVerification,
  createQrScanDebounceController,
  triggerScanFeedback,
  useCameraPermission,
  validateScannedQrCode,
  type CameraPermissionState,
  type ConfirmVerificationDependencies,
  type EquipmentSummary,
  type ManualCodeSubmitPayload,
  type ManualEntryReason,
  type QrInputSource,
  type QrValidationResult,
  type QrValidatorDependencies,
  type ScannerOverlayStatus,
} from '@/features/scanner';

export interface ScannerScreenProps {
  inspectionId?: string;
  initialPermissionState?: Partial<CameraPermissionState>;
  initialOverlayStatus?: ScannerOverlayStatus;
  initialStatusMessage?: string | null;
  initialExpectedEquipment?: EquipmentSummary | null;
  initialCameraMountError?: string | null;
  autoCheckPermission?: boolean;
  validatorDependencies?: QrValidatorDependencies & ConfirmVerificationDependencies;
}

export default function ScannerScreen(props: ScannerScreenProps) {
  const {
    inspectionId: propInspectionId,
    initialPermissionState,
    initialOverlayStatus = 'idle',
    initialStatusMessage = null,
    initialExpectedEquipment = null,
    initialCameraMountError = null,
    autoCheckPermission = true,
    validatorDependencies,
  } = props ?? {};

  const router = useRouter();
  const params = useLocalSearchParams<{ inspectionId?: string }>();
  const { user } = useAuth();

  const resolvedInspectionId = useMemo(() => {
    const raw = propInspectionId ?? params.inspectionId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }, [propInspectionId, params.inspectionId]);

  const permission = useCameraPermission({
    autoCheck: autoCheckPermission && !initialPermissionState,
    initialState: initialPermissionState,
    initialConsent: initialPermissionState?.hasExplicitConsent ?? false,
  });

  const guardRef = useRef(createQrScanDebounceController());
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expectedEquipment, setExpectedEquipment] = useState<EquipmentSummary | null>(
    initialExpectedEquipment
  );
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [overlayStatus, setOverlayStatus] =
    useState<ScannerOverlayStatus>(initialOverlayStatus);
  const [statusMessage, setStatusMessage] = useState<string | null>(initialStatusMessage);
  const [cameraMountError, setCameraMountError] = useState<string | null>(
    initialCameraMountError
  );

  const [divergenceResult, setDivergenceResult] = useState<QrValidationResult | null>(
    null
  );
  const [divergenceError, setDivergenceError] = useState<string | null>(null);
  const [isSubmittingDivergence, setIsSubmittingDivergence] = useState(false);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualDefaultReason, setManualDefaultReason] =
    useState<ManualEntryReason>('CAMERA_UNAVAILABLE');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const [simulatorExpanded, setSimulatorExpanded] = useState(false);
  const [simulatorCode, setSimulatorCode] = useState('');

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // Carrega resumo do equipamento esperado 100% offline a partir do SQLite (RT-03 / RF-07)
  useEffect(() => {
    let cancelled = false;
    if (!resolvedInspectionId || initialExpectedEquipment) {
      return;
    }

    const loadExpectedEquipment = async () => {
      try {
        const repo = validatorDependencies?.inspectionRepo ?? inspectionRepository;
        const inspection =
          (await repo.findById(resolvedInspectionId)) ??
          (await repo.findByRemoteId(resolvedInspectionId));

        if (cancelled || !inspection) {
          return;
        }

        if (user?.id && !isInspectionAssignedToTechnician(inspection, user.id)) {
          guardRef.current.lock();
          setOverlayStatus('out_of_scope');
          setStatusMessage(OUT_OF_SCOPE_QR_MESSAGE);
          return;
        }

        setExpectedEquipment({
          inspectionId: inspection.id,
          name: inspection.equipment_name || 'Equipamento',
          code: inspection.equipment_code || 'N/D',
          qrCode: inspection.equipment_qr_code || 'Não cadastrado',
          source: 'INSPECTION_SNAPSHOT',
        });
      } catch {
        // Silencioso: validação principal ainda tratará offline caso necessário
      }
    };

    void loadExpectedEquipment();
    return () => {
      cancelled = true;
    };
  }, [
    resolvedInspectionId,
    initialExpectedEquipment,
    user?.id,
    validatorDependencies?.inspectionRepo,
  ]);

  const navigateBackSafely = useCallback(() => {
    if (typeof router.back === 'function' && resolvedInspectionId) {
      router.replace({
        pathname: '/(protected)/inspections/[inspectionId]',
        params: { inspectionId: resolvedInspectionId },
      });
      return;
    }
    if (typeof router.back === 'function') {
      router.back();
    }
  }, [router, resolvedInspectionId]);

  const navigateToChecklist = useCallback(
    (inspectionId: string, extraParams: Record<string, string> = {}) => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        router.replace({
          pathname: '/(protected)/inspections/[inspectionId]',
          params: {
            inspectionId,
            qrVerified: 'true',
            openChecklist: 'true',
            ...extraParams,
          },
        });
      }, 350);
    },
    [router]
  );

  const openManualModal = useCallback((reason: ManualEntryReason) => {
    guardRef.current.lock();
    setManualDefaultReason(reason);
    setManualError(null);
    setManualModalVisible(true);
  }, []);

  const handleRetryScan = useCallback(() => {
    setOverlayStatus('idle');
    setStatusMessage(null);
    guardRef.current.unlock();
  }, []);

  const executeValidation = useCallback(
    async (
      rawCode: string,
      source: QrInputSource,
      manualReason?: ManualEntryReason
    ): Promise<void> => {
      setOverlayStatus('processing');
      setStatusMessage(null);

      try {
        const result = await validateScannedQrCode(
          {
            scannedCode: rawCode,
            inspectionId: resolvedInspectionId,
            technicianId: user?.id ?? null,
            source,
          },
          validatorDependencies
        );

        if (result.outcome === 'MATCH' && result.matchedInspection) {
          triggerScanFeedback('match');
          setOverlayStatus('matched');
          setStatusMessage(result.message);
          setManualModalVisible(false);

          const verificationMode =
            source === 'MANUAL' && manualReason === 'DAMAGED_QR'
              ? 'MANUAL_DAMAGED_OVERRIDE'
              : 'MATCH';

          await confirmEquipmentVerification(
            {
              inspectionId: result.matchedInspection.id,
              scannedCode: result.normalizedCode,
              source,
              mode: verificationMode,
              justification:
                verificationMode === 'MANUAL_DAMAGED_OVERRIDE'
                  ? 'Etiqueta QR danificada ou ilegível; código confirmado manualmente em campo.'
                  : undefined,
              technicianId: user?.id ?? null,
            },
            validatorDependencies
          );

          navigateToChecklist(result.matchedInspection.id, {
            scannedCode: result.normalizedCode,
            verificationSource: source,
          });
          return;
        }

        if (result.outcome === 'DIVERGENCE') {
          triggerScanFeedback('error');
          setManualModalVisible(false);
          setOverlayStatus('divergence');
          setStatusMessage(result.message);
          setDivergenceError(null);
          setDivergenceResult(result);
          return;
        }

        if (result.outcome === 'OUT_OF_SCOPE') {
          triggerScanFeedback('error');
          setOverlayStatus('out_of_scope');
          setStatusMessage(result.message);
          if (source === 'MANUAL') {
            setManualError(result.message);
          }
          return;
        }

        // UNRECOGNIZED ou INVALID_INPUT (EX-02)
        triggerScanFeedback('error');
        setOverlayStatus('unrecognized');
        setStatusMessage(result.message);
        if (source === 'MANUAL') {
          setManualError(result.message);
        } else {
          // Desbloqueia após falha de leitura desconhecida preservando debounce para o mesmo código
          guardRef.current.unlock();
        }
      } catch (err) {
        triggerScanFeedback('error');
        const message =
          err instanceof Error
            ? err.message
            : 'Falha ao validar QR Code no banco offline.';
        setOverlayStatus('unrecognized');
        setStatusMessage(message);
        if (source === 'MANUAL') {
          setManualError(message);
        } else {
          guardRef.current.unlock();
        }
      }
    },
    [resolvedInspectionId, user?.id, validatorDependencies, navigateToChecklist]
  );

  const handleBarcodeScanned = useCallback(
    (scanEvent: BarcodeScanningResult) => {
      const code = scanEvent?.data ?? '';
      if (!guardRef.current.tryAcquire(code)) {
        return;
      }
      void executeValidation(code, 'CAMERA');
    },
    [executeValidation]
  );

  const handleManualSubmit = useCallback(
    async (payload: ManualCodeSubmitPayload) => {
      setIsSubmittingManual(true);
      setManualError(null);
      try {
        await executeValidation(payload.code, 'MANUAL', payload.reason);
      } finally {
        setIsSubmittingManual(false);
      }
    },
    [executeValidation]
  );

  const handleCancelDivergence = useCallback(() => {
    setDivergenceResult(null);
    setDivergenceError(null);
    setOverlayStatus('idle');
    setStatusMessage(null);
    guardRef.current.unlock();
  }, []);

  const handleConfirmDivergence = useCallback(
    async (justification: string) => {
      const targetId =
        divergenceResult?.matchedInspection?.id ?? resolvedInspectionId;
      if (!targetId || !divergenceResult) {
        setDivergenceError('Nenhuma inspeção de destino vinculada para confirmação.');
        return;
      }

      setIsSubmittingDivergence(true);
      setDivergenceError(null);
      try {
        await confirmEquipmentVerification(
          {
            inspectionId: targetId,
            scannedCode: divergenceResult.normalizedCode,
            source: divergenceResult.source,
            mode: 'DIVERGENCE_OVERRIDE',
            justification,
            technicianId: user?.id ?? null,
          },
          validatorDependencies
        );
        setDivergenceResult(null);
        setOverlayStatus('matched');
        setStatusMessage(
          'Divergência justificada e registrada offline. Avançando para o checklist...'
        );
        navigateToChecklist(targetId, {
          scannedCode: divergenceResult.normalizedCode,
          divergenceJustified: 'true',
        });
      } catch (err) {
        setDivergenceError(
          err instanceof Error
            ? err.message
            : 'Não foi possível registrar a justificativa.'
        );
      } finally {
        setIsSubmittingDivergence(false);
      }
    },
    [
      divergenceResult,
      resolvedInspectionId,
      user?.id,
      validatorDependencies,
      navigateToChecklist,
    ]
  );

  const showConsentGate = !permission.hasExplicitConsent;
  const showDeniedFallback =
    permission.hasExplicitConsent &&
    (permission.status === 'denied' ||
      permission.status === 'blocked' ||
      !permission.granted ||
      Boolean(cameraMountError));

  return (
    <SafeAreaView testID="scanner-screen" style={styles.container}>
      {/* Estado 1: Consentimento Explícito (RF-01 / RN-058) */}
      {showConsentGate ? (
        <ScrollView contentContainerStyle={styles.gateScrollContent}>
          <View testID="scanner-consent-card" style={styles.gateCard}>
            <View style={styles.gateIconBadge}>
              <MaterialIcons name="qr-code-scanner" size={40} color={tokens.colors.primary} />
            </View>
            <Text style={styles.gateTitle}>Permissão para Uso da Câmera</Text>
            <Text style={styles.gateDescription}>{permission.guidanceMessage}</Text>

            {expectedEquipment ? (
              <View style={styles.expectedBox}>
                <Text style={styles.expectedBoxLabel}>EQUIPAMENTO DA INSPEÇÃO</Text>
                <Text style={styles.expectedBoxTitle}>{expectedEquipment.name}</Text>
                <Text style={styles.expectedBoxMeta}>
                  Código: {expectedEquipment.code} • QR: {expectedEquipment.qrCode}
                </Text>
              </View>
            ) : null}

            <Button
              testID="scanner-consent-allow-btn"
              title="Autorizar e Abrir Câmera"
              variant="primary"
              isLoading={permission.isLoading}
              disabled={permission.isLoading}
              onPress={() => void permission.requestExplicitPermission()}
              style={styles.gatePrimaryBtn}
            />
            <Button
              testID="scanner-consent-manual-btn"
              title="Prefiro Digitar o Código Manualmente"
              variant="secondary"
              onPress={() => openManualModal('CAMERA_UNAVAILABLE')}
              style={styles.gateSecondaryBtn}
            />
            <TouchableOpacity
              testID="scanner-consent-back-btn"
              style={styles.textLinkButton}
              onPress={navigateBackSafely}
            >
              <Text style={styles.textLinkLabel}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : showDeniedFallback ? (
        /* Estado 2: Permissão Negada / Bloqueada ou Câmera Indisponível (RF-02 / RN-059) */
        <ScrollView contentContainerStyle={styles.gateScrollContent}>
          <View testID="scanner-permission-denied-card" style={styles.gateCard}>
            <View style={[styles.gateIconBadge, styles.deniedIconBadge]}>
              <MaterialIcons name="no-photography" size={40} color={tokens.colors.danger} />
            </View>
            <Text style={styles.gateTitle}>
              {permission.status === 'blocked'
                ? 'Câmera Bloqueada no Dispositivo'
                : cameraMountError
                  ? 'Câmera Indisponível'
                  : 'Permissão de Câmera Negada'}
            </Text>
            <Text style={styles.gateDescription}>
              {cameraMountError
                ? `${cameraMountError} Utilize a digitação manual abaixo para validar o patrimônio do equipamento.`
                : permission.guidanceMessage}
            </Text>

            <Button
              testID="scanner-denied-manual-btn"
              title="Digitar Código do Equipamento"
              variant="primary"
              onPress={() => openManualModal('CAMERA_UNAVAILABLE')}
              style={styles.gatePrimaryBtn}
            />

            {permission.status === 'blocked' ? (
              <Button
                testID="scanner-open-settings-btn"
                title="Abrir Configurações do Aplicativo"
                variant="secondary"
                onPress={() => void permission.openSystemSettings()}
                style={styles.gateSecondaryBtn}
              />
            ) : (
              <Button
                testID="scanner-retry-permission-btn"
                title="Tentar Autorizar Câmera Novamente"
                variant="secondary"
                isLoading={permission.isLoading}
                onPress={() => {
                  setCameraMountError(null);
                  void permission.requestExplicitPermission();
                }}
                style={styles.gateSecondaryBtn}
              />
            )}

            <TouchableOpacity
              testID="scanner-denied-back-btn"
              style={styles.textLinkButton}
              onPress={navigateBackSafely}
            >
              <Text style={styles.textLinkLabel}>Voltar para Inspeção</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* Estado 3: Câmera Ativa + Máscara com Mira Central (RT-01 / RT-02) */
        <View style={styles.cameraStage}>
          <CameraView
            testID="scanner-camera-view"
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
            onMountError={(event) => {
              setCameraMountError(
                event?.message ||
                  'Não foi possível inicializar o hardware de câmera neste ambiente.'
              );
            }}
          />
          <CameraScannerOverlay
            expectedEquipment={expectedEquipment}
            overlayStatus={overlayStatus}
            statusMessage={statusMessage}
            torchEnabled={torchEnabled}
            onToggleTorch={() => setTorchEnabled((prev) => !prev)}
            onOpenManualEntry={() => openManualModal('DAMAGED_QR')}
            onBack={navigateBackSafely}
            onRetryScan={handleRetryScan}
          />
        </View>
      )}

      {/* Barra discreta de Simulador para validação em Expo Web / dispositivos sem etiqueta física */}
      <View style={styles.simulatorDock}>
        <TouchableOpacity
          testID="scanner-simulator-toggle"
          style={styles.simulatorToggle}
          onPress={() => setSimulatorExpanded((prev) => !prev)}
          accessibilityRole="button"
        >
          <MaterialIcons name="science" size={16} color={tokens.colors.info} />
          <Text style={styles.simulatorToggleText}>
            Simulador de Leitura em Campo (Validação) • {Platform.OS.toUpperCase()}
          </Text>
          <MaterialIcons
            name={simulatorExpanded ? 'expand-more' : 'expand-less'}
            size={18}
            color="#E2E8F0"
          />
        </TouchableOpacity>

        {simulatorExpanded ? (
          <View testID="scanner-simulator-panel" style={styles.simulatorPanel}>
            <Text style={styles.simulatorSectionLabel}>Permissão de câmera:</Text>
            <View style={styles.simulatorChipRow}>
              <TouchableOpacity
                style={styles.simChip}
                onPress={() => {
                  setCameraMountError(null);
                  permission.simulatePermissionStatus('granted');
                }}
              >
                <Text style={styles.simChipText}>Conceder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.simChip}
                onPress={() => permission.simulatePermissionStatus('denied')}
              >
                <Text style={styles.simChipText}>Negar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.simChip}
                onPress={() => permission.simulatePermissionStatus('blocked')}
              >
                <Text style={styles.simChipText}>Bloqueada</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.simChip}
                onPress={() => {
                  setCameraMountError(null);
                  permission.revokeConsent();
                }}
              >
                <Text style={styles.simChipText}>Pedir Consentimento</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.simulatorSectionLabel}>Simular leitura QR via debounce:</Text>
            <View style={styles.simulatorChipRow}>
              <TouchableOpacity
                testID="sim-scan-gd001"
                style={styles.simChipPrimary}
                onPress={() =>
                  handleBarcodeScanned({
                    data: 'QR-FIELDOPS-GD001',
                    type: 'qr',
                  } as BarcodeScanningResult)
                }
              >
                <Text style={styles.simChipPrimaryText}>QR-FIELDOPS-GD001</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="sim-scan-cp002"
                style={styles.simChipPrimary}
                onPress={() =>
                  handleBarcodeScanned({
                    data: 'QR-FIELDOPS-CP002',
                    type: 'qr',
                  } as BarcodeScanningResult)
                }
              >
                <Text style={styles.simChipPrimaryText}>QR-FIELDOPS-CP002</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="sim-scan-unknown"
                style={styles.simChipWarn}
                onPress={() =>
                  handleBarcodeScanned({
                    data: 'QR-DESCONHECIDO-999',
                    type: 'qr',
                  } as BarcodeScanningResult)
                }
              >
                <Text style={styles.simChipWarnText}>QR-DESCONHECIDO-999</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.simCustomRow}>
              <TextInput
                testID="sim-custom-code-input"
                style={styles.simCustomInput}
                placeholder="Outro QR ou código..."
                placeholderTextColor="#94A3B8"
                value={simulatorCode}
                onChangeText={setSimulatorCode}
              />
              <TouchableOpacity
                testID="sim-custom-scan-btn"
                style={styles.simCustomBtn}
                onPress={() =>
                  handleBarcodeScanned({
                    data: simulatorCode,
                    type: 'qr',
                  } as BarcodeScanningResult)
                }
              >
                <Text style={styles.simCustomBtnText}>Simular</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      {/* Modal Crítico de Divergência (RF-06 / CA-02) */}
      <DivergenceModal
        visible={Boolean(divergenceResult)}
        expectedEquipment={divergenceResult?.expectedEquipment ?? expectedEquipment}
        scannedEquipment={divergenceResult?.scannedEquipment}
        scannedCode={divergenceResult?.scannedCode ?? ''}
        isSubmitting={isSubmittingDivergence}
        errorMessage={divergenceError}
        onCancel={handleCancelDivergence}
        onConfirmOverride={handleConfirmDivergence}
      />

      {/* Modal de Fallback Manual (RF-02 / EX-01 / CA-03) */}
      <ManualCodeModal
        visible={manualModalVisible}
        defaultReason={manualDefaultReason}
        expectedEquipment={expectedEquipment}
        isSubmitting={isSubmittingManual}
        errorMessage={manualError}
        onCancel={() => {
          setManualModalVisible(false);
          setManualError(null);
          guardRef.current.unlock();
        }}
        onSubmit={handleManualSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  cameraStage: {
    flex: 1,
    position: 'relative',
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
    marginBottom: tokens.spacing.s,
  },
  expectedBox: {
    width: '100%',
    backgroundColor: tokens.colors.background,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.borderRadius.medium,
    padding: tokens.spacing.s,
    marginBottom: tokens.spacing.s,
  },
  expectedBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.primaryActive,
  },
  expectedBoxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.text,
    marginTop: 2,
  },
  expectedBoxMeta: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  gatePrimaryBtn: {
    width: '100%',
  },
  gateSecondaryBtn: {
    width: '100%',
  },
  textLinkButton: {
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.m,
  },
  textLinkLabel: {
    color: tokens.colors.primary,
    fontSize: 14,
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
    gap: tokens.spacing.xs,
  },
  simulatorSectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  simulatorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  simChip: {
    backgroundColor: '#334155',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: tokens.borderRadius.small,
  },
  simChipText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  simChipPrimary: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: tokens.borderRadius.small,
  },
  simChipPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  simChipWarn: {
    backgroundColor: '#B45309',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: tokens.borderRadius.small,
  },
  simChipWarnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  simCustomRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  simCustomInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: tokens.borderRadius.small,
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  simCustomBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.borderRadius.small,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  simCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
