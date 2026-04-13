// context/AuthContext.tsx
// Versão corrigida: bloqueia auto-login do Firebase quando TOTP está ativo
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/firebase';
import { totpStorage, verifyCode } from '@/services/totp';

// ─── Tipos ────────────────────────────────────────────────────────────────────
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

  // ─── Listener Firebase ──────────────────────────────────────────────────────
  // CORREÇÃO: quando o Firebase restaura a sessão automaticamente ao abrir o app,
  // verificamos se o TOTP está ativo. Se estiver, bloqueamos o acesso e exigimos
  // o código — sem isso, o Firebase simplesmente pulava a verificação.
  useEffect(() => {
    const unsub = authService.onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const hasTOTP = await totpStorage.isEnabled();

        if (hasTOTP) {
          // TOTP ativo: não libera o acesso ainda
          setPendingUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName,
            email: firebaseUser.email,
          });
          setTotpRequired(true);
          setUser(null); // user null = app entende que não está logado ainda
        } else {
          // Sem TOTP: liberar normalmente
          const u: AuthUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName,
            email: firebaseUser.email,
          };
          setUser(u);
          await AsyncStorage.setItem('@cofre_user', JSON.stringify(u));
        }
      } else {
        setUser(null);
        setPendingUser(null);
        setTotpRequired(false);
        await AsyncStorage.removeItem('@cofre_user');
      }

      setLoading(false);
    });

    return unsub;
  }, []); // listener registrado uma única vez

  // ─── Login (1ª etapa) ─────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<LoginResult> => {
    setAuthError(null);
    try {
      const firebaseUser = await authService.login(email, password);
      const hasTOTP = await totpStorage.isEnabled();

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
      await AsyncStorage.setItem('@cofre_user', JSON.stringify(u));
      return { success: true };

    } catch (e: any) {
      const msg = authService.getErrorMessage(e.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // ─── Confirmar TOTP (2ª etapa) ────────────────────────────────────────────────
  const confirmTOTP = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingUser) {
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    if (!/^\d{6}$/.test(code)) {
      return { success: false, error: 'Digite exatamente 6 dígitos.' };
    }

    const secret = await totpStorage.load();
    if (!secret) {
      // Secret sumiu (edge case): libera sem TOTP
      const u: AuthUser = { ...pendingUser };
      setUser(u);
      await AsyncStorage.setItem('@cofre_user', JSON.stringify(u));
      setTotpRequired(false);
      setPendingUser(null);
      return { success: true };
    }

    const valid = verifyCode(code, secret);
    if (!valid) {
      return { success: false, error: 'Código inválido ou expirado. Verifique o Google Authenticator.' };
    }

    // Código válido → liberar acesso
    const u: AuthUser = { ...pendingUser };
    setUser(u);
    await AsyncStorage.setItem('@cofre_user', JSON.stringify(u));
    setTotpRequired(false);
    setPendingUser(null);
    return { success: true };
  };

  // ─── Cancelar login TOTP ──────────────────────────────────────────────────────
  const cancelTOTPLogin = async () => {
    await authService.logout(); // limpa sessão do Firebase também
    setTotpRequired(false);
    setPendingUser(null);
    setUser(null);
  };

  // ─── Registro ─────────────────────────────────────────────────────────────────
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
      await AsyncStorage.setItem('@cofre_user', JSON.stringify(u));
      return { success: true };
    } catch (e: any) {
      const msg = authService.getErrorMessage(e.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    await authService.logout();
    setUser(null);
    setTotpRequired(false);
    setPendingUser(null);
    await AsyncStorage.removeItem('@cofre_user');
  };

  // ─── Reset de senha ───────────────────────────────────────────────────────────
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
