import { authService } from '@/services/firebase';
import { secureStorage } from '@/services/secureStorage';
import { totpStorage, verifyCode } from '@/services/totp';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
}

interface PendingUser {
  uid: string;
  name: string | null;
  email: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  totpRequired: boolean;
  confirmTOTP: (code: string) => Promise<{ success: boolean; error?: string }>;
  cancelTOTPLogin: () => void;
}

type LoginResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; totpRequired: true };

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [pendingUser, setPendingUser]   = useState<PendingUser | null>(null);
  const [loading, setLoading]           = useState(true);
  const [authError, setAuthError]       = useState<string | null>(null);
  const [totpRequired, setTotpRequired] = useState(false);

  // Listener do Firebase — restaura sessão automaticamente ao abrir o app
  useEffect(() => {
    const unsub = authService.onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Sessão restaurada → libera direto sem pedir TOTP novamente
        // (TOTP só é exigido em login manual via função login() abaixo)
        const u: AuthUser = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
        };
        setUser(u);
        setTotpRequired(false);
        setPendingUser(null);
        await secureStorage.setItem('cofre_user', u);
      } else {
        setUser(null);
        setPendingUser(null);
        setTotpRequired(false);
        await secureStorage.removeItem('cofre_user');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // LOGIN MANUAL — aqui sim exige TOTP se estiver ativo
  const login = async (email: string, password: string): Promise<LoginResult> => {
    setAuthError(null);
    try {
      const firebaseUser = await authService.login(email, password);
      const hasTOTP = await totpStorage.isEnabled(firebaseUser.uid);

      if (hasTOTP) {
        setPendingUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
        });
        setTotpRequired(true);
        setUser(null);
        return { success: false, totpRequired: true };
      }

      const u: AuthUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName,
        email: firebaseUser.email,
      };
      setUser(u);
      await secureStorage.setItem('cofre_user', u);
      return { success: true };
    } catch (e: any) {
      const msg = authService.getErrorMessage(e.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const confirmTOTP = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingUser) return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    if (!/^\d{6}$/.test(code)) return { success: false, error: 'Digite exatamente 6 dígitos.' };

    const secret = await totpStorage.load(pendingUser.uid);
    if (!secret || secret.trim().length === 0) {
      return { success: false, error: 'Chave de segurança não encontrada neste dispositivo.' };
    }

    const valid = verifyCode(code, secret);
    if (!valid) return { success: false, error: 'Código inválido ou expirado. Verifique o Google Authenticator.' };

    const u: AuthUser = { ...pendingUser };
    setUser(u);
    await secureStorage.setItem('cofre_user', u);
    setTotpRequired(false);
    setPendingUser(null);
    return { success: true };
  };

  const cancelTOTPLogin = async () => {
    await authService.logout();
    setTotpRequired(false);
    setPendingUser(null);
    setUser(null);
  };

  const register = async (name: string, email: string, password: string) => {
    setAuthError(null);
    try {
      const firebaseUser = await authService.register(name, email, password);
      const u: AuthUser = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName ?? name,
        email: firebaseUser.email,
      };
      setUser(u);
      await secureStorage.setItem('cofre_user', u);
      return { success: true };
    } catch (e: any) {
      const msg = authService.getErrorMessage(e.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setTotpRequired(false);
    setPendingUser(null);
    await secureStorage.removeItem('cofre_user');
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.resetPassword(email);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: authService.getErrorMessage(e.code) };
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider value={{
      user, loading, authError,
      login, register, logout, resetPassword, clearError,
      totpRequired, confirmTOTP, cancelTOTPLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
