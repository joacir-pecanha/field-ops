import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from '../interceptors/http-context.tokens';
import { NotificationService } from '../services/notification.service';
import {
  ApiProblemDetail,
  AuthError,
  AuthResponse,
  AuthUser,
  LoginRequest,
  UserRole,
  WEB_ALLOWED_ROLES,
} from './auth.models';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'fieldops.auth.access_token',
  REFRESH_TOKEN: 'fieldops.auth.refresh_token',
  USER: 'fieldops.auth.user',
} as const;

/**
 * Serviço central de autenticação, gestão de sessão JWT e autorização por perfil (TASK-006).
 * Expõe tanto Angular Signals quanto Observables RxJS para consumo reativo em componentes e guards.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _hasAccessToken = signal<boolean>(false);

  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly userRole = computed<UserRole | null>(() => this._currentUser()?.role ?? null);
  readonly isAuthenticated = computed<boolean>(
    () => this._currentUser() !== null && this._hasAccessToken()
  );

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly isAuthenticated$ = this.currentUser$.pipe(
    map((user) => user !== null && Boolean(this.getAccessToken()))
  );

  constructor() {
    this.hydrateFromStorage();
  }

  /**
   * Restaura e valida a sessão salva no navegador (executado na inicialização / F5).
   * Caso o access token esteja expirado mas o refresh token ainda seja válido,
   * renova silenciosamente a sessão antes de liberar a navegação.
   */
  restoreSession(): Observable<boolean> {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    const storedUser = this.readStoredUser();

    if (!storedUser || !this.isUserEligibleForWeb(storedUser)) {
      this.clearSessionStorage();
      return of(false);
    }

    if (accessToken && !this.isTokenExpired(accessToken)) {
      this.setUserState(storedUser, true);
      return of(true);
    }

    if (refreshToken && !this.isTokenExpired(refreshToken)) {
      return this.refreshToken().pipe(
        map(() => true),
        catchError(() => {
          this.clearSessionStorage();
          return of(false);
        })
      );
    }

    this.clearSessionStorage();
    return of(false);
  }

  /**
   * Autentica o usuário na API, valida elegibilidade para a interface web
   * (barrando TECHNICIAN com mensagem clara) e persiste a sessão.
   */
  login(credentials: LoginRequest): Observable<AuthUser> {
    this._isLoading.set(true);

    const payload: LoginRequest = {
      email: credentials.email.trim(),
      password: credentials.password,
    };

    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/api/v1/auth/login`, payload, {
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .pipe(
        map((response) => {
          this.validateWebAuthResponse(response);
          this.persistSession(response);
          return response.user;
        }),
        catchError((error: unknown) => throwError(() => this.mapLoginError(error))),
        finalize(() => this._isLoading.set(false))
      );
  }

  /**
   * Renova os tokens de sessão usando o refresh token armazenado.
   * Deduplica chamadas concorrentes quando múltiplas requisições falham com 401 simultaneamente.
   */
  refreshToken(): Observable<AuthResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new AuthError('Sessão expirada.', 'SESSION_EXPIRED', 401));
    }

    this.refreshInFlight$ = this.http
      .post<AuthResponse>(
        `${this.apiBaseUrl}/api/v1/auth/refresh`,
        { refreshToken },
        { context: new HttpContext().set(SKIP_AUTH, true) }
      )
      .pipe(
        tap((response) => {
          this.validateWebAuthResponse(response);
          this.persistSession(response);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );

    return this.refreshInFlight$;
  }

  /**
   * Encerra a sessão no backend (best-effort) e limpa imediatamente os tokens locais,
   * redirecionando o usuário para /login.
   */
  logout(options?: { redirect?: boolean; reason?: 'manual' | 'session_expired' }): Observable<void> {
    const refreshToken = this.getRefreshToken();
    const shouldRedirect = options?.redirect ?? true;

    this.clearSessionStorage();

    const remoteLogout$ = refreshToken
      ? this.http
          .post<void>(
            `${this.apiBaseUrl}/api/v1/auth/logout`,
            { refreshToken },
            { context: new HttpContext().set(SKIP_AUTH, true) }
          )
          .pipe(catchError(() => of(void 0)))
      : of(void 0);

    return remoteLogout$.pipe(
      tap(() => {
        if (shouldRedirect) {
          void this.navigateToLogin(options?.reason);
        }
      })
    );
  }

  /**
   * Trata expiração irrecuperável de sessão limpando credenciais locais e enviando para /login.
   */
  handleSessionExpired(): void {
    const hadSession = this.hasActiveSession() || Boolean(this.getRefreshToken());
    this.clearSessionStorage();

    if (hadSession) {
      this.notifications.showWarning(
        'Sua sessão expirou ou foi invalidada. Faça login novamente para continuar.',
        'Sessão expirada'
      );
    }

    void this.navigateToLogin('session_expired');
  }

  /**
   * Limpa dados locais de sessão sem chamada HTTP (ex: perfil TECHNICIAN barrado pelo guard).
   */
  clearLocalSession(): void {
    this.clearSessionStorage();
  }

  getAccessToken(): string | null {
    return this.readStorage(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    return this.readStorage(STORAGE_KEYS.REFRESH_TOKEN);
  }

  hasActiveSession(): boolean {
    return Boolean(this.getAccessToken()) && this._currentUser() !== null;
  }

  hasAnyRole(allowedRoles: readonly UserRole[] = WEB_ALLOWED_ROLES): boolean {
    const role = this._currentUser()?.role;
    return role !== undefined && allowedRoles.includes(role);
  }

  isTechnician(): boolean {
    return this._currentUser()?.role === 'TECHNICIAN';
  }

  isTokenExpired(token: string, skewSeconds = 15): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload || typeof payload['exp'] !== 'number') {
      return false;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload['exp'] <= nowSeconds + skewSeconds;
  }

  private hydrateFromStorage(): void {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    const storedUser = this.readStoredUser();

    if (!storedUser || !this.isUserEligibleForWeb(storedUser)) {
      this.clearSessionStorage();
      return;
    }

    const hasUsableAccess = Boolean(accessToken) && !this.isTokenExpired(accessToken!);
    const hasUsableRefresh = Boolean(refreshToken) && !this.isTokenExpired(refreshToken!);

    if (hasUsableAccess || hasUsableRefresh) {
      this.setUserState(storedUser, Boolean(accessToken));
      return;
    }

    this.clearSessionStorage();
  }

  private validateWebAuthResponse(response: AuthResponse | null | undefined): void {
    if (!response?.accessToken || !response?.refreshToken || !response?.user) {
      throw new AuthError('Resposta de autenticação inválida recebida do servidor.', 'SERVER_ERROR', 500);
    }

    if (response.user.role === 'TECHNICIAN') {
      throw new AuthError(
        'Contas com perfil Técnico devem acessar o FieldOps exclusivamente pelo aplicativo móvel.',
        'TECHNICIAN_MOBILE_ONLY',
        403
      );
    }

    if (!WEB_ALLOWED_ROLES.includes(response.user.role)) {
      throw new AuthError(
        'Seu perfil não possui autorização para acessar a interface administrativa web.',
        'FORBIDDEN',
        403
      );
    }

    if (response.user.status && response.user.status !== 'ACTIVE') {
      throw new AuthError(
        'Usuário inativo ou bloqueado. Entre em contato com o administrador.',
        'USER_INACTIVE',
        403
      );
    }
  }

  private isUserEligibleForWeb(user: AuthUser): boolean {
    return (
      Boolean(user.id) &&
      Boolean(user.email) &&
      WEB_ALLOWED_ROLES.includes(user.role) &&
      (!user.status || user.status === 'ACTIVE')
    );
  }

  private persistSession(response: AuthResponse): void {
    this.writeStorage(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    this.writeStorage(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    this.writeStorage(STORAGE_KEYS.USER, JSON.stringify(response.user));
    this.setUserState(response.user, true);
  }

  private clearSessionStorage(): void {
    this.removeStorage(STORAGE_KEYS.ACCESS_TOKEN);
    this.removeStorage(STORAGE_KEYS.REFRESH_TOKEN);
    this.removeStorage(STORAGE_KEYS.USER);
    this.setUserState(null, false);
  }

  private setUserState(user: AuthUser | null, hasToken: boolean): void {
    this._currentUser.set(user);
    this._hasAccessToken.set(hasToken);
    this.currentUserSubject.next(user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = this.readStorage(STORAGE_KEYS.USER);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AuthUser>;
      if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string' && parsed.role) {
        return parsed as AuthUser;
      }
      return null;
    } catch {
      return null;
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const json = atob(padded);
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private mapLoginError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const problem = (typeof error.error === 'object' && error.error !== null
        ? error.error
        : {}) as ApiProblemDetail;

      if (error.status === 0) {
        return new AuthError(
          'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
          'NETWORK_ERROR',
          0
        );
      }

      if (error.status === 401) {
        return new AuthError(
          'Credenciais inválidas. Verifique seu e-mail e senha.',
          'INVALID_CREDENTIALS',
          401
        );
      }

      if (error.status === 403) {
        if (problem.code === 'USER_INACTIVE' || problem.code === 'USER_BLOCKED') {
          return new AuthError(
            problem.detail ||
              problem.message ||
              'Usuário inativo ou bloqueado. Entre em contato com o administrador.',
            'USER_INACTIVE',
            403
          );
        }

        return new AuthError(
          problem.detail ||
            problem.message ||
            'Acesso negado. Você não possui permissão para acessar o painel administrativo.',
          'FORBIDDEN',
          403
        );
      }

      if (error.status >= 500) {
        return new AuthError(
          'Erro interno no servidor ao processar sua solicitação. Tente novamente em instantes.',
          'SERVER_ERROR',
          error.status
        );
      }

      return new AuthError(
        problem.detail || problem.message || 'Não foi possível concluir o login. Verifique os dados informados.',
        'UNKNOWN',
        error.status
      );
    }

    return new AuthError('Ocorreu um erro inesperado ao tentar entrar.', 'UNKNOWN', 0);
  }

  private navigateToLogin(reason?: 'manual' | 'session_expired' | 'unauthorized'): Promise<boolean> {
    const queryParams =
      reason && reason !== 'manual' ? { reason } : undefined;
    return this.router.navigate(['/login'], { queryParams });
  }

  private readStorage(key: string): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignora falhas de storage em ambientes restritos sem quebrar a navegação
    }
  }

  private removeStorage(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignora falhas de storage em ambientes restritos
    }
  }
}

