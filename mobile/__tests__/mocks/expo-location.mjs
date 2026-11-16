export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

let mockPermission = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
};

let mockServicesEnabled = true;
let mockPosition = {
  coords: {
    latitude: -23.50153,
    longitude: -47.45256,
    accuracy: 12.5,
  },
  timestamp: 1794780000000,
};
let mockError = null;

export function __setMockLocationState(next = {}) {
  if (next.permission !== undefined) mockPermission = next.permission;
  if (next.servicesEnabled !== undefined) mockServicesEnabled = next.servicesEnabled;
  if (next.position !== undefined) mockPosition = next.position;
  if (next.error !== undefined) mockError = next.error;
}

export function __resetMockLocationState() {
  mockPermission = {
    status: 'granted',
    granted: true,
    canAskAgain: true,
  };
  mockServicesEnabled = true;
  mockPosition = {
    coords: {
      latitude: -23.50153,
      longitude: -47.45256,
      accuracy: 12.5,
    },
    timestamp: 1794780000000,
  };
  mockError = null;
}

export async function getForegroundPermissionsAsync() {
  return { ...mockPermission };
}

export async function requestForegroundPermissionsAsync() {
  return { ...mockPermission };
}

export async function hasServicesEnabledAsync() {
  return mockServicesEnabled;
}

export async function getCurrentPositionAsync() {
  if (mockError) {
    throw mockError;
  }
  return mockPosition;
}

export default {
  Accuracy,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  getCurrentPositionAsync,
  __setMockLocationState,
  __resetMockLocationState,
};
