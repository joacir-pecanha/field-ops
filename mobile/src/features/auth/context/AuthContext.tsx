import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store';
import type { AuthState } from '../types';

export interface AuthContextValue extends AuthState {}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provedor de contexto de autenticação React.
 * Inicializa a sessão persistida a partir do hardware seguro (SecureStore)
 * e disponibiliza o estado global de sessão via hook useAuth().
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const store = useAuthStore();

  useEffect(() => {
    if (!store.isInitialized) {
      store.initializeAuth();
    }
  }, [store.isInitialized, store.initializeAuth]);

  const value = useMemo(() => store, [
    store.isAuthenticated,
    store.user,
    store.accessToken,
    store.refreshToken,
    store.isLoading,
    store.isInitialized,
    store.error,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook de acesso ao contexto de autenticação.
 * Pode ser utilizado dentro da árvore do AuthProvider ou com fallback direto para a store Zustand.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context) {
    return context;
  }
  // Fallback direto para Zustand para permitir uso fora de componentes React ou em testes
  return useAuthStore();
}
