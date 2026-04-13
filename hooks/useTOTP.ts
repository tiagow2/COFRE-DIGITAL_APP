import { debugLogger } from '@/services/debugLogger';
import {
  buildOtpAuthUri,
  generateSecret,
  totpStorage,
  verifyCode,
} from '@/services/totp';
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
  const [step, setStep]           = useState<SetupStep>('idle');
  const [secret, setSecret]       = useState<string | null>(null);
  const [otpUri, setOtpUri]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
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
    if (!secret || !uid) {
      debugLogger.log('confirmSetup: secret ou uid vazios', { hasSecret: !!secret, hasUid: !!uid });
      setError('Sessão expirada. Tente novamente.');
      return false;
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      debugLogger.log('confirmSetup: código inválido', { code, length: code.length });
      setError('Digite exatamente 6 dígitos.');
      return false;
    }

    debugLogger.log('confirmSetup: secret sendo usada para validação', { 
      secretTruncated: secret.slice(0, 5) + '...' + secret.slice(-5),
      secretLength: secret.length,
      code,
      uid 
    });

    setLoading(true);
    setError(null);

    await new Promise(r => setTimeout(r, 400));

    const valid = verifyCode(code, secret);
    debugLogger.log('Resultado de confirmSetup', { valid, code });
    if (!valid) {
      setError('Código inválido. Verifique o Google Authenticator e tente novamente.');
      setLoading(false);
      return false;
    }

    debugLogger.log('confirmSetup: código válido! Salvando secret...');
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
    if (!uid) {
      debugLogger.log('validateLogin: uid vazio');
      return false;
    }
    setLoading(true);
    setError(null);

    debugLogger.log('validateLogin: carregando secret do armazenamento', { uid });
    const savedSecret = await totpStorage.load(uid);
    
    if (!savedSecret) {
      debugLogger.log('validateLogin: secret não encontrada no armazenamento', { uid });
      setError('Erro de configuração 2FA. Chave não encontrada.');
      setLoading(false);
      return false;
    }

    debugLogger.log('validateLogin: secret carregada', { secretTruncated: savedSecret.slice(0, 5) + '...' + savedSecret.slice(-5), secretLength: savedSecret.length });

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      debugLogger.log('validateLogin: código inválido', { code, length: code.length });
      setError('Digite exatamente 6 dígitos.');
      setLoading(false);
      return false;
    }

    await new Promise(r => setTimeout(r, 300));
    const valid = verifyCode(code, savedSecret);
    debugLogger.log('validateLogin: resultado', { valid, code });
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
