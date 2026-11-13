import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthError, AuthErrorCode } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

interface FeedbackBanner {
  severity: 'error' | 'warning' | 'network';
  title: string;
  message: string;
  code?: AuthErrorCode | 'SESSION_EXPIRED';
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = this.authService.isLoading;
  readonly submitted = signal(false);
  readonly showPassword = signal(false);
  readonly banner = signal<FeedbackBanner | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly emailControl = this.loginForm.controls.email;
  readonly passwordControl = this.loginForm.controls.password;

  readonly isSubmitDisabled = computed(() => this.isLoading());

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.banner.set({
        severity: 'warning',
        title: 'Sessão expirada',
        message: 'Sua sessão expirou ou foi invalidada. Entre novamente para continuar.',
        code: 'SESSION_EXPIRED',
      });
    } else if (reason === 'technician_mobile_only') {
      this.banner.set({
        severity: 'warning',
        title: 'Acesso exclusivo pelo aplicativo móvel',
        message:
          'Contas com perfil Técnico devem utilizar o aplicativo FieldOps Mobile para executar inspeções em campo.',
        code: 'TECHNICIAN_MOBILE_ONLY',
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  hasFieldError(controlName: 'email' | 'password', errorKey: string): boolean {
    const control = this.loginForm.controls[controlName];
    return Boolean(control.hasError(errorKey) && (control.touched || this.submitted()));
  }

  isFieldInvalid(controlName: 'email' | 'password'): boolean {
    const control = this.loginForm.controls[controlName];
    return Boolean(control.invalid && (control.touched || this.submitted()));
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.banner.set(null);

    if (this.loginForm.invalid || this.isLoading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email, password }).subscribe({
      next: () => {
        const returnUrl = this.resolveSafeReturnUrl();
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: unknown) => {
        this.banner.set(this.mapFeedbackBanner(err));
      },
    });
  }

  private resolveSafeReturnUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    if (raw && raw.startsWith('/app')) {
      return raw;
    }
    return '/app/dashboard';
  }

  private mapFeedbackBanner(error: unknown): FeedbackBanner {
    if (error instanceof AuthError) {
      switch (error.code) {
        case 'TECHNICIAN_MOBILE_ONLY':
          return {
            severity: 'warning',
            title: 'Acesso via aplicativo móvel',
            message: error.message,
            code: error.code,
          };
        case 'NETWORK_ERROR':
          return {
            severity: 'network',
            title: 'Sem conexão com o servidor',
            message: error.message,
            code: error.code,
          };
        case 'USER_INACTIVE':
          return {
            severity: 'warning',
            title: 'Conta inativa ou bloqueada',
            message: error.message,
            code: error.code,
          };
        case 'FORBIDDEN':
          return {
            severity: 'error',
            title: 'Acesso não autorizado (403)',
            message: error.message,
            code: error.code,
          };
        case 'SERVER_ERROR':
          return {
            severity: 'error',
            title: 'Erro interno do servidor (500)',
            message: error.message,
            code: error.code,
          };
        case 'INVALID_CREDENTIALS':
          return {
            severity: 'error',
            title: 'Falha na autenticação (401)',
            message: error.message,
            code: error.code,
          };
        default:
          return {
            severity: 'error',
            title: 'Não foi possível entrar',
            message: error.message,
            code: error.code,
          };
      }
    }

    return {
      severity: 'error',
      title: 'Erro inesperado',
      message: 'Não foi possível processar o login. Tente novamente.',
      code: 'UNKNOWN',
    };
  }
}

