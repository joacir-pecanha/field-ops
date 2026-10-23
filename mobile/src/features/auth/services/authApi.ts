import { apiClient, ApiError, ApiClient } from '../../../infrastructure/http/apiClient';
import type { AuthResponse, RefreshTokenResponse, LoginCredentials } from '../types';

export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'USER_INACTIVE' | 'NETWORK_ERROR' | 'UNKNOWN';

export class AuthError extends Error {
  code: AuthErrorCode;
  originalError?: any;

  constructor(message: string, code: AuthErrorCode = 'UNKNOWN', originalError?: any) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Serviço de comunicação com os endpoints de autenticação da API.
 * Atende aos requisitos RF-01, RF-02 (mensagem genérica para credenciais inválidas),
 * RF-03 (mensagem clara para usuário inativo) e EX-01 (erro de rede/offline).
 */
export class AuthApi {
  private client: ApiClient;

  constructor(client: ApiClient = apiClient) {
    this.client = client;
  }

  /**
   * Realiza a autenticação por e-mail e senha.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<any>('/api/v1/auth/login', {
        email: credentials.email.trim(),
        password: credentials.password,
      }, { skipAuth: true });

      const user = response.user || {
        id: response.id || response.userId,
        name: response.name,
        email: response.email,
        role: response.role || 'TECHNICIAN',
        status: response.status || 'ACTIVE',
        phone: response.phone,
      };

      // RF-03: Em caso de usuário inativo retornado, negar acesso com orientação clara
      if (user.status === 'INACTIVE' || user.status === 'BLOCKED') {
        throw new AuthError(
          'Usuário inativo ou bloqueado. Entre em contato com o suporte ou administrador.',
          'USER_INACTIVE'
        );
      }

      const accessToken = response.accessToken || response.access_token;
      const refreshToken = response.refreshToken || response.refresh_token;

      if (!accessToken || !refreshToken) {
        throw new AuthError('Resposta de autenticação inválida do servidor.', 'UNKNOWN');
      }

      return {
        accessToken,
        refreshToken,
        user,
      };
    } catch (err: any) {
      if (err instanceof AuthError) {
        throw err;
      }

      if (err instanceof ApiError) {
        // RF-03: Status 403 ou resposta explícita indicando inatividade do usuário
        if (
          err.status === 403 ||
          (typeof err.data === 'object' &&
            (err.data?.code === 'USER_INACTIVE' || err.data?.code === 'USER_BLOCKED'))
        ) {
          throw new AuthError(
            'Usuário inativo ou bloqueado. Entre em contato com o suporte ou administrador.',
            'USER_INACTIVE',
            err
          );
        }

        // RF-02 & AC-AUTH: 401 Credenciais inválidas (mensagem genérica sem expor se e-mail existe)
        if (err.status === 401) {
          throw new AuthError(
            'Credenciais inválidas. Verifique seu e-mail e senha.',
            'INVALID_CREDENTIALS',
            err
          );
        }

        // EX-01: Status 0 geralmente indica erro de conexão de rede/offline no cliente
        if (err.status === 0) {
          throw new AuthError(
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet para realizar o primeiro acesso.',
            'NETWORK_ERROR',
            err
          );
        }

        throw new AuthError(err.message || 'Erro durante a autenticação.', 'UNKNOWN', err);
      }

      // EX-01: Erros gerais de rede / offline
      if (err.name === 'TypeError' || err.message?.includes('Network') || err.message?.includes('fetch')) {
        throw new AuthError(
          'Não foi possível conectar ao servidor. Verifique sua conexão com a internet para realizar o primeiro acesso.',
          'NETWORK_ERROR',
          err
        );
      }

      throw new AuthError('Erro inesperado durante o login. Tente novamente.', 'UNKNOWN', err);
    }
  }

  /**
   * Renova o token de acesso utilizando o refresh token.
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await this.client.post<any>('/api/v1/auth/refresh', {
      refreshToken,
    }, { skipAuth: true });

    return {
      accessToken: response.accessToken || response.access_token,
      refreshToken: response.refreshToken || response.refresh_token,
    };
  }

  /**
   * Notifica a API sobre o encerramento da sessão para invalidar o refresh token.
   */
  async logout(refreshToken?: string): Promise<void> {
    try {
      await this.client.post('/api/v1/auth/logout', {
        refreshToken,
      }, { skipAuth: true });
    } catch {
      // Falha de rede no logout remoto não deve impedir o logout local seguro (RN-007)
    }
  }
}

export const authApi = new AuthApi();
