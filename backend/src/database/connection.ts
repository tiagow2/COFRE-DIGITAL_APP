import * as dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        firebase_uid VARCHAR(255) UNIQUE NOT NULL,
        city VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        date TIMESTAMP NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'balance',
        credit_card_id VARCHAR(255),
        credit_card_name VARCHAR(100),
        signature_required BOOLEAN DEFAULT false,
        signature_approved BOOLEAN DEFAULT false,
        signature_score DECIMAL(5, 3) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        limit_amount DECIMAL(10, 2) NOT NULL,
        period VARCHAR(50) NOT NULL,
        color VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS goals (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        target DECIMAL(10, 2) NOT NULL,
        current DECIMAL(10, 2) NOT NULL,
        monthly DECIMAL(10, 2),
        icon VARCHAR(50),
        color VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_cards (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        last_digits VARCHAR(4) NOT NULL,
        limit_amount DECIMAL(10, 2) NOT NULL,
        used DECIMAL(10, 2) NOT NULL,
        due_date VARCHAR(20),
        color VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loans (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        paid DECIMAL(10, 2) NOT NULL,
        installments INTEGER NOT NULL,
        current INTEGER NOT NULL,
        rate DECIMAL(5, 2),
        monthly DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sync_logs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        record_id VARCHAR(255),
        status VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS regional_averages (
        id UUID PRIMARY KEY,
        city VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        avg_expense DECIMAL(10, 2) NOT NULL,
        user_count INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(city, category)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
      CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
      CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_regional_avg_city_category ON regional_averages(city, category);
    `);

    // Migrations — adicionar colunas se não existirem
    const migrations = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(10, 2) DEFAULT 0`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'balance'`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_id VARCHAR(255)`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_name VARCHAR(100)`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS signature_required BOOLEAN DEFAULT false`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS signature_approved BOOLEAN DEFAULT false`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS signature_score DECIMAL(5, 3) DEFAULT 0`,
    ];
    for (const migration of migrations) {
      try {
        await query(migration);
      } catch (err: any) {
        if (err.code !== '42701') throw err; // 42701 = column already exists
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database', error);
    throw error;
  }
}

export async function closePool() {
  await pool.end();
}
