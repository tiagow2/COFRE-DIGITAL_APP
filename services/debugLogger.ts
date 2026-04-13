import AsyncStorage from '@react-native-async-storage/async-storage';

const DEBUG_LOGS_KEY = '@cofre_debug_logs';
const MAX_LOGS = 100;

interface DebugLog {
  timestamp: string;
  label: string;
  data: any;
}

export const debugLogger = {
  async log(label: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const message = `[${timestamp}] ${label}`;
    
    // Log no console para desenvolvimento
    console.log(message, data || '');

    // Salva em AsyncStorage para visualizar depois
    try {
      const existing = await AsyncStorage.getItem(DEBUG_LOGS_KEY);
      const logs: DebugLog[] = existing ? JSON.parse(existing) : [];
      
      logs.push({ timestamp, label, data });
      
      // Mantém apenas os últimos MAX_LOGS
      if (logs.length > MAX_LOGS) {
        logs.shift();
      }
      
      await AsyncStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(logs));
    } catch (err) {
      console.error('Erro ao salvar debug log:', err);
    }
  },

  async getLogs(): Promise<DebugLog[]> {
    try {
      const existing = await AsyncStorage.getItem(DEBUG_LOGS_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  },

  async clearLogs() {
    try {
      await AsyncStorage.removeItem(DEBUG_LOGS_KEY);
    } catch (err) {
      console.error('Erro ao limpar debug logs:', err);
    }
  },
};
