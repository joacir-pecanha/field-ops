export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'CLIENT_VIEWER' | string;

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  tokens: AuthTokens;
  user: AuthUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
  setSession: (session: AuthSession) => void;
  setTokens: (tokens: { accessToken: string; refreshToken?: string }) => void;
}
