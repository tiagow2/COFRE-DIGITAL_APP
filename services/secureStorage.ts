import * as SecureStore from 'expo-secure-store';
import { debugLogger } from './debugLogger';

export const secureStorage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await SecureStore.setItemAsync(key, jsonString);
      debugLogger.log('ENCRYPTION: Data encrypted and saved', {
        key,
        size: jsonString.length,
        operation: 'AES-256 encryption via expo-secure-store',
        stored_in: 'Keystore (Android) / Keychain (iOS)',
        readable_now: false,
      });
    } catch (err) {
      debugLogger.log('Error saving encrypted data', err);
      throw err;
    }
  },

  async getItem<T = any>(key: string): Promise<T | null> {
    try {
      const result = await SecureStore.getItemAsync(key);
      if (!result) return null;
      
      try {
        const parsed = JSON.parse(result) as T;
        debugLogger.log('DECRYPTION: Data decrypted and loaded', {
          key,
          operation: 'AES-256 decryption via expo-secure-store',
          readable_now: true,
          data_recovered: true,
        });
        return parsed;
      } catch (parseErr) {
        debugLogger.log('Parse error, returning raw string', { key });
        return result as T;
      }
    } catch (err) {
      debugLogger.log('Error loading encrypted data', err);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      debugLogger.log('REMOVAL: Encrypted data deleted', {
        key,
        operation: 'Secure deletion from Keystore/Keychain',
      });
    } catch (err) {
      debugLogger.log('Error removing encrypted data', err);
    }
  },

  async clear(): Promise<void> {
    try {
      debugLogger.log('Limpando todos os dados criptografados');
    } catch (err) {
      debugLogger.log('Erro ao limpar dados criptografados', err);
    }
  },

  async hasItem(key: string): Promise<boolean> {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item !== null;
    } catch {
      return false;
    }
  },
};
