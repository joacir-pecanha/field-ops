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

/**
 * Serviço de armazenamento seguro de credenciais, tokens JWT e perfil do usuário.
 * Atende aos requisitos RT-01 (expo-secure-store obrigatório) e RT-02/RN-007 (nunca logar tokens).
 */
export class AuthStorage {
  private storage: ISecureStorage;

  constructor(storage: ISecureStorage = SecureStore) {
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
