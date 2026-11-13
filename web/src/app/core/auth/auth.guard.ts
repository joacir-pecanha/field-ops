import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, map } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { UserRole, WEB_ALLOWED_ROLES } from './auth.models';
import { AuthService } from './auth.service';

function evaluateRoleAccess(
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  authService: AuthService,
  router: Router,
  notifications: NotificationService
): boolean | UrlTree {
  if (authService.isTechnician()) {
    authService.clearLocalSession();
    return router.createUrlTree(['/login'], {
      queryParams: { reason: 'technician_mobile_only' },
    });
  }

  const allowedRoles =
    (route.data?.['roles'] as readonly UserRole[] | undefined) ?? WEB_ALLOWED_ROLES;

  if (!authService.hasAnyRole(allowedRoles)) {
    notifications.showError(
      'Seu perfil não possui permissão para acessar esta funcionalidade.',
      'Acesso negado (403)'
    );

    if (authService.hasAnyRole(WEB_ALLOWED_ROLES) && !state.url.startsWith('/app/dashboard')) {
      return router.createUrlTree(['/app/dashboard']);
    }

    authService.clearLocalSession();
    return router.createUrlTree(['/login']);
  }

  return true;
}

/**
 * Guard funcional que protege rotas administrativas (/app/**), exigindo sessão ativa
 * e verificando os perfis autorizados configurados na rota (TASK-006 Passo 4, RF-03, RF-04).
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  const accessToken = authService.getAccessToken();
  const refreshToken = authService.getRefreshToken();

  if (
    authService.hasActiveSession() &&
    accessToken &&
    !authService.isTokenExpired(accessToken)
  ) {
    return evaluateRoleAccess(route, state, authService, router, notifications);
  }

  if (refreshToken && !authService.isTokenExpired(refreshToken)) {
    return authService.restoreSession().pipe(
      map((restored) => {
        if (!restored) {
          return router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url, reason: 'session_expired' },
          });
        }
        return evaluateRoleAccess(route, state, authService, router, notifications);
      })
    );
  }

  authService.clearLocalSession();
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Guard funcional para rotas filhas dentro de /app.
 */
export const authChildGuard: CanActivateChildFn = (childRoute, state) =>
  authGuard(childRoute, state);

/**
 * Impede que usuários já autenticados acessem /login novamente sem fazer logout.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const accessToken = authService.getAccessToken();
  if (
    authService.hasActiveSession() &&
    accessToken &&
    !authService.isTokenExpired(accessToken) &&
    authService.hasAnyRole(WEB_ALLOWED_ROLES)
  ) {
    return router.createUrlTree(['/app/dashboard']);
  }

  return true;
};

