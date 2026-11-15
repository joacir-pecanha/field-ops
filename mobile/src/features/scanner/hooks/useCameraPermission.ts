import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Camera } from 'expo-camera';

export type CameraPermissionStatus = 'undetermined' | 'granted' | 'denied' | 'blocked';

export interface RawCameraPermission {
  status?: string | null;
  granted?: boolean;
  canAskAgain?: boolean;
}

export interface CameraPermissionState {
  status: CameraPermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  hasExplicitConsent: boolean;
  isLoading: boolean;
  guidanceMessage: string | null;
}

export const CONSENT_PROMPT_MESSAGE =
  'O FieldOps precisa acessar a câmera do dispositivo exclusivamente para ler o QR Code fixado no equipamento e confirmar que você está inspecionando o ativo correto.';

export const PERMISSION_DENIED_GUIDANCE =
  'A permissão da câmera foi recusada. Você pode autorizar o acesso novamente ou prosseguir digitando manualmente o código patrimonial / QR Code do equipamento.';

export const PERMISSION_BLOCKED_GUIDANCE =
  'O acesso à câmera está bloqueado nas configurações do sistema. Abra as configurações do dispositivo para habilitar a câmera para o FieldOps ou utilize a digitação manual do código do equipamento.';

export interface UseCameraPermissionOptions {
  autoCheck?: boolean;
  initialConsent?: boolean;
  initialState?: Partial<CameraPermissionState>;
  getPermission?: () => Promise<RawCameraPermission>;
  requestPermission?: () => Promise<RawCameraPermission>;
  openSettings?: () => Promise<void> | void;
}

/**
 * Converte a resposta bruta do sistema operacional/Expo em estado tipado e seguro para UI.
 */
export function resolveCameraPermissionState(
  rawPermission: RawCameraPermission | null | undefined,
  hasExplicitConsent: boolean,
  isLoading = false
): CameraPermissionState {
  if (!rawPermission) {
    return {
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      hasExplicitConsent,
      isLoading,
      guidanceMessage: hasExplicitConsent ? null : CONSENT_PROMPT_MESSAGE,
    };
  }

  const normalizedRawStatus = String(rawPermission.status ?? '').trim().toLowerCase();
  const isGranted = Boolean(rawPermission.granted) || normalizedRawStatus === 'granted';
  const canAskAgain = rawPermission.canAskAgain !== false;

  if (isGranted) {
    if (!hasExplicitConsent) {
      return {
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        hasExplicitConsent: false,
        isLoading,
        guidanceMessage: CONSENT_PROMPT_MESSAGE,
      };
    }

    return {
      status: 'granted',
      granted: true,
      canAskAgain: true,
      hasExplicitConsent: true,
      isLoading,
      guidanceMessage: null,
    };
  }

  if (normalizedRawStatus === 'denied' || rawPermission.granted === false) {
    if (normalizedRawStatus === 'undetermined' && canAskAgain) {
      return {
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
        hasExplicitConsent,
        isLoading,
        guidanceMessage: hasExplicitConsent ? null : CONSENT_PROMPT_MESSAGE,
      };
    }

    const status: CameraPermissionStatus = canAskAgain ? 'denied' : 'blocked';
    return {
      status,
      granted: false,
      canAskAgain,
      hasExplicitConsent,
      isLoading,
      guidanceMessage: canAskAgain ? PERMISSION_DENIED_GUIDANCE : PERMISSION_BLOCKED_GUIDANCE,
    };
  }

  return {
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
    hasExplicitConsent,
    isLoading,
    guidanceMessage: hasExplicitConsent ? null : CONSENT_PROMPT_MESSAGE,
  };
}

/**
 * Hook de permissão de câmera com consentimento explícito prévio (RF-01 / RN-058)
 * e orientação explicativa para estados negado ou bloqueado (RF-02 / RN-059).
 */
export function useCameraPermission(options: UseCameraPermissionOptions = {}) {
  const getPermRef = useRef(options.getPermission);
  getPermRef.current = options.getPermission;

  const reqPermRef = useRef(options.requestPermission);
  reqPermRef.current = options.requestPermission;

  const openSettingsRef = useRef(options.openSettings);
  openSettingsRef.current = options.openSettings;

  const initialConsent = Boolean(options.initialState?.hasExplicitConsent ?? options.initialConsent);

  const [state, setState] = useState<CameraPermissionState>(() => {
    if (options.initialState) {
      const status = options.initialState.status ?? 'undetermined';
      const granted = options.initialState.granted ?? status === 'granted';
      const canAskAgain = options.initialState.canAskAgain ?? status !== 'blocked';
      const hasExplicitConsent =
        options.initialState.hasExplicitConsent ?? options.initialConsent ?? false;
      const defaultGuidance =
        status === 'blocked'
          ? PERMISSION_BLOCKED_GUIDANCE
          : status === 'denied'
            ? PERMISSION_DENIED_GUIDANCE
            : !hasExplicitConsent
              ? CONSENT_PROMPT_MESSAGE
              : null;

      return {
        status,
        granted,
        canAskAgain,
        hasExplicitConsent,
        isLoading: options.initialState.isLoading ?? false,
        guidanceMessage: options.initialState.guidanceMessage ?? defaultGuidance,
      };
    }

    return resolveCameraPermissionState(null, initialConsent, options.autoCheck !== false);
  });

  const refreshPermission = useCallback(async (consentOverride?: boolean) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const consent = consentOverride ?? state.hasExplicitConsent;
    try {
      const fetcher = getPermRef.current ?? Camera.getCameraPermissionsAsync;
      const raw = await fetcher();
      const resolved = resolveCameraPermissionState(raw, consent, false);
      setState(resolved);
      return resolved;
    } catch {
      const fallback = resolveCameraPermissionState(null, consent, false);
      setState(fallback);
      return fallback;
    }
  }, [state.hasExplicitConsent]);

  useEffect(() => {
    if (options.autoCheck === false || options.initialState) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const fetcher = getPermRef.current ?? Camera.getCameraPermissionsAsync;
        const raw = await fetcher();
        if (!active) return;
        setState(resolveCameraPermissionState(raw, initialConsent, false));
      } catch {
        if (!active) return;
        setState(resolveCameraPermissionState(null, initialConsent, false));
      }
    })();

    return () => {
      active = false;
    };
  }, [options.autoCheck, options.initialState, initialConsent]);

  const requestExplicitPermission = useCallback(async (): Promise<CameraPermissionState> => {
    setState((prev) => ({ ...prev, hasExplicitConsent: true, isLoading: true }));

    try {
      const requester = reqPermRef.current ?? Camera.requestCameraPermissionsAsync;
      const raw = await requester();
      const resolved = resolveCameraPermissionState(raw, true, false);
      setState(resolved);
      return resolved;
    } catch {
      const deniedFallback = resolveCameraPermissionState(
        { status: 'denied', granted: false, canAskAgain: true },
        true,
        false
      );
      setState(deniedFallback);
      return deniedFallback;
    }
  }, []);

  const revokeConsent = useCallback(() => {
    setState((prev) =>
      resolveCameraPermissionState(
        {
          status: prev.granted ? 'granted' : prev.status,
          granted: prev.granted,
          canAskAgain: prev.canAskAgain,
        },
        false,
        false
      )
    );
  }, []);

  const openSystemSettings = useCallback(async (): Promise<boolean> => {
    try {
      if (openSettingsRef.current) {
        await openSettingsRef.current();
        return true;
      }
      if (typeof Linking.openSettings === 'function') {
        await Linking.openSettings();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const simulatePermissionStatus = useCallback((status: CameraPermissionStatus) => {
    if (status === 'granted') {
      setState(
        resolveCameraPermissionState(
          { status: 'granted', granted: true, canAskAgain: true },
          true,
          false
        )
      );
      return;
    }

    if (status === 'denied') {
      setState(
        resolveCameraPermissionState(
          { status: 'denied', granted: false, canAskAgain: true },
          true,
          false
        )
      );
      return;
    }

    if (status === 'blocked') {
      setState(
        resolveCameraPermissionState(
          { status: 'denied', granted: false, canAskAgain: false },
          true,
          false
        )
      );
      return;
    }

    setState(
      resolveCameraPermissionState(
        { status: 'undetermined', granted: false, canAskAgain: true },
        false,
        false
      )
    );
  }, []);

  return {
    state,
    status: state.status,
    granted: state.granted,
    canAskAgain: state.canAskAgain,
    hasExplicitConsent: state.hasExplicitConsent,
    isLoading: state.isLoading,
    guidanceMessage: state.guidanceMessage,
    refreshPermission,
    requestExplicitPermission,
    revokeConsent,
    openSystemSettings,
    simulatePermissionStatus,
  };
}
