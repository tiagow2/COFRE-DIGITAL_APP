import { buildOtpAuthUri, generateSecret, totpStorage, verifyCode } from '@/services/totp';
import { useCallback, useState } from 'react';

type SetupStep = 'idle' | 'qrcode' | 'verify' | 'done';

interface UseTOTPReturn {
  step: SetupStep;
  secret: string | null;
  otpUri: string | null;
  loading: boolean;
  error: string | null;
  totpEnabled: boolean;
  startSetup: (userEmail: string) => void;
  confirmSetup: (code: string, uid: string) => Promise<boolean>;
  cancelSetup: () => void;
  disableTOTP: (uid: string) => Promise<void>;
  validateLogin: (code: string, uid: string) => Promise<boolean>;
  checkIfEnabled: (uid: string) => Promise<void>;
  clearError: () => void;
}

export function useTOTP(): UseTOTPReturn {
  const [step, setStep]               = useState<SetupStep>('idle');
  const [secret, setSecret]           = useState<string | null>(null);
  const [otpUri, setOtpUri]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  const checkIfEnabled = useCallback(async (uid: string) => {
    if (!uid) return;
    const enabled = await totpStorage.isEnabled(uid);
    setTotpEnabled(enabled);
  }, []);

  const startSetup = useCallback((userEmail: string) => {
    const newSecret = generateSecret();
    const uri = buildOtpAuthUri({ secret: newSecret, userEmail });
    setSecret(newSecret);
    setOtpUri(uri);
    setStep('qrcode');
    setError(null);
  }, []);

  const confirmSetup = useCallback(async (code: string, uid: string): Promise<boolean> => {
    if (!secret || !uid) { setError('Sessão expirada. Tente novamente.'); return false; }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) { setError('Digite exatamente 6 dígitos.'); return false; }

    setLoading(true);
    setError(null);
    await new Promise(r => setTimeout(r, 400));

    const valid = verifyCode(code, secret);
    if (!valid) {
      setError('Código inválido. Verifique o Google Authenticator e tente novamente.');
      setLoading(false);
      return false;
    }

    await totpStorage.save(uid, secret);
    setTotpEnabled(true);
    setStep('done');
    setLoading(false);
    return true;
  }, [secret]);

  const cancelSetup = useCallback(() => {
    setStep('idle');
    setSecret(null);
    setOtpUri(null);
    setError(null);
  }, []);

  const disableTOTP = useCallback(async (uid: string) => {
    if (!uid) return;
    setLoading(true);
    await totpStorage.remove(uid);
    setTotpEnabled(false);
    setStep('idle');
    setSecret(null);
    setOtpUri(null);
    setLoading(false);
  }, []);

  const validateLogin = useCallback(async (code: string, uid: string): Promise<boolean> => {
    if (!uid) return false;
    setLoading(true);
    setError(null);

    const savedSecret = await totpStorage.load(uid);
    if (!savedSecret) {
      setError('Erro de configuração 2FA. Chave não encontrada.');
      setLoading(false);
      return false;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Digite exatamente 6 dígitos.');
      setLoading(false);
      return false;
    }

    await new Promise(r => setTimeout(r, 300));
    const valid = verifyCode(code, savedSecret);
    if (!valid) setError('Código inválido ou expirado. Tente o próximo código.');

    setLoading(false);
    return valid;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    step, secret, otpUri, loading, error, totpEnabled,
    startSetup, confirmSetup, cancelSetup, disableTOTP,
    validateLogin, checkIfEnabled, clearError,
  };
}
