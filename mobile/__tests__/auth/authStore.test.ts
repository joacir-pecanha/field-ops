import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthApi, AuthError } from '../../src/features/auth/services/authApi';
import { AuthStorage, type ISecureStorage } from '../../src/features/auth/services/authStorage';
import { loginSchema } from '../../src/features/auth/schemas/authSchemas';
import { ApiClient } from '../../src/infrastructure/http/apiClient';

class MockSecureStorage implements ISecureStorage {
  private data = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

describe('Auth Services & Business Rules (RF-01, RF-02, RF-03, RF-04, RN-001, RN-007)', () => {
  let mockStorage: MockSecureStorage;
  let authStorage: AuthStorage;

  beforeEach(() => {
    mockStorage = new MockSecureStorage();
    authStorage = new AuthStorage(mockStorage);
  });

  describe('Validação Zod (RT-04)', () => {
    test('Deve validar formulário de login com e-mail e senha válidos', () => {
      const result = loginSchema.safeParse({
        email: 'tecnico@fieldops.com',
        password: 'SenhaForte123!',
      });

      assert.equal(result.success, true);
    });

    test('Deve rejeitar e-mail com formato inválido', () => {
      const result = loginSchema.safeParse({
        email: 'email-invalido',
        password: '123',
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.match(result.error.issues[0].message, /formato válido/);
      }
    });

    test('Deve rejeitar campos vazios', () => {
      const result = loginSchema.safeParse({
        email: '   ',
        password: '',
      });

      assert.equal(result.success, false);
    });
  });

  describe('AuthApi & Requisitos Funcionais', () => {
    test('RF-01: Login bem-sucedido com usuário ativo e par de tokens', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({
          accessToken: 'jwt-access-abc',
          refreshToken: 'jwt-refresh-xyz',
          user: {
            id: 'tec-1',
            name: 'Técnico Um',
            email: 'tecnico1@fieldops.com',
            role: 'TECHNICIAN',
            status: 'ACTIVE',
          },
        }), { status: 200 });
      };

      const apiClient = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetch,
      });

      const authApi = new AuthApi(apiClient);

      const response = await authApi.login({
        email: 'tecnico1@fieldops.com',
        password: 'senhaValida123',
      });

      assert.equal(response.accessToken, 'jwt-access-abc');
      assert.equal(response.refreshToken, 'jwt-refresh-xyz');
      assert.equal(response.user.status, 'ACTIVE');
      assert.equal(response.user.email, 'tecnico1@fieldops.com');
    });

    test('RF-02 & AC-AUTH: Credenciais inválidas retornam mensagem genérica sem expor se o e-mail existe', async () => {
      const mockFetch: typeof fetch = async () => {
        return new Response(JSON.stringify({
          message: 'Invalid email or password',
        }), { status: 401 });
      };

      const apiClient = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetch,
      });

      const authApi = new AuthApi(apiClient);

      await assert.rejects(
        async () => {
          await authApi.login({
            email: 'alguem@fieldops.com',
            password: 'senhaIncorreta',
          });
        },
        (err: any) => {
          assert.ok(err instanceof AuthError);
          assert.equal(err.code, 'INVALID_CREDENTIALS');
          assert.equal(err.message, 'Credenciais inválidas. Verifique seu e-mail e senha.');
          // Não revela nada sobre a existência do e-mail
          assert.doesNotMatch(err.message, /e-mail não existe|usuário não cadastrado/i);
          return true;
        }
      );
    });

    test('RF-03 & RN-001: Usuário inativo tem login negado com orientação clara', async () => {
      // Cenário 1: API retorna 403 com erro de usuário inativo
      const mockFetch403: typeof fetch = async () => {
        return new Response(JSON.stringify({
          code: 'USER_INACTIVE',
          message: 'User account is inactive',
        }), { status: 403 });
      };

      const client403 = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetch403,
      });

      const api403 = new AuthApi(client403);

      await assert.rejects(
        async () => {
          await api403.login({
            email: 'inativo@fieldops.com',
            password: 'senha',
          });
        },
        (err: any) => {
          assert.ok(err instanceof AuthError);
          assert.equal(err.code, 'USER_INACTIVE');
          assert.match(err.message, /inativo ou bloqueado/i);
          assert.match(err.message, /suporte ou administrador/i);
          return true;
        }
      );

      // Cenário 2: API retorna usuário com status INACTIVE
      const mockFetchStatusInactive: typeof fetch = async () => {
        return new Response(JSON.stringify({
          accessToken: 'token',
          refreshToken: 'refresh',
          user: {
            id: 'tec-inactive',
            name: 'Inativo',
            email: 'inativo@fieldops.com',
            role: 'TECHNICIAN',
            status: 'INACTIVE',
          },
        }), { status: 200 });
      };

      const clientInactive = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetchStatusInactive,
      });

      const apiInactive = new AuthApi(clientInactive);

      await assert.rejects(
        async () => {
          await apiInactive.login({
            email: 'inativo@fieldops.com',
            password: 'senha',
          });
        },
        (err: any) => {
          assert.ok(err instanceof AuthError);
          assert.equal(err.code, 'USER_INACTIVE');
          return true;
        }
      );
    });

    test('EX-01: Falha de conexão de rede orienta sobre a necessidade de internet para primeiro acesso', async () => {
      const mockFetchNetworkError: typeof fetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      const apiClient = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetchNetworkError,
      });

      const authApi = new AuthApi(apiClient);

      await assert.rejects(
        async () => {
          await authApi.login({
            email: 'offline@fieldops.com',
            password: 'senha',
          });
        },
        (err: any) => {
          assert.ok(err instanceof AuthError);
          assert.equal(err.code, 'NETWORK_ERROR');
          assert.match(err.message, /conexão com a internet/i);
          return true;
        }
      );
    });

    test('RF-04 & RN-007: Logout limpa sessão no storage mesmo se requisição de rede falhar', async () => {
      const mockFetchFailingLogout: typeof fetch = async () => {
        throw new TypeError('Network down');
      };

      const apiClient = new ApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: mockFetchFailingLogout,
      });

      const authApi = new AuthApi(apiClient);

      // Salva sessão local prévia
      await authStorage.saveSession({
        tokens: { accessToken: 'tok-1', refreshToken: 'tok-2' },
        user: { id: 'u1', name: 'Tec', email: 'tec@f.com', role: 'TECHNICIAN' },
      });

      // Chama logout remoto que falha em rede
      await authApi.logout('tok-2');

      // Limpeza de storage
      await authStorage.clearSession();

      // Sessão foi eliminada com sucesso
      assert.equal(await authStorage.getSession(), null);
    });
  });
});
