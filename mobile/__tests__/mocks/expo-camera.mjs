import React from 'react';

let mockPermissionState = {
  status: 'undetermined',
  granted: false,
  canAskAgain: true,
  expires: 'never',
};

let mockRequestResult = null;

export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
};

export function __setMockCameraPermission(next) {
  mockPermissionState = {
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
    expires: 'never',
    ...next,
  };
  mockRequestResult = null;
}

export function __setMockRequestPermissionResult(next) {
  mockRequestResult = next;
}

export function __resetMockCameraPermission() {
  mockPermissionState = {
    status: 'undetermined',
    granted: false,
    canAskAgain: true,
    expires: 'never',
  };
  mockRequestResult = null;
}

export const Camera = {
  async getCameraPermissionsAsync() {
    return { ...mockPermissionState };
  },
  async requestCameraPermissionsAsync() {
    if (mockRequestResult) {
      mockPermissionState = { ...mockPermissionState, ...mockRequestResult };
    }
    return { ...mockPermissionState };
  },
};

export function useCameraPermissions() {
  return [
    mockPermissionState,
    Camera.requestCameraPermissionsAsync,
    Camera.getCameraPermissionsAsync,
  ];
}

export function CameraView({
  facing = 'back',
  enableTorch = false,
  barcodeScannerSettings,
  children,
  ...props
}) {
  return React.createElement(
    'div',
    {
      'data-expo-camera-view': 'true',
      'data-facing': facing,
      'data-enable-torch': String(Boolean(enableTorch)),
      'data-barcode-types': JSON.stringify(barcodeScannerSettings?.barcodeTypes ?? []),
      ...props,
    },
    children
  );
}

export default {
  CameraView,
  Camera,
  PermissionStatus,
  useCameraPermissions,
  __setMockCameraPermission,
  __setMockRequestPermissionResult,
  __resetMockCameraPermission,
};
