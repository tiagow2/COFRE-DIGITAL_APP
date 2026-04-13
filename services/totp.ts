// services/totp.ts
// Compatible with otplib v13 (functional API — pure functions, no class instances)
// Requires: npx expo install react-native-get-random-values
// Add at the top of root _layout.tsx: import 'react-native-get-random-values';

import {
  generateSecret as otpGenerateSecret,
  generateSync,
  verifySync,
  generateURI,
} from 'otplib';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Chave de armazenamento ───────────────────────────────────────────────────
const STORAGE_KEY = '@cofre_totp_secret';

// ─── Configurações padrão TOTP ────────────────────────────────────────────────
// otplib v13 usa API funcional — as opções são passadas diretamente em cada chamada.
// NÃO existe mais authenticator.options = {...}; aqui.
const TOTP_OPTS = {
  strategy: 'totp' as const,
  period: 30,        // janela de 30 segundos (padrão Google Authenticator)
  digits: 6,
  algorithm: 'sha1' as const,
};

// ─── Gerar nova secret ────────────────────────────────────────────────────────
export function generateSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

// ─── Montar URI para o QR Code ────────────────────────────────────────────────
export function buildOtpAuthUri(params: {
  secret: string;
  userEmail: string;
  issuer?: string;
}): string {
  const { secret, userEmail, issuer = 'CofreDigital' } = params;
  return generateURI({
    ...TOTP_OPTS,
    issuer,
    label: userEmail,
    secret,
  });
}

// ─── Validar código de 6 dígitos ─────────────────────────────────────────────
export function verifyCode(token: string, secret: string): boolean {
  try {
    const result = verifySync({
      ...TOTP_OPTS,
      token,
      secret,
      // Tolera 1 janela de diferença para compensar diferença de relógio
      epochTolerance: 1,
    });
    // otplib v13: verifySync retorna VerifyResult { isValid, ... }
    if (result !== null && typeof result === 'object' && 'isValid' in result) {
      return (result as { isValid: boolean }).isValid;
    }
    return Boolean(result);
  } catch {
    return false;
  }
}

// ─── Gerar código atual (útil para testes) ────────────────────────────────────
export function generateCurrentCode(secret: string): string {
  return generateSync({ ...TOTP_OPTS, secret });
}

// ─── Persistência local ───────────────────────────────────────────────────────
export const totpStorage = {
  async save(secret: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, secret);
  },
  async load(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEY);
  },
  async remove(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
  async isEnabled(): Promise<boolean> {
    const s = await AsyncStorage.getItem(STORAGE_KEY);
    return s !== null && s.length > 0;
  },
};
