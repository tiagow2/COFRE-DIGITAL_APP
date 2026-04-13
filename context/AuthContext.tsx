import { debugLogger } from '@/services/debugLogger';
import { authService } from '@/services/firebase';
import { secureStorage } from '@/services/secureStorage';
import { totpStorage, verifyCode } from '@/services/totp';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

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

  useEffect(() => {
    const unsub = authService.onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const hasTOTP = await totpStorage.isEnabled(firebaseUser.uid); // Passa o UID

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
          await secureStorage.setItem('cofre_user', u);
        }
      } else {
        setUser(null);
        setPendingUser(null);
        setTotpRequired(false);
        await secureStorage.removeItem('cofre_user');
      }

      setLoading(false);
    });

    // Força logout ao inicializar para começar no login
    authService.logout().catch(() => {});

    return unsub;
  }, []); // listener registrado uma única vez

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setAuthError(null);
    try {
      const firebaseUser = await authService.login(email, password);
      // Verifica se ESTE usuário tem TOTP ativo
      const hasTOTP = await totpStorage.isEnabled(firebaseUser.uid); // Passa o UID

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
      await secureStorage.setItem('cofre_user', JSON.stringify(u));
      return { success: true };

    } catch (e: any) {
      const msg = authService.getErrorMessage(e.code);
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const confirmTOTP = async (code: string): Promise<{ success: boolean; error?: string }> => {
    debugLogger.log('confirmTOTP chamado', { pendingUserUid: pendingUser?.uid, codeLength: code?.length });
    
    if (!pendingUser) {
      debugLogger.log('confirmTOTP: sem pendingUser');
      return { success: false, error: 'Sessão expirada. Faça login novamente.' };
    }

    if (!/^\d{6}$/.test(code)) {
      debugLogger.log('confirmTOTP: código não é 6 dígitos', { code });
      return { success: false, error: 'Digite exatamente 6 dígitos.' };
    }

    debugLogger.log('Carregando secret para validação');
    const secret = await totpStorage.load(pendingUser.uid);

    if (!secret || secret.trim().length === 0) {
      debugLogger.log('confirmTOTP: secret não encontrada ou vazia', { uid: pendingUser.uid });
      return { success: false, error: 'Chave de segurança não encontrada neste dispositivo. O login foi bloqueado por segurança.' };
    }

    debugLogger.log('Validando código contra secret', { uid: pendingUser.uid, codeReceived: code });
    const valid = verifyCode(code, secret);
    
    if (!valid) {
      debugLogger.log('confirmTOTP: código inválido', { code });
      return { success: false, error: 'Código inválido ou expirado. Verifique o Google Authenticator.' };
    }

    debugLogger.log('confirmTOTP: código válido! Login bem-sucedido');
    const u: AuthUser = { ...pendingUser };
    setUser(u);
    await secureStorage.setItem('cofre_user', JSON.stringify(u));
    setTotpRequired(false);
    setPendingUser(null);
    return { success: true };
  };

  const cancelTOTPLogin = async () => {
    await authService.logout(); // limpa sessão do Firebase também
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
      await secureStorage.setItem('cofre_user', JSON.stringify(u));
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
