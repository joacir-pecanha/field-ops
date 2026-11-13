import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from './http-context.tokens';
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  const apiBase = environment.apiBaseUrl.replace(/\/+$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach Authorization Bearer header to API requests when token exists', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('jwt-abc-123');

    http.get(`${apiBase}/api/v1/auth/me`).subscribe();

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc-123');
    req.flush({});
  });

  it('should not attach Authorization header when SKIP_AUTH context is true', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('jwt-abc-123');

    http
      .post(
        `${apiBase}/api/v1/auth/login`,
        { email: 'a@b.com', password: '123' },
        { context: new HttpContext().set(SKIP_AUTH, true) }
      )
      .subscribe();

    const req = httpMock.expectOne(`${apiBase}/api/v1/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should not attach Authorization header to external third-party URLs', () => {
    spyOn(authService, 'getAccessToken').and.returnValue('jwt-abc-123');

    http.get('https://external.example.com/data').subscribe();

    const req = httpMock.expectOne('https://external.example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});

