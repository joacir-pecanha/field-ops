import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  user: { id: string; name: string; email: string } | null;
  login: (email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  login: (email) => set({ 
    isAuthenticated: true, 
    user: { id: '1', name: 'Técnico Exemplo', email } 
  }),
  logout: () => set({ isAuthenticated: false, user: null }),
}));
