import React from 'react';

let mockSearchParams = {};

const mockRouterState = {
  pushed: [],
  replaced: [],
  backCount: 0,
  paramsUpdates: [],
};

export function __setMockSearchParams(params) {
  mockSearchParams = { ...(params || {}) };
}

export function __resetMockRouter() {
  mockSearchParams = {};
  mockRouterState.pushed = [];
  mockRouterState.replaced = [];
  mockRouterState.backCount = 0;
  mockRouterState.paramsUpdates = [];
}

export function __getMockRouterHistory() {
  return {
    pushed: [...mockRouterState.pushed],
    replaced: [...mockRouterState.replaced],
    backCount: mockRouterState.backCount,
    paramsUpdates: [...mockRouterState.paramsUpdates],
  };
}

const mockRouter = {
  push(target) {
    mockRouterState.pushed.push(target);
  },
  replace(target) {
    mockRouterState.replaced.push(target);
  },
  back() {
    mockRouterState.backCount += 1;
  },
  setParams(params) {
    mockRouterState.paramsUpdates.push(params);
    mockSearchParams = { ...mockSearchParams, ...(params || {}) };
  },
  canGoBack() {
    return mockRouterState.pushed.length > 0;
  },
};

export function useRouter() {
  return mockRouter;
}

export function useLocalSearchParams() {
  return mockSearchParams;
}

export function useFocusEffect(_effect) {
  // No-op em renderização estática SSR de testes
}

export function Redirect({ href, ...props }) {
  return React.createElement('span', {
    'data-redirect': typeof href === 'string' ? href : JSON.stringify(href),
    ...props,
  });
}

function createNavigatorComponent(name) {
  const Navigator = ({ children, ...props }) =>
    React.createElement('div', { 'data-navigator': name, ...props }, children);
  Navigator.Screen = ({ name: screenName, ...props }) =>
    React.createElement('div', {
      'data-navigator-screen': `${name}:${screenName}`,
      ...props,
    });
  return Navigator;
}

export const Stack = createNavigatorComponent('Stack');
export const Tabs = createNavigatorComponent('Tabs');

export default {
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
  Redirect,
  Stack,
  Tabs,
  __setMockSearchParams,
  __resetMockRouter,
  __getMockRouterHistory,
};
