import { debugLogger } from './debugLogger';
import { FinanceRepository } from './repository';

interface SyncConfig {
  apiUrl: string;
  userId: string;
  syncImages?: boolean;
}

export class SyncService {
  private repository: FinanceRepository;
  private config: SyncConfig;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = true;

  constructor(config: SyncConfig, repository: FinanceRepository) {
    this.config = config;
    this.repository = repository;
  }

  async startAutoSync(): Promise<void> {
    debugLogger.log('AutoSync iniciado', { interval: '30s' });
    this.syncInterval = setInterval(async () => {
      if (!this.isOnline) {
        debugLogger.log('AutoSync: Offline mode, fila armazenada localmente', {});
        return;
      }

      try {
        await this.syncPendingChanges();
      } catch (error) {
        debugLogger.log('Erro ao sincronizar dados', { error: (error as Error).message });
      }
    }, 30000); // 30 segundos
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      debugLogger.log('AutoSync parado', {});
    }
  }

  setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      debugLogger.log('Status de conectividade alterado', { isOnline });
      if (isOnline) {
        this.syncPendingChanges().catch((error) => {
          debugLogger.log('Erro ao sincronizar dados ao voltar online', { error: (error as Error).message });
        });
      }
    }
  }

  async syncPendingChanges(): Promise<void> {
    try {
      const queue = await this.repository.getSyncQueue();

      if (queue.length === 0) {
        debugLogger.log('Nada para sincronizar', {});
        return;
      }

      debugLogger.log('Iniciando sincronização', { itemCount: queue.length });

      const syncedIds: string[] = [];

      for (const item of queue) {
        try {
          const success = await this.sendToServer(item);
          if (success) {
            syncedIds.push(item.id);
          }
        } catch (error) {
          debugLogger.log('Falha ao sincronizar item individual', {
            itemId: item.id,
            error: (error as Error).message,
          });
        }
      }

      if (syncedIds.length > 0) {
        await this.repository.markAsSynced(syncedIds);
        debugLogger.log('Sincronização concluída', { syncedCount: syncedIds.length, totalCount: queue.length });
      }
    } catch (error) {
      debugLogger.log('Erro crítico ao sincronizar', { error: (error as Error).message });
      throw error;
    }
  }

  private async sendToServer(item: any): Promise<boolean> {
    try {
      const payload = {
        action: item.action,
        table: item.table_name,
        recordId: item.record_id,
        data: JSON.parse(item.payload),
        syncImages: this.config.syncImages || false,
      };

      const response = await fetch(`${this.config.apiUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': this.config.userId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      debugLogger.log('Item sincronizado com sucesso', { recordId: item.record_id });
      return true;
    } catch (error) {
      debugLogger.log('Erro ao enviar para servidor', {
        recordId: item.record_id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async fetchRegionalAverages(city: string, category: string): Promise<void> {
    try {
      if (!this.isOnline) {
        debugLogger.log('Offline: usando dados regionais em cache', { city, category });
        return;
      }

      const response = await fetch(
        `${this.config.apiUrl}/api/regional-averages?city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`,
        {
          headers: {
            'X-User-ID': this.config.userId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      await this.repository.updateRegionalAverages(
        city,
        category,
        data.avgExpense,
        data.userCount
      );

      debugLogger.log('Médias regionais atualizadas', { city, category, avgExpense: data.avgExpense });
    } catch (error) {
      debugLogger.log('Erro ao buscar médias regionais', {
        city,
        category,
        error: (error as Error).message,
      });
    }
  }

  async getSyncStatus(): Promise<{ pendingCount: number; isOnline: boolean }> {
    const queue = await this.repository.getSyncQueue();
    return {
      pendingCount: queue.length,
      isOnline: this.isOnline,
    };
  }
}


let syncService: SyncService | null = null;

export function initializeSyncService(config: SyncConfig, repository: FinanceRepository): SyncService {
  syncService = new SyncService(config, repository);
  return syncService;
}

export function getSyncService(): SyncService {
  if (!syncService) {
    throw new Error('SyncService not initialized');
  }
  return syncService;
}
