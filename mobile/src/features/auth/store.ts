import { create } from 'zustand';
import type { AuthState, AuthUser, LoginCredentials, AuthSession } from './types';
import { authStorage } from './services/authStorage';
import { authApi } from './services/authApi';
import { apiClient } from '../../infrastructure/http/apiClient';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(credentials);
      
      const session: AuthSession = {
        tokens: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        },
        user: response.user,
      };

      // Persiste com segurança no SecureStore (RT-01, RN-007)
      await authStorage.saveSession(session);

      set({
        isAuthenticated: true,
        user: session.user,
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Erro ao realizar login.',
      });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const { refreshToken } = get();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignora erro de rede no logout remoto
    } finally {
      // Elimina permanentemente os tokens e dados sensíveis do SecureStore (RN-007, AC-AUTH, RF-04)
      await authStorage.clearSession();

      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        error: null,
      });
    }
  },

  initializeAuth: async () => {
    try {
      const session = await authStorage.getSession();

      if (session && session.tokens.accessToken && session.user) {
        set({
          isAuthenticated: true,
          user: session.user,
          accessToken: session.tokens.accessToken,
          refreshToken: session.tokens.refreshToken,
          isInitialized: true,
        });
      } else {
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          isInitialized: true,
        });
      }
    } catch {
      set({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        isInitialized: true,
      });
    }
  },

  clearError: () => set({ error: null }),

  setSession: (session: AuthSession) => {
    set({
      isAuthenticated: true,
      user: session.user,
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      error: null,
    });
  },

  setTokens: (tokens: { accessToken: string; refreshToken?: string }) => {
    set((state) => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || state.refreshToken,
    }));
  },
}));

// Conecta o interceptor HTTP aos callbacks do estado de autenticação
apiClient.setAuthCallbacks({
  onTokenRefreshed: (tokens) => {
    useAuthStore.getState().setTokens(tokens);
  },
  onSessionExpired: () => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      error: 'Sua sessão expirou. Por favor, acesse novamente.',
    });
  },
});
