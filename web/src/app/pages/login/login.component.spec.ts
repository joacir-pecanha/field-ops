import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthError, AuthUser } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let isLoadingSignal: ReturnType<typeof signal<boolean>>;
  let authServiceMock: jasmine.SpyObj<AuthService>;
  let router: Router;

  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Joacir Peçanha',
    email: 'admin@fieldops.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    isLoadingSignal = signal(false);
    authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', ['login'], {
      isLoading: isLoadingSignal.asReadonly(),
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should display required and email validation errors without calling login', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(authServiceMock.login).not.toHaveBeenCalled();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('O e-mail é obrigatório.');
    expect(compiled.textContent).toContain('A senha é obrigatória.');

    component.loginForm.setValue({ email: 'invalido', password: '123' });
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Informe um endereço de e-mail válido.');
  });

  it('should disable submit button during loading and navigate to /app/dashboard on valid login (CA-02)', () => {
    const response$ = new Subject<AuthUser>();
    authServiceMock.login.and.returnValue(response$.asObservable());
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    component.loginForm.setValue({ email: 'admin@fieldops.com', password: 'secret123' });
    component.onSubmit();
    isLoadingSignal.set(true);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBeTrue();

    isLoadingSignal.set(false);
    response$.next(adminUser);
    response$.complete();
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/dashboard');
  });

  it('should show clear mobile-only warning when TECHNICIAN attempts web login (EX-02)', () => {
    authServiceMock.login.and.returnValue(
      throwError(
        () =>
          new AuthError(
            'Contas com perfil Técnico devem acessar o FieldOps exclusivamente pelo aplicativo móvel.',
            'TECHNICIAN_MOBILE_ONLY',
            403
          )
      )
    );

    component.loginForm.setValue({ email: 'tech@fieldops.com', password: 'secret123' });
    component.onSubmit();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.feedback-banner') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('aplicativo móvel');
  });

  it('should show network error banner when offline during login (EX-01)', () => {
    authServiceMock.login.and.returnValue(
      throwError(
        () =>
          new AuthError(
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
            'NETWORK_ERROR',
            0
          )
      )
    );

    component.loginForm.setValue({ email: 'admin@fieldops.com', password: 'secret123' });
    component.onSubmit();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.banner-network') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Sem conexão com o servidor');
  });
});

