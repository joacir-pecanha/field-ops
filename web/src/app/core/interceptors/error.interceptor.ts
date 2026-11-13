import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../services/notification.service';
import { IS_RETRY, SKIP_AUTH } from './http-context.tokens';

const AUTH_PUBLIC_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout'];

function isPublicAuthEndpoint(url: string): boolean {
  return AUTH_PUBLIC_PATHS.some((path) => url.includes(path));
}

/**
 * Interceptor funcional de tratamento de erros HTTP (TASK-006 Passo 3, RT-03).
 * - Em 401 em rotas protegidas, tenta renovação silenciosa via refresh token e repete uma única vez.
 * - Em falha de refresh ou ausência de refresh token, encerra sessão e redireciona para /login.
 * - Em 403, 500+ ou erro de rede (status 0), exibe feedback amigável ao usuário.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const skipAuth = req.context.get(SKIP_AUTH);
      const isRetry = req.context.get(IS_RETRY);

      if (error.status === 401 && !skipAuth && !isRetry && !isPublicAuthEndpoint(req.url)) {
        const refreshToken = authService.getRefreshToken();
        if (!refreshToken) {
          authService.handleSessionExpired();
          return throwError(() => error);
        }

        return authService.refreshToken().pipe(
          switchMap((authResponse) => {
            const retriedRequest = req.clone({
              setHeaders: {
                Authorization: `Bearer ${authResponse.accessToken}`,
              },
              context: req.context.set(IS_RETRY, true),
            });
            return next(retriedRequest);
          }),
          catchError((refreshError) => {
            authService.handleSessionExpired();
            return throwError(() => refreshError);
          })
        );
      }

      if (!skipAuth) {
        if (error.status === 403) {
          notifications.showError(
            'Você não possui permissão suficiente para executar esta operação.',
            'Acesso negado (403)'
          );
        } else if (error.status >= 500) {
          notifications.showError(
            'Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.',
            'Erro no servidor'
          );
        } else if (error.status === 0) {
          notifications.showError(
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
            'Erro de rede'
          );
        }
      }

      return throwError(() => error);
    })
  );
};

