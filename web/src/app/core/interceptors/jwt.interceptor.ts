import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from './http-context.tokens';

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  const normalizedBase = apiBaseUrl.replace(/\/+$/, '');
  if (normalizedBase && url.startsWith(normalizedBase)) {
    return true;
  }
  return url.startsWith('/api/');
}

/**
 * Interceptor funcional que anexa o cabeçalho Authorization: Bearer <token>
 * em todas as chamadas autenticadas para a API FieldOps (TASK-006 Passo 2).
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH) || !isApiRequest(req.url, environment.apiBaseUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();

  if (!accessToken) {
    return next(req);
  }

  const authenticatedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authenticatedReq);
};

