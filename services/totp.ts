import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateSync,
  generateURI,
  generateSecret as otpGenerateSecret,
  verifySync,
} from 'otplib';
import { debugLogger } from './debugLogger';

const STORAGE_KEY = '@cofre_totp_secret';

const TOTP_OPTS = {
  strategy: 'totp' as const,
  period: 30,
  digits: 6,
  algorithm: 'sha1' as const,
};

export function generateSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

export function buildOtpAuthUri(params: {
  secret: string;
  userEmail: string;
  issuer?: string;
}): string {
  const { secret, userEmail, issuer = 'CofreDigital' } = params;
  debugLogger.log('Nova secret gerada para 2FA', { secret, email: userEmail });
  return generateURI({
    ...TOTP_OPTS,
    issuer,
    label: userEmail,
    secret,
  });
}

export function verifyCode(token: string, secret: string): boolean {
  debugLogger.log('verifyCode chamado', { tokenLength: token?.length, secretLength: secret?.length });
  
  if (!token || !secret) {
    debugLogger.log('verifyCode: token ou secret vazios', { token: token ? 'tem' : 'vazio', secret: secret ? 'tem' : 'vazio' });
    return false;
  }
  
  try {
    const currentCode = generateSync({ ...TOTP_OPTS, secret });
    debugLogger.log('Código gerado pelo Google Authenticator', { currentCode, receivedCode: token, match: currentCode === token });
    
    const result = verifySync({
      ...TOTP_OPTS,
      token,
      secret,
      // Tolera 1 janela de diferença para compensar diferença de relógio
      epochTolerance: 1,
    });
    
    debugLogger.log('Resultado do verifySync', { result, resultType: typeof result, hasValid: result && 'valid' in result, hasIsValid: result && 'isValid' in result });
    
    // otplib v13: verifySync retorna { valid: boolean } ou null
    if (result === null) {
      debugLogger.log('verifySync retornou null');
      return false;
    }
    
    if (typeof result === 'object') {
      // Tenta propriedade 'valid' (otplib v13)
      if ('valid' in result) {
        const isValid = (result as { valid: boolean }).valid;
        debugLogger.log('verifyCode resultado final (valid)', { isValid });
        return isValid;
      }
      // Tenta propriedade 'isValid' (fallback)
      if ('isValid' in result) {
        const isValid = (result as { isValid: boolean }).isValid;
        debugLogger.log('verifyCode resultado final (isValid)', { isValid });
        return isValid;
      }
    }
    
    // Se for boolean direto, retorna
    if (typeof result === 'boolean') {
      debugLogger.log('verifyCode resultado (boolean direto)', result);
      return result;
    }
    
    debugLogger.log('verifyCode: resultado desconhecido', result);
    return false;  // Qualquer outra coisa, nega
  } catch (err) {
    debugLogger.log('Erro em verifyCode', err);
    return false;
  }
}

export function generateCurrentCode(secret: string): string {
  return generateSync({ ...TOTP_OPTS, secret });
}

export const totpStorage = {
  async save(uid: string, secret: string): Promise<void> {
    if (!uid) throw new Error('UID é obrigatório para salvar o TOTP');
    const key = `${STORAGE_KEY}_${uid}`;
    debugLogger.log('Salvando secret em AsyncStorage', { uid, key, secretLength: secret?.length });
    await AsyncStorage.setItem(key, secret);
    debugLogger.log('Secret salva com sucesso', { uid });
  },
  
  async load(uid: string): Promise<string | null> {
    if (!uid) {
      debugLogger.log('load: UID vazio');
      return null;
    }
    const key = `${STORAGE_KEY}_${uid}`;
    debugLogger.log('Carregando secret do AsyncStorage', { uid, key });
    const secret = await AsyncStorage.getItem(key);
    debugLogger.log('Secret carregada', { uid, isNull: secret === null, length: secret?.length });
    return secret;
  },
  
  async remove(uid: string): Promise<void> {
    if (!uid) return;
    const key = `${STORAGE_KEY}_${uid}`;
    debugLogger.log('Removendo secret do AsyncStorage', { uid, key });
    await AsyncStorage.removeItem(key);
    debugLogger.log('Secret removida com sucesso', { uid });
  },
  
  async isEnabled(uid: string): Promise<boolean> {
    if (!uid) {
      debugLogger.log('isEnabled: UID vazio');
      return false;
    }
    const key = `${STORAGE_KEY}_${uid}`;
    const s = await AsyncStorage.getItem(key);
    const enabled = s !== null && s.length > 0;
    debugLogger.log('Verificando se TOTP está ativo', { uid, enabled });
    return enabled;
  },
};
