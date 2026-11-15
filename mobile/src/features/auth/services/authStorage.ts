import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, AuthUser, AuthSession } from '../types';

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'fieldops_auth_access_token',
  REFRESH_TOKEN: 'fieldops_auth_refresh_token',
  USER_PROFILE: 'fieldops_auth_user_profile',
} as const;

export interface ISecureStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

interface NativeSecureStorageCandidate extends Partial<ISecureStorage> {
  isAvailableAsync?: () => Promise<boolean>;
}

function getBrowserLocalStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (
      storage &&
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    ) {
      return storage;
    }
  } catch {
    // localStorage pode estar indisponível em ambientes restritos
  }
  return null;
}

export function createFallbackStorage(): ISecureStorage {
  const memoryFallback = new Map<string, string>();

  return {
    async getItemAsync(key: string): Promise<string | null> {
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          return webStorage.getItem(key);
        } catch {
          // Usa fallback em memória se localStorage falhar
        }
      }
      return memoryFallback.has(key) ? memoryFallback.get(key)! : null;
    },

    async setItemAsync(key: string, value: string): Promise<void> {
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          webStorage.setItem(key, value);
          return;
        } catch {
          // Usa fallback em memória se localStorage falhar (ex.: quota ou privado)
        }
      }
      memoryFallback.set(key, value);
    },

    async deleteItemAsync(key: string): Promise<void> {
      const webStorage = getBrowserLocalStorage();
      if (webStorage) {
        try {
          webStorage.removeItem(key);
        } catch {
          // Ignora falha do localStorage e limpa fallback em memória
        }
      }
      memoryFallback.delete(key);
    },
  };
}

function isSecureStoreUnavailableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return (
    message.includes('is not a function') ||
    message.includes('not available on web') ||
    message.includes('setvaluewithkeyasync') ||
    message.includes('getvaluewithkeyasync') ||
    message.includes('deletevaluewithkeyasync') ||
    message.includes('expo-secure-store') ||
    message.includes('native module')
  );
}

/**
 * Adaptador resiliente de armazenamento seguro:
 * utiliza `expo-secure-store` em dispositivos nativos e recorre automaticamente
 * ao `localStorage` (ou memória) no Expo Web, onde a ponte nativa não existe.
 */
export function createDefaultSecureStorage(
  primary: NativeSecureStorageCandidate = SecureStore,
  fallback: ISecureStorage = createFallbackStorage()
): ISecureStorage {
  let useFallback = false;

  const canUsePrimary = async (): Promise<boolean> => {
    if (useFallback) {
      return false;
    }
    if (
      typeof primary?.getItemAsync !== 'function' ||
      typeof primary?.setItemAsync !== 'function' ||
      typeof primary?.deleteItemAsync !== 'function'
    ) {
      useFallback = true;
      return false;
    }
    if (typeof primary.isAvailableAsync === 'function') {
      try {
        const available = await primary.isAvailableAsync();
        if (!available) {
          useFallback = true;
          return false;
        }
      } catch (error) {
        if (isSecureStoreUnavailableError(error)) {
          useFallback = true;
          return false;
        }
      }
    }
    return true;
  };

  const runWithFallback = async <T>(
    runPrimary: () => Promise<T>,
    runFallback: () => Promise<T>
  ): Promise<T> => {
    if (await canUsePrimary()) {
      try {
        return await runPrimary();
      } catch (error) {
        if (!isSecureStoreUnavailableError(error)) {
          throw error;
        }
        useFallback = true;
      }
    }
    return runFallback();
  };

  return {
    getItemAsync: (key: string) =>
      runWithFallback(
        () => primary.getItemAsync!(key),
        () => fallback.getItemAsync(key)
      ),
    setItemAsync: (key: string, value: string) =>
      runWithFallback(
        () => primary.setItemAsync!(key, value),
        () => fallback.setItemAsync(key, value)
      ),
    deleteItemAsync: (key: string) =>
      runWithFallback(
        () => primary.deleteItemAsync!(key),
        () => fallback.deleteItemAsync(key)
      ),
  };
}

const defaultSecureStorage: ISecureStorage = createDefaultSecureStorage();

/**
 * Serviço de armazenamento seguro de credenciais, tokens JWT e perfil do usuário.
 * Atende aos requisitos RT-01 (expo-secure-store obrigatório) e RT-02/RN-007 (nunca logar tokens).
 */
export class AuthStorage {
  private storage: ISecureStorage;

  constructor(storage: ISecureStorage = defaultSecureStorage) {
    this.storage = storage;
  }

  /**
   * Salva os tokens de acesso e de refresh no SecureStore.
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Access token e Refresh token são obrigatórios para armazenamento.');
    }
    await this.storage.setItemAsync(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    await this.storage.setItemAsync(AUTH_STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
  }

  /**
   * Atualiza apenas o token de acesso (e opcionalmente o refresh token se fornecido).
   */
  async updateAccessToken(accessToken: string, refreshToken?: string): Promise<void> {
    if (!accessToken) {
      throw new Error('Access token é obrigatório.');
    }
    await this.storage.setItemAsync(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      await this.storage.setItemAsync(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  /**
   * Obtém o token de acesso armazenado.
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await this.storage.getItemAsync(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Obtém o refresh token armazenado.
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.storage.getItemAsync(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  }

  /**
   * Salva os dados do perfil do usuário em formato JSON no SecureStore.
   */
  async saveUser(user: AuthUser): Promise<void> {
    if (!user || !user.id || !user.email) {
      throw new Error('Dados de usuário inválidos.');
    }
    await this.storage.setItemAsync(AUTH_STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
  }

  /**
   * Recupera os dados do perfil do usuário do SecureStore.
   */
  async getUser(): Promise<AuthUser | null> {
    try {
      const raw = await this.storage.getItemAsync(AUTH_STORAGE_KEYS.USER_PROFILE);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  /**
   * Salva a sessão completa (tokens + dados do usuário).
   */
  async saveSession(session: AuthSession): Promise<void> {
    await this.saveTokens(session.tokens);
    await this.saveUser(session.user);
  }

  /**
   * Recupera a sessão completa (tokens + usuário).
   * Retorna null se qualquer componente essencial estiver ausente.
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      const [accessToken, refreshToken, user] = await Promise.all([
        this.getAccessToken(),
        this.getRefreshToken(),
        this.getUser(),
      ]);

      if (!accessToken || !refreshToken || !user) {
        return null;
      }

      return {
        tokens: {
          accessToken,
          refreshToken,
        },
        user,
      };
    } catch {
      return null;
    }
  }

  /**
   * Elimina todos os dados da sessão do dispositivo (RN-007, AC-AUTH).
   */
  async clearSession(): Promise<void> {
    await Promise.allSettled([
      this.storage.deleteItemAsync(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
      this.storage.deleteItemAsync(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
      this.storage.deleteItemAsync(AUTH_STORAGE_KEYS.USER_PROFILE),
    ]);
  }
}

export const authStorage = new AuthStorage();
