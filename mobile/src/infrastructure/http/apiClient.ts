import { authStorage } from '../../features/auth/services/authStorage';

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  _retry?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface ApiClientConfig {
  baseUrl?: string;
  getAccessToken?: () => Promise<string | null>;
  getRefreshToken?: () => Promise<string | null>;
  onTokenRefreshed?: (tokens: { accessToken: string; refreshToken?: string }) => Promise<void> | void;
  onSessionExpired?: () => Promise<void> | void;
  customFetch?: typeof fetch;
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (err: any) => void;
}

/**
 * Cliente HTTP com suporte a autenticação Bearer, interceptor de 401,
 * fila de reintentos para renovação concorrente e proteção contra loops infinitos.
 * Atende aos requisitos AC-AUTH, RN-001, RN-007 e EX-02.
 */
export class ApiClient {
  private baseUrl: string;
  private getAccessTokenFn: () => Promise<string | null>;
  private getRefreshTokenFn: () => Promise<string | null>;
  private onTokenRefreshedCallback?: (tokens: { accessToken: string; refreshToken?: string }) => Promise<void> | void;
  private onSessionExpiredCallback?: () => Promise<void> | void;
  private fetchFn: typeof fetch;

  private isRefreshing = false;
  private refreshQueue: QueuedRequest[] = [];

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
    this.getAccessTokenFn = config.getAccessToken || (() => authStorage.getAccessToken());
    this.getRefreshTokenFn = config.getRefreshToken || (() => authStorage.getRefreshToken());
    this.onTokenRefreshedCallback = config.onTokenRefreshed;
    this.onSessionExpiredCallback = config.onSessionExpired;
    this.fetchFn = config.customFetch || ((...args) => fetch(...args));
  }

  /**
   * Define os callbacks de autenticação (usado na inicialização do store/contexto).
   */
  setAuthCallbacks(callbacks: {
    onTokenRefreshed?: (tokens: { accessToken: string; refreshToken?: string }) => Promise<void> | void;
    onSessionExpired?: () => Promise<void> | void;
  }) {
    if (callbacks.onTokenRefreshed) {
      this.onTokenRefreshedCallback = callbacks.onTokenRefreshed;
    }
    if (callbacks.onSessionExpired) {
      this.onSessionExpiredCallback = callbacks.onSessionExpired;
    }
  }

  /**
   * Processa a fila de requisições pendentes após renovação ou falha.
   */
  private processQueue(error: any, token: string | null = null) {
    this.refreshQueue.forEach((promise) => {
      if (error) {
        promise.reject(error);
      } else if (token) {
        promise.resolve(token);
      }
    });
    this.refreshQueue = [];
  }

  /**
   * Dispara a chamada ao endpoint de renovação de token.
   */
  private async executeTokenRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const refreshUrl = `${this.baseUrl}/api/v1/auth/refresh`;
    const response = await this.fetchFn(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Falha ao renovar sessão.');
    }

    const data = await response.json();
    const newAccessToken = data.accessToken || data.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token;

    if (!newAccessToken) {
      throw new ApiError(500, 'Resposta inválida do servidor ao renovar token.');
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Trata o erro 401: renova o token (ou aguarda na fila) e repete a requisição uma única vez.
   */
  private async handleUnauthorized<T>(
    endpoint: string,
    options: ApiRequestOptions
  ): Promise<T> {
    if (this.isRefreshing) {
      // Se já houver um processo de renovação em andamento, aguarda o novo token na fila
      const token = await new Promise<string>((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });

      // Repete a requisição original com o novo token
      return this.request<T>(endpoint, {
        ...options,
        _retry: true,
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = await this.getRefreshTokenFn();
      if (!refreshToken) {
        throw new ApiError(401, 'Nenhum token de renovação disponível.');
      }

      const refreshed = await this.executeTokenRefresh(refreshToken);

      // Persiste os novos tokens
      await authStorage.updateAccessToken(refreshed.accessToken, refreshed.refreshToken);

      if (this.onTokenRefreshedCallback) {
        await this.onTokenRefreshedCallback(refreshed);
      }

      // Libera todas as requisições que aguardavam na fila
      this.processQueue(null, refreshed.accessToken);

      // Repete a requisição que disparou o refresh uma única vez (AC-AUTH)
      return await this.request<T>(endpoint, {
        ...options,
        _retry: true,
      });
    } catch (refreshError) {
      this.processQueue(refreshError, null);

      // Limpa dados locais e notifica expiração da sessão (EX-02, RN-007)
      await authStorage.clearSession();
      if (this.onSessionExpiredCallback) {
        await this.onSessionExpiredCallback();
      }

      throw new ApiError(401, 'Sessão expirada. Por favor, realize o login novamente.');
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Executa uma requisição HTTP com interceptores de autenticação e reintentos.
   */
  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const {
      body,
      params,
      skipAuth = false,
      _retry = false,
      headers: customHeaders = {},
      ...customOptions
    } = options;

    let url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (!skipAuth) {
      const accessToken = await this.getAccessTokenFn();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    const init: RequestInit = {
      ...customOptions,
      headers,
    };

    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, init);
    } catch (networkError: any) {
      throw new ApiError(0, networkError.message || 'Falha na conexão de rede.');
    }

    // Interceptor 401 — Renovação transparente de token com reintento único
    if (response.status === 401 && !skipAuth && !_retry) {
      return this.handleUnauthorized<T>(endpoint, options);
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        try {
          errorData = await response.text();
        } catch {
          errorData = null;
        }
      }

      const message =
        (typeof errorData === 'object' && errorData !== null && (errorData.message || errorData.detail || errorData.error)) ||
        `Erro HTTP ${response.status}: ${response.statusText}`;

      throw new ApiError(response.status, message, errorData);
    }

    if (response.status === 204) {
      return null as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      return null as T;
    }
  }

  get<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
