import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthStorage, AUTH_STORAGE_KEYS, type ISecureStorage } from '../../src/features/auth/services/authStorage';
import type { AuthUser, AuthTokens } from '../../src/features/auth/types';

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

  dump() {
    return Object.fromEntries(this.data.entries());
  }
}

describe('AuthStorage (RT-01, RT-02, RN-007, AC-AUTH)', () => {
  let mockStore: MockSecureStorage;
  let authStorage: AuthStorage;

  const mockUser: AuthUser = {
    id: 'user-uuid-123',
    name: 'Carlos Silva',
    email: 'carlos.silva@fieldops.com',
    role: 'TECHNICIAN',
    status: 'ACTIVE',
    phone: '+55 11 98888-7777',
  };

  const mockTokens: AuthTokens = {
    accessToken: 'jwt-access-token-abc',
    refreshToken: 'jwt-refresh-token-xyz',
  };

  beforeEach(() => {
    mockStore = new MockSecureStorage();
    authStorage = new AuthStorage(mockStore);
  });

  test('Deve salvar e recuperar tokens de acesso e refresh no SecureStore', async () => {
    await authStorage.saveTokens(mockTokens);

    const accessToken = await authStorage.getAccessToken();
    const refreshToken = await authStorage.getRefreshToken();

    assert.equal(accessToken, mockTokens.accessToken);
    assert.equal(refreshToken, mockTokens.refreshToken);
  });

  test('Deve atualizar apenas o access token mantendo o refresh token', async () => {
    await authStorage.saveTokens(mockTokens);

    await authStorage.updateAccessToken('new-access-token-456');

    assert.equal(await authStorage.getAccessToken(), 'new-access-token-456');
    assert.equal(await authStorage.getRefreshToken(), mockTokens.refreshToken);
  });

  test('Deve salvar e recuperar perfil do usuário serializado em JSON', async () => {
    await authStorage.saveUser(mockUser);

    const retrievedUser = await authStorage.getUser();

    assert.deepEqual(retrievedUser, mockUser);
  });

  test('Deve salvar e recuperar uma sessão completa (tokens + dados do usuário)', async () => {
    await authStorage.saveSession({
      tokens: mockTokens,
      user: mockUser,
    });

    const session = await authStorage.getSession();

    assert.ok(session);
    assert.equal(session.tokens.accessToken, mockTokens.accessToken);
    assert.equal(session.tokens.refreshToken, mockTokens.refreshToken);
    assert.deepEqual(session.user, mockUser);
  });

  test('Deve retornar null ao buscar sessão se algum token estiver ausente', async () => {
    // Salva apenas usuário e access token
    await mockStore.setItemAsync(AUTH_STORAGE_KEYS.ACCESS_TOKEN, 'access-only');
    await authStorage.saveUser(mockUser);

    const session = await authStorage.getSession();
    assert.equal(session, null);
  });

  test('Deve retornar null e não estourar erro se os dados do perfil estiverem corrompidos', async () => {
    await mockStore.setItemAsync(AUTH_STORAGE_KEYS.USER_PROFILE, '{invalid-json');

    const user = await authStorage.getUser();
    assert.equal(user, null);
  });

  test('clearSession: Deve eliminar permanentemente todos os tokens e perfil do SecureStore (RN-007, RF-04)', async () => {
    await authStorage.saveSession({
      tokens: mockTokens,
      user: mockUser,
    });

    // Garante que existiam no store
    assert.ok(await authStorage.getAccessToken());
    assert.ok(await authStorage.getUser());

    // Executa a limpeza
    await authStorage.clearSession();

    assert.equal(await authStorage.getAccessToken(), null);
    assert.equal(await authStorage.getRefreshToken(), null);
    assert.equal(await authStorage.getUser(), null);
    assert.deepEqual(mockStore.dump(), {});
  });
});
