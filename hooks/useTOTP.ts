// hooks/useTOTP.ts
import { useState, useCallback } from 'react';
import {
  generateSecret,
  buildOtpAuthUri,
  verifyCode,
  totpStorage,
} from '@/services/totp';

type SetupStep = 'idle' | 'qrcode' | 'verify' | 'done';

interface UseTOTPReturn {
  // Estado
  step: SetupStep;
  secret: string | null;
  otpUri: string | null;
  loading: boolean;
  error: string | null;
  totpEnabled: boolean;

  // Ações de setup (tela de configurações)
  startSetup: (userEmail: string) => void;
  confirmSetup: (code: string) => Promise<boolean>;
  cancelSetup: () => void;
  disableTOTP: () => Promise<void>;

  // Ação de login
  validateLogin: (code: string) => Promise<boolean>;

  // Utilitários
  checkIfEnabled: () => Promise<void>;
  clearError: () => void;
}

export function useTOTP(): UseTOTPReturn {
  const [step, setStep]           = useState<SetupStep>('idle');
  const [secret, setSecret]       = useState<string | null>(null);
  const [otpUri, setOtpUri]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  // ─── Verificar se TOTP já está ativo ─────────────────────────────────────
  const checkIfEnabled = useCallback(async () => {
    const enabled = await totpStorage.isEnabled();
    setTotpEnabled(enabled);
  }, []);

  // ─── Iniciar setup: gera secret e QR code ────────────────────────────────
  const startSetup = useCallback((userEmail: string) => {
    const newSecret = generateSecret();
    const uri = buildOtpAuthUri({ secret: newSecret, userEmail });
    setSecret(newSecret);
    setOtpUri(uri);
    setStep('qrcode');
    setError(null);
  }, []);

  // ─── Confirmar setup: valida o código digitado e salva ───────────────────
  const confirmSetup = useCallback(async (code: string): Promise<boolean> => {
    if (!secret) {
      setError('Sessão expirada. Tente novamente.');
      return false;
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Digite exatamente 6 dígitos.');
      return false;
    }

    setLoading(true);
    setError(null);

    // Pequeno delay para dar feedback visual ao usuário
    await new Promise(r => setTimeout(r, 400));

    const valid = verifyCode(code, secret);
    if (!valid) {
      setError('Código inválido. Verifique o Google Authenticator e tente novamente.');
      setLoading(false);
      return false;
    }

    await totpStorage.save(secret);
    setTotpEnabled(true);
    setStep('done');
    setLoading(false);
    return true;
  }, [secret]);

  // ─── Cancelar setup ───────────────────────────────────────────────────────
  const cancelSetup = useCallback(() => {
    setStep('idle');
    setSecret(null);
    setOtpUri(null);
    setError(null);
  }, []);

  // ─── Desativar TOTP ───────────────────────────────────────────────────────
  const disableTOTP = useCallback(async () => {
    setLoading(true);
    await totpStorage.remove();
    setTotpEnabled(false);
    setStep('idle');
    setSecret(null);
    setOtpUri(null);
    setLoading(false);
  }, []);

  // ─── Validar código no login ──────────────────────────────────────────────
  const validateLogin = useCallback(async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const savedSecret = await totpStorage.load();
    if (!savedSecret) {
      // TOTP não configurado; deixa passar (segurança progressiva)
      setLoading(false);
      return true;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Digite exatamente 6 dígitos.');
      setLoading(false);
      return false;
    }

    await new Promise(r => setTimeout(r, 300));
    const valid = verifyCode(code, savedSecret);

    if (!valid) {
      setError('Código inválido ou expirado. Tente o próximo código.');
    }

    setLoading(false);
    return valid;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    step,
    secret,
    otpUri,
    loading,
    error,
    totpEnabled,
    startSetup,
    confirmSetup,
    cancelSetup,
    disableTOTP,
    validateLogin,
    checkIfEnabled,
    clearError,
  };
}
