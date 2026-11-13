import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthError, AuthResponse, AuthUser } from './auth.models';
import { AuthService } from './auth.service';

function createJwtWithExp(expOffsetSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp }));
  return `${header}.${payload}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  const apiBase = environment.apiBaseUrl.replace(/\/+$/, '');

  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Joacir Peçanha',
    email: 'admin@fieldops.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should authenticate ADMIN user, persist tokens and update signals and observables', async () => {
    const mockResponse: AuthResponse = {
      accessToken: createJwtWithExp(900),
      refreshToken: createJwtWithExp(3600),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: adminUser,
    };

    let observedUser: AuthUser | null = null;
    const sub = service.currentUser$.subscribe((u) => (observedUser = u));

    const loginPromise = firstValueFrom(
      service.login({ email: ' admin@fieldops.com ', password: 'secret123' })
    );

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'admin@fieldops.com', password: 'secret123' });
    req.flush(mockResponse);

    const loggedUser = await loginPromise;
    expect(loggedUser).toEqual(adminUser);
    expect(service.currentUser()).toEqual(adminUser);
    expect<AuthUser | null>(observedUser).toEqual(adminUser);
    expect(service.isAuthenticated()).toBeTrue();
    expect(localStorage.getItem('fieldops.auth.access_token')).toBe(mockResponse.accessToken);
    expect(localStorage.getItem('fieldops.auth.refresh_token')).toBe(mockResponse.refreshToken);
    sub.unsubscribe();
  });

  it('should reject TECHNICIAN login with mobile-only message and NOT persist session (EX-02)', async () => {
    const techResponse: AuthResponse = {
      accessToken: createJwtWithExp(900),
      refreshToken: createJwtWithExp(3600),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { ...adminUser, role: 'TECHNICIAN', email: 'tech@fieldops.com' },
    };

    const loginPromise = firstValueFrom(
      service.login({ email: 'tech@fieldops.com', password: 'secret123' })
    );

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    req.flush(techResponse);

    await expectAsync(loginPromise).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'TECHNICIAN_MOBILE_ONLY',
      })
    );

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('fieldops.auth.access_token')).toBeNull();
  });

  it('should map 401 error to INVALID_CREDENTIALS AuthError', async () => {
    const loginPromise = firstValueFrom(
      service.login({ email: 'admin@fieldops.com', password: 'wrong' })
    );

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    req.flush({ status: 401, code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

    try {
      await loginPromise;
      fail('Expected login to fail');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('should map network failure (status 0) to NETWORK_ERROR (EX-01)', async () => {
    const loginPromise = firstValueFrom(
      service.login({ email: 'admin@fieldops.com', password: 'secret123' })
    );

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expectAsync(loginPromise).toBeRejectedWith(
      jasmine.objectContaining({ code: 'NETWORK_ERROR' })
    );
  });

  it('should map 500 error to SERVER_ERROR (RT-03)', async () => {
    const loginPromise = firstValueFrom(
      service.login({ email: 'admin@fieldops.com', password: 'secret123' })
    );

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    req.flush({ status: 500 }, { status: 500, statusText: 'Internal Server Error' });

    await expectAsync(loginPromise).toBeRejectedWith(
      jasmine.objectContaining({ code: 'SERVER_ERROR' })
    );
  });

  it('should restore session from storage on F5 reload when access token is valid (RF-02)', async () => {
    localStorage.setItem('fieldops.auth.access_token', createJwtWithExp(600));
    localStorage.setItem('fieldops.auth.refresh_token', createJwtWithExp(3600));
    localStorage.setItem('fieldops.auth.user', JSON.stringify(adminUser));

    const restored = await firstValueFrom(service.restoreSession());

    expect(restored).toBeTrue();
    expect(service.currentUser()).toEqual(adminUser);
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('should silently refresh session during restoreSession when access token is expired but refresh token is valid', async () => {
    const expiredAccess = createJwtWithExp(-60);
    const validRefresh = createJwtWithExp(3600);
    const newAccess = createJwtWithExp(900);
    const newRefresh = createJwtWithExp(7200);

    localStorage.setItem('fieldops.auth.access_token', expiredAccess);
    localStorage.setItem('fieldops.auth.refresh_token', validRefresh);
    localStorage.setItem('fieldops.auth.user', JSON.stringify(adminUser));

    const restorePromise = firstValueFrom(service.restoreSession());

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: validRefresh });
    req.flush({
      accessToken: newAccess,
      refreshToken: newRefresh,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: adminUser,
    } satisfies AuthResponse);

    const restored = await restorePromise;
    expect(restored).toBeTrue();
    expect(service.getAccessToken()).toBe(newAccess);
    expect(service.getRefreshToken()).toBe(newRefresh);
  });

  it('should deduplicate concurrent refreshToken() requests', async () => {
    const validRefresh = createJwtWithExp(3600);
    localStorage.setItem('fieldops.auth.refresh_token', validRefresh);

    const p1 = firstValueFrom(service.refreshToken());
    const p2 = firstValueFrom(service.refreshToken());

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/refresh`);
    req.flush({
      accessToken: createJwtWithExp(900),
      refreshToken: createJwtWithExp(7200),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: adminUser,
    } satisfies AuthResponse);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.accessToken).toBe(r2.accessToken);
  });

  it('should clear local storage and redirect to /login on logout (CA-03)', async () => {
    localStorage.setItem('fieldops.auth.access_token', 'token-1');
    localStorage.setItem('fieldops.auth.refresh_token', 'refresh-1');
    localStorage.setItem('fieldops.auth.user', JSON.stringify(adminUser));

    const logoutPromise = firstValueFrom(service.logout());

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    await logoutPromise;

    expect(localStorage.getItem('fieldops.auth.access_token')).toBeNull();
    expect(localStorage.getItem('fieldops.auth.refresh_token')).toBeNull();
    expect(localStorage.getItem('fieldops.auth.user')).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], { queryParams: undefined });
  });
});
