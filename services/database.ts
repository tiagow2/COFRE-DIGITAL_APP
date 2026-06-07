import * as SQLite from 'expo-sqlite';
import { debugLogger } from './debugLogger';

export interface Database {
  transaction: (callback: (tx: SQLite.SQLiteDatabase) => Promise<void>) => Promise<void>;
  execAsync: (sql: string, params?: any[]) => Promise<any>;
  getAllAsync: (sql: string, params?: any[]) => Promise<any[]>;
  getFirstAsync: (sql: string, params?: any[]) => Promise<any | null>;
  runAsync: (sql: string, params?: any[]) => Promise<any>;
}

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<Database> | null = null;

function sanitizeParam(value: unknown): string | number | boolean | null | Uint8Array {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sanitizeParams(params?: unknown[]) {
  return (params ?? []).map(sanitizeParam);
}

export async function initializeDatabase(): Promise<Database> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (!db) {
        debugLogger.log('Inicializando SQLite', {});
        db = await SQLite.openDatabaseAsync('cofre_digital.db');
        debugLogger.log('Database conectado, criando tabelas...', {});
        await createTables(db);
        debugLogger.log('SQLite inicializado com sucesso', {});
      } else {
        debugLogger.log('SQLite já estava inicializado', {});
      }
      return wrapDatabase(db!);
    } catch (error) {
      db = null;
      initPromise = null;
      debugLogger.log('Erro ao inicializar SQLite', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  })();

  return initPromise;
}

async function createTables(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      icon TEXT NOT NULL,
      date TEXT NOT NULL,
      paymentMethod TEXT DEFAULT 'balance',
      creditCardId TEXT,
      creditCardName TEXT,
      signatureRequired BOOLEAN DEFAULT 0,
      signatureApproved BOOLEAN DEFAULT 0,
      signatureScore REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      category TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      period TEXT NOT NULL,
      color TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      current REAL NOT NULL,
      monthly REAL NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS creditCards (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      lastDigits TEXT NOT NULL,
      limit_amount REAL NOT NULL,
      used REAL NOT NULL,
      dueDate TEXT NOT NULL,
      color TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      total REAL NOT NULL,
      paid REAL NOT NULL,
      installments INTEGER NOT NULL,
      current INTEGER NOT NULL,
      rate REAL NOT NULL,
      monthly REAL NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS syncQueue (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS regionalAverages (
      id TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      category TEXT NOT NULL,
      avgExpense REAL NOT NULL,
      userCount INTEGER NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS monitored_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id TEXT UNIQUE,
      name TEXT,
      lat REAL,
      lng REAL,
      bill_category TEXT,
      active INTEGER DEFAULT 1,
      last_notified_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      medalIcon TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      synced BOOLEAN DEFAULT 0,
      syncedAt TEXT
    );
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_budgets_userId ON budgets(userId);
    CREATE INDEX IF NOT EXISTS idx_goals_userId ON goals(userId);
    CREATE INDEX IF NOT EXISTS idx_creditCards_userId ON creditCards(userId);
    CREATE INDEX IF NOT EXISTS idx_loans_userId ON loans(userId);
    CREATE INDEX IF NOT EXISTS idx_syncQueue_synced ON syncQueue(synced);
    CREATE INDEX IF NOT EXISTS idx_challenges_userId ON challenges(userId);
    CREATE INDEX IF NOT EXISTS idx_monitored_locations_active ON monitored_locations(active);
  `);

  await runMigrations(database);

  debugLogger.log('Tabelas do SQLite criadas', {});
}

async function getColumnNames(database: SQLite.SQLiteDatabase, table: string): Promise<string[]> {
  const rows = await database.getAllAsync(`PRAGMA table_info(${table})`);
  return rows.map((row: any) => row.name);
}

async function ensureColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
) {
  const columns = await getColumnNames(database, table);
  if (!columns.includes(column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function copyColumnIfAvailable(
  database: SQLite.SQLiteDatabase,
  table: string,
  fromColumn: string,
  toColumn: string
) {
  const columns = await getColumnNames(database, table);
  if (!columns.includes(fromColumn) || !columns.includes(toColumn)) return;

  await database.execAsync(`
    UPDATE ${table}
    SET "${toColumn}" = "${fromColumn}"
    WHERE "${fromColumn}" IS NOT NULL
      AND ("${toColumn}" IS NULL OR "${toColumn}" = 0 OR "${toColumn}" = '');
  `);
}

async function runMigrations(database: SQLite.SQLiteDatabase) {
  await ensureColumn(database, 'transactions', 'receiptPhoto', 'TEXT');
  await ensureColumn(database, 'transactions', 'signature', 'TEXT');
  await ensureColumn(database, 'transactions', 'paymentMethod', "TEXT DEFAULT 'balance'");
  await ensureColumn(database, 'transactions', 'creditCardId', 'TEXT');
  await ensureColumn(database, 'transactions', 'creditCardName', 'TEXT');
  await ensureColumn(database, 'transactions', 'signatureRequired', 'BOOLEAN DEFAULT 0');
  await ensureColumn(database, 'transactions', 'signatureApproved', 'BOOLEAN DEFAULT 0');
  await ensureColumn(database, 'transactions', 'signatureScore', 'REAL DEFAULT 0');
  await ensureColumn(database, 'transactions', 'createdAt', "TEXT DEFAULT ''");
  await ensureColumn(database, 'transactions', 'updatedAt', "TEXT DEFAULT ''");
  await ensureColumn(database, 'transactions', 'synced', 'BOOLEAN DEFAULT 0');
  await ensureColumn(database, 'transactions', 'syncedAt', 'TEXT');

  await ensureColumn(database, 'creditCards', 'userId', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'name', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'lastDigits', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'limit_amount', 'REAL DEFAULT 0');
  await ensureColumn(database, 'creditCards', 'used', 'REAL DEFAULT 0');
  await ensureColumn(database, 'creditCards', 'dueDate', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'color', "TEXT DEFAULT '#1565C0'");
  await ensureColumn(database, 'creditCards', 'createdAt', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'updatedAt', "TEXT DEFAULT ''");
  await ensureColumn(database, 'creditCards', 'synced', 'BOOLEAN DEFAULT 0');
  await ensureColumn(database, 'creditCards', 'syncedAt', 'TEXT');
  await copyColumnIfAvailable(database, 'creditCards', 'limit', 'limit_amount');
  await copyColumnIfAvailable(database, 'creditCards', 'limitAmount', 'limit_amount');

  await ensureColumn(database, 'syncQueue', 'userId', "TEXT DEFAULT ''");
  await ensureColumn(database, 'syncQueue', 'action', "TEXT DEFAULT ''");
  await ensureColumn(database, 'syncQueue', 'table_name', "TEXT DEFAULT ''");
  await ensureColumn(database, 'syncQueue', 'record_id', "TEXT DEFAULT ''");
  await ensureColumn(database, 'syncQueue', 'payload', "TEXT DEFAULT '{}'");
  await ensureColumn(database, 'syncQueue', 'createdAt', "TEXT DEFAULT ''");
  await ensureColumn(database, 'syncQueue', 'synced', 'BOOLEAN DEFAULT 0');

  await ensureColumn(database, 'monitored_locations', 'place_id', 'TEXT');
  await ensureColumn(database, 'monitored_locations', 'name', 'TEXT');
  await ensureColumn(database, 'monitored_locations', 'lat', 'REAL DEFAULT 0');
  await ensureColumn(database, 'monitored_locations', 'lng', 'REAL DEFAULT 0');
  await ensureColumn(database, 'monitored_locations', 'bill_category', 'TEXT');
  await ensureColumn(database, 'monitored_locations', 'active', 'INTEGER DEFAULT 1');
  await ensureColumn(database, 'monitored_locations', 'last_notified_at', 'TEXT');
  await ensureColumn(database, 'monitored_locations', 'created_at', "TEXT DEFAULT ''");

  await ensureColumn(database, 'loans', 'user_id', "TEXT DEFAULT 'unknown'");
  await ensureColumn(database, 'loans', 'total_amount', "REAL DEFAULT 0");
  await ensureColumn(database, 'loans', 'paid_installments', "INTEGER DEFAULT 0");
  await ensureColumn(database, 'loans', 'installment_value', "REAL DEFAULT 0");
  await ensureColumn(database, 'loans', 'created_at', "TEXT DEFAULT CURRENT_TIMESTAMP");

  await copyColumnIfAvailable(database, 'loans', 'userId', 'user_id');
  await copyColumnIfAvailable(database, 'loans', 'total', 'total_amount');
  await copyColumnIfAvailable(database, 'loans', 'current', 'paid_installments');
  await copyColumnIfAvailable(database, 'loans', 'monthly', 'installment_value');
}

function wrapDatabase(database: SQLite.SQLiteDatabase): Database {
  return {
    transaction: async (callback: (tx: SQLite.SQLiteDatabase) => Promise<void>) => {
      try {
        await database.execAsync('BEGIN TRANSACTION');
        await callback(database);
        await database.execAsync('COMMIT');
      } catch (error) {
        await database.execAsync('ROLLBACK');
        throw error;
      }
    },

    execAsync: async (sql: string, params?: any[]) => {
      try {
        const safeParams = sanitizeParams(params);
        if (safeParams.length > 0) {
          await (database.runAsync as any)(sql, safeParams);
        } else {
          await database.execAsync(sql);
        }
      } catch (error) {
        debugLogger.log('Erro ao executar SQL', { sql, error: (error as Error).message });
        throw error;
      }
    },

    getAllAsync: async (sql: string, params?: any[]) => {
      try {
        const safeParams = sanitizeParams(params);
        return safeParams.length > 0
          ? await (database.getAllAsync as any)(sql, safeParams)
          : await database.getAllAsync(sql);
      } catch (error) {
        debugLogger.log('Erro ao buscar todos', { sql, error: (error as Error).message });
        throw error;
      }
    },

    getFirstAsync: async (sql: string, params?: any[]) => {
      try {
        const safeParams = sanitizeParams(params);
        const result = safeParams.length > 0
          ? await (database.getAllAsync as any)(sql, safeParams)
          : await database.getAllAsync(sql);
        return result.length > 0 ? result[0] : null;
      } catch (error) {
        debugLogger.log('Erro ao buscar primeiro', { sql, error: (error as Error).message });
        throw error;
      }
    },

    runAsync: async (sql: string, params?: any[]) => {
      try {
        const safeParams = sanitizeParams(params);
        return safeParams.length > 0
          ? await (database.runAsync as any)(sql, safeParams)
          : await database.runAsync(sql);
      } catch (error) {
        debugLogger.log('Erro ao executar comando', { sql, error: (error as Error).message });
        throw error;
      }
    },
  };
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return wrapDatabase(db);
}
