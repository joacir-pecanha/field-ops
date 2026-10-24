import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../../src/infrastructure/http/apiClient';

describe('ApiClient Interceptor & Retry Queue (AC-AUTH, EX-02, CA-02)', () => {
  let mockAccessToken: string | null;
  let mockRefreshToken: string | null;
  let refreshedTokens: { accessToken: string; refreshToken?: string } | null;
  let sessionExpiredCalled: boolean;
  let fetchHistory: Array<{ url: string; headers: Record<string, string>; body?: any }>;

  beforeEach(() => {
    mockAccessToken = 'expired-token-123';
    mockRefreshToken = 'valid-refresh-token-456';
    refreshedTokens = null;
    sessionExpiredCalled = false;
    fetchHistory = [];
  });

  test('Deve anexar cabeçalho Authorization: Bearer <token> em requisições autenticadas', async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchHistory.push({
        url: String(input),
        headers: (init?.headers as Record<string, string>) || {},
      });
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      getRefreshToken: async () => mockRefreshToken,
      customFetch: mockFetch,
    });

    const response = await client.get<any>('/api/v1/inspections');

    assert.equal(fetchHistory.length, 1);
    assert.equal(fetchHistory[0].headers['Authorization'], 'Bearer expired-token-123');
    assert.deepEqual(response, { status: 'ok' });
  });

  test('Deve omitir cabeçalho Authorization se skipAuth estiver habilitado', async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchHistory.push({
        url: String(input),
        headers: (init?.headers as Record<string, string>) || {},
      });
      return new Response(JSON.stringify({ result: 'public' }), { status: 200 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      customFetch: mockFetch,
    });

    await client.post('/api/v1/auth/login', { email: 'a@b.com' }, { skipAuth: true });

    assert.equal(fetchHistory.length, 1);
    assert.equal(fetchHistory[0].headers['Authorization'], undefined);
  });

  test('CA-02 & AC-AUTH: Token 401 deve acionar renovação silenciosa e reexecutar a requisição original com novo token', async () => {
    let callCount = 0;

    const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers as Record<string, string>) || {};
      fetchHistory.push({ url, headers });

      if (url.includes('/api/v1/inspections')) {
        callCount++;
        // Na primeira chamada (com token expirado), retorna 401
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 });
        }
        // Na segunda chamada (com token renovado), retorna sucesso
        return new Response(JSON.stringify({ data: ['inspection-1'] }), { status: 200 });
      }

      if (url.includes('/api/v1/auth/refresh')) {
        return new Response(JSON.stringify({
          accessToken: 'fresh-new-token-789',
          refreshToken: 'fresh-refresh-token-012',
        }), { status: 200 });
      }

      return new Response(null, { status: 404 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      getRefreshToken: async () => mockRefreshToken,
      onTokenRefreshed: (tokens) => {
        refreshedTokens = tokens;
        mockAccessToken = tokens.accessToken;
      },
      customFetch: mockFetch,
    });

    const result = await client.get<any>('/api/v1/inspections');

    // 1: inspections (401) -> 2: refresh (200) -> 3: inspections retry (200)
    assert.equal(fetchHistory.length, 3);
    assert.equal(fetchHistory[0].url, 'https://api.fieldops.test/api/v1/inspections');
    assert.equal(fetchHistory[0].headers['Authorization'], 'Bearer expired-token-123');

    assert.equal(fetchHistory[1].url, 'https://api.fieldops.test/api/v1/auth/refresh');

    assert.equal(fetchHistory[2].url, 'https://api.fieldops.test/api/v1/inspections');
    assert.equal(fetchHistory[2].headers['Authorization'], 'Bearer fresh-new-token-789');

    assert.deepEqual(refreshedTokens, {
      accessToken: 'fresh-new-token-789',
      refreshToken: 'fresh-refresh-token-012',
    });
    assert.deepEqual(result, { data: ['inspection-1'] });
  });

  test('Fila de reintentos: Múltiplas requisições paralelas que recebem 401 devem disparar apenas 1 chamada de refresh', async () => {
    let refreshCalls = 0;

    const mockFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers as Record<string, string>) || {};

      if (url.includes('/api/v1/auth/refresh')) {
        refreshCalls++;
        // Simula pequeno delay de rede no refresh
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({
          accessToken: 'parallel-token-999',
        }), { status: 200 });
      }

      // Requisições protegidas
      if (headers['Authorization'] === 'Bearer parallel-token-999') {
        return new Response(JSON.stringify({ endpoint: url, ok: true }), { status: 200 });
      }

      // Retorna 401 para token antigo
      return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      getRefreshToken: async () => mockRefreshToken,
      onTokenRefreshed: (tokens) => {
        mockAccessToken = tokens.accessToken;
      },
      customFetch: mockFetch,
    });

    // Dispara 3 requisições simultâneas
    const [res1, res2, res3] = await Promise.all([
      client.get<any>('/api/v1/resource-1'),
      client.get<any>('/api/v1/resource-2'),
      client.get<any>('/api/v1/resource-3'),
    ]);

    // Apenas 1 refresh executado
    assert.equal(refreshCalls, 1);
    assert.equal(res1.ok, true);
    assert.equal(res2.ok, true);
    assert.equal(res3.ok, true);
  });

  test('EX-02: Falha no refresh token (401/403) deve invocar onSessionExpired e lançar erro de sessão', async () => {
    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/refresh')) {
        return new Response(JSON.stringify({ error: 'Refresh token invalid' }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      getRefreshToken: async () => mockRefreshToken,
      onSessionExpired: () => {
        sessionExpiredCalled = true;
      },
      customFetch: mockFetch,
    });

    await assert.rejects(
      async () => {
        await client.get('/api/v1/protected-data');
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );

    assert.equal(sessionExpiredCalled, true);
  });

  test('AC-AUTH: Reintento único — requisição já retentada (_retry: true) não deve entrar em loop infinito', async () => {
    let refreshCalls = 0;

    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/refresh')) {
        refreshCalls++;
        return new Response(JSON.stringify({ accessToken: 'another-token' }), { status: 200 });
      }
      // Sempre retorna 401 mesmo após o novo token
      return new Response(JSON.stringify({ error: 'Permanent 401' }), { status: 401 });
    };

    const client = new ApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => mockAccessToken,
      getRefreshToken: async () => mockRefreshToken,
      customFetch: mockFetch,
    });

    await assert.rejects(
      async () => {
        await client.get('/api/v1/always-unauthorized');
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        return true;
      }
    );

    // Refresh chamado exatamente uma vez, sem recursão infinita
    assert.equal(refreshCalls, 1);
  });
});
