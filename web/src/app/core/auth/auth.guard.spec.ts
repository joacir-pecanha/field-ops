import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { authGuard, guestGuard } from './auth.guard';
import { AuthUser } from './auth.models';
import { AuthService } from './auth.service';
import { NotificationService } from '../services/notification.service';

function createJwtWithExp(expOffsetSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp }));
  return `${header}.${payload}.signature`;
}

describe('authGuard & guestGuard', () => {
  let router: Router;
  let authService: AuthService;
  let notificationService: NotificationService;

  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin User',
    email: 'admin@fieldops.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);
    notificationService = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  function runAuthGuard(
    url: string,
    roles?: readonly string[]
  ): MaybeAsync<GuardResult> {
    const route = { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(route, state));
  }

  it('should block unauthenticated access to /app/dashboard and redirect to /login (CA-01)', () => {
    const result = runAuthGuard('/app/dashboard', ['ADMIN', 'SUPERVISOR']);
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fapp%2Fdashboard');
  });

  it('should allow authenticated ADMIN user to access /app/dashboard and /app/users', async () => {
    localStorage.setItem('fieldops.auth.access_token', createJwtWithExp(600));
    localStorage.setItem('fieldops.auth.refresh_token', createJwtWithExp(3600));
    localStorage.setItem('fieldops.auth.user', JSON.stringify(adminUser));
    await firstValueFrom(authService.restoreSession());

    expect(runAuthGuard('/app/dashboard', ['ADMIN', 'SUPERVISOR'])).toBeTrue();
    expect(runAuthGuard('/app/users', ['ADMIN'])).toBeTrue();
  });

  it('should redirect SUPERVISOR away from ADMIN-only /app/users to /app/dashboard with 403 warning', async () => {
    const supervisor: AuthUser = { ...adminUser, role: 'SUPERVISOR', email: 'sup@fieldops.com' };
    localStorage.setItem('fieldops.auth.access_token', createJwtWithExp(600));
    localStorage.setItem('fieldops.auth.refresh_token', createJwtWithExp(3600));
    localStorage.setItem('fieldops.auth.user', JSON.stringify(supervisor));
    await firstValueFrom(authService.restoreSession());

    spyOn(notificationService, 'showError');

    const result = runAuthGuard('/app/users', ['ADMIN']);
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/dashboard');
    expect(notificationService.showError).toHaveBeenCalled();
  });

  it('should block TECHNICIAN session and redirect to /login with technician_mobile_only reason', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('valid-token');
    spyOn(authService, 'getRefreshToken').and.returnValue('valid-refresh');
    spyOn(authService, 'hasActiveSession').and.returnValue(true);
    spyOn(authService, 'isTokenExpired').and.returnValue(false);
    spyOn(authService, 'isTechnician').and.returnValue(true);
    spyOn(authService, 'clearLocalSession');

    const result = runAuthGuard('/app/dashboard', ['ADMIN', 'SUPERVISOR']);
    expect(authService.clearLocalSession).toHaveBeenCalled();
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?reason=technician_mobile_only');
  });

  it('should attempt restoreSession when access token is expired and refresh token is valid', async () => {
    spyOn(authService, 'getAccessToken').and.returnValue(createJwtWithExp(-60));
    spyOn(authService, 'getRefreshToken').and.returnValue(createJwtWithExp(3600));
    spyOn(authService, 'hasActiveSession').and.returnValue(false);
    spyOn(authService, 'restoreSession').and.returnValue(of(true));
    spyOn(authService, 'isTechnician').and.returnValue(false);
    spyOn(authService, 'hasAnyRole').and.returnValue(true);

    const result = runAuthGuard('/app/dashboard', ['ADMIN', 'SUPERVISOR']);
    expect(isObservable(result)).toBeTrue();
    const resolved = await firstValueFrom(result as Observable<boolean | UrlTree>);
    expect(resolved).toBeTrue();
  });

  it('should redirect authenticated ADMIN away from /login via guestGuard', async () => {
    localStorage.setItem('fieldops.auth.access_token', createJwtWithExp(600));
    localStorage.setItem('fieldops.auth.refresh_token', createJwtWithExp(3600));
    localStorage.setItem('fieldops.auth.user', JSON.stringify(adminUser));
    await firstValueFrom(authService.restoreSession());

    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/login' } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/dashboard');
  });
});
