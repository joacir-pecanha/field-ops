import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';
import { jwtInterceptor } from './jwt.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;
  let notifications: NotificationService;

  const apiBase = environment.apiBaseUrl.replace(/\/+$/, '');
  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin User',
    email: 'admin@fieldops.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should refresh token silently on 401 and retry the original request once', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
    spyOn(authService, 'getRefreshToken').and.returnValue('valid-refresh');

    const refreshedResponse: AuthResponse = {
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: adminUser,
    };
    spyOn(authService, 'refreshToken').and.returnValue(of(refreshedResponse));

    let responseData: unknown;
    http.get(`${apiBase}/api/v1/clients`).subscribe((res) => (responseData = res));

    const firstReq = httpMock.expectOne(`${apiBase}/api/v1/clients`);
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    firstReq.flush({ status: 401 }, { status: 401, statusText: 'Unauthorized' });

    const retryReq = httpMock.expectOne(`${apiBase}/api/v1/clients`);
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    retryReq.flush({ items: ['Client A'] });

    expect(responseData).toEqual({ items: ['Client A'] });
  });

  it('should handle session expiration when refreshToken fails on 401', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('expired-token');
    spyOn(authService, 'getRefreshToken').and.returnValue('revoked-refresh');
    spyOn(authService, 'refreshToken').and.returnValue(
      throwError(() => new Error('Refresh failed'))
    );
    spyOn(authService, 'handleSessionExpired');

    let capturedError: unknown;
    http.get(`${apiBase}/api/v1/clients`).subscribe({
      error: (err) => (capturedError = err),
    });

    const firstReq = httpMock.expectOne(`${apiBase}/api/v1/clients`);
    firstReq.flush({ status: 401 }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.handleSessionExpired).toHaveBeenCalled();
    expect(capturedError).toBeTruthy();
  });

  it('should notify user on 403 Forbidden and 500 Internal Server Error', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('valid-token');
    spyOn(notifications, 'showError');

    http.get(`${apiBase}/api/v1/admin/users`).subscribe({ error: () => void 0 });
    const req403 = httpMock.expectOne(`${apiBase}/api/v1/admin/users`);
    req403.flush({}, { status: 403, statusText: 'Forbidden' });

    expect(notifications.showError).toHaveBeenCalledWith(
      jasmine.any(String),
      'Acesso negado (403)'
    );

    http.get(`${apiBase}/api/v1/clients`).subscribe({ error: () => void 0 });
    const req500 = httpMock.expectOne(`${apiBase}/api/v1/clients`);
    req500.flush({}, { status: 500, statusText: 'Internal Server Error' });

    expect(notifications.showError).toHaveBeenCalledWith(
      jasmine.any(String),
      'Erro no servidor'
    );
  });
});

