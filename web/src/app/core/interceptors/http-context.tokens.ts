import { HttpContextToken } from '@angular/common/http';

/**
 * Quando true, o jwtInterceptor não anexa Bearer token e o errorInterceptor
 * não aciona fluxo de refresh automático (ex: login, refresh, logout).
 */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/**
 * Marca requisição já reexecutada após renovação silenciosa de token para evitar loops infinitos.
 */
export const IS_RETRY = new HttpContextToken<boolean>(() => false);

