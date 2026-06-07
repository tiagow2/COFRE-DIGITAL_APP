import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';

export interface SyncPayload {
  action: 'create' | 'update' | 'delete';
  table: string;
  recordId: string;
  data: any;
  syncImages?: boolean;
}

export class SyncService {
  private async resolveUserId(firebaseUid: string): Promise<string> {
    const existing = await query(
      `SELECT id FROM users WHERE firebase_uid = $1 OR id::text = $1 LIMIT 1`,
      [firebaseUid]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const id = uuidv4();
    const email = `${firebaseUid}@local.cofre.invalid`;
    const created = await query(
      `INSERT INTO users (id, email, firebase_uid, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (firebase_uid) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [id, email, firebaseUid]
    );

    return created.rows[0].id;
  }

  async processSyncRequest(userId: string, payload: SyncPayload): Promise<{ success: boolean; message?: string }> {
    try {
      const { action, table, recordId, data } = payload;
      const dbUserId = await this.resolveUserId(userId);

      const logId = uuidv4();
      await query(
        `INSERT INTO sync_logs (id, user_id, action, table_name, record_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [logId, dbUserId, action, table, recordId, 'processing']
      );

      switch (action) {
        case 'create':
          await this.handleCreate(dbUserId, table, data);
          break;
        case 'update':
          await this.handleUpdate(dbUserId, table, recordId, data);
          break;
        case 'delete':
          await this.handleDelete(dbUserId, table, recordId);
          break;
      }

      await query(
        `UPDATE sync_logs SET status = $1 WHERE id = $2`,
        ['success', logId]
      );

      return { success: true };
    } catch (error) {
      console.error('Erro ao processar sincronização', error);
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  private async handleCreate(userId: string, table: string, data: any) {
    const id = uuidv4();
    const now = new Date().toISOString();

    switch (table) {
      case 'transactions':
        await query(
          `INSERT INTO transactions (id, user_id, type, description, amount, category, icon, date, payment_method, credit_card_id, credit_card_name, signature_required, signature_approved, signature_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
          [
            id,
            userId,
            data.type,
            data.description,
            data.amount,
            data.category,
            data.icon,
            data.date,
            data.paymentMethod || 'balance',
            data.creditCardId || null,
            data.creditCardName || null,
            Boolean(data.signatureRequired),
            Boolean(data.signatureApproved),
            Number(data.signatureScore) || 0,
          ]
        );
        break;

      case 'budgets':
        await query(
          `INSERT INTO budgets (id, user_id, category, limit_amount, period, color, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [id, userId, data.category, data.limit, data.period, data.color]
        );
        break;

      case 'goals':
        await query(
          `INSERT INTO goals (id, user_id, name, target, current, monthly, icon, color, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [id, userId, data.name, data.target, data.current || 0, data.monthly, data.icon, data.color]
        );
        break;

      case 'creditCards':
        await query(
          `INSERT INTO credit_cards (id, user_id, name, last_digits, limit_amount, used, due_date, color, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [id, userId, data.name, data.lastDigits, data.limit, data.used, data.dueDate, data.color]
        );
        break;

      case 'loans':
        await query(
          `INSERT INTO loans (id, user_id, name, total, paid, installments, current, rate, monthly, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [id, userId, data.name, data.total, data.paid, data.installments, data.current, data.rate, data.monthly]
        );
        break;
    }
  }

  private async handleUpdate(userId: string, table: string, recordId: string, data: any) {
    switch (table) {
      case 'goals':
        await query(
          `UPDATE goals SET current = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
          [data.newCurrent, recordId, userId]
        );
        break;
      }
    }

  private async handleDelete(userId: string, table: string, recordId: string) {
    const tableMap: Record<string, string> = {
      transactions: 'transactions',
      budgets: 'budgets',
      goals: 'goals',
      creditCards: 'credit_cards',
      loans: 'loans',
    };
    const dbTable = tableMap[table];
    if (!dbTable) return;

    await query(
      `DELETE FROM ${dbTable} WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    );
  }

  private currentPeriodMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private sanitizePeriodMonth(periodMonth?: string): string {
    return /^\d{4}-\d{2}$/.test(String(periodMonth ?? ''))
      ? String(periodMonth)
      : this.currentPeriodMonth();
  }

  private async refreshRegionalAverage(city: string, category: string, periodMonth: string): Promise<any> {
    const result = await query(
      `SELECT
         AVG(total_expense) as avg_expense,
         COUNT(*) as user_count
       FROM regional_contributions
       WHERE city = $1 AND category = $2 AND period_month = $3`,
      [city, category, periodMonth]
    );

    const row = result.rows[0];
    const avgExpense = parseFloat(row?.avg_expense ?? 0);
    const userCount = parseInt(row?.user_count ?? 0, 10);

    if (userCount > 0) {
      await query(
        `INSERT INTO regional_averages (id, city, category, avg_expense, user_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (city, category) DO UPDATE SET avg_expense = $4, user_count = $5, updated_at = NOW()`,
        [uuidv4(), city, category, avgExpense, userCount]
      );
    }

    return { avgExpense, userCount };
  }

  async submitRegionalContribution(city: string, category: string, totalExpense: number, periodMonth?: string): Promise<any> {
    const safeCity = String(city ?? '').trim();
    const safeCategory = String(category ?? '').trim();
    const safeAmount = Number(totalExpense);
    const safePeriodMonth = this.sanitizePeriodMonth(periodMonth);

    if (!safeCity || !safeCategory || !Number.isFinite(safeAmount) || safeAmount <= 0) {
      throw new Error('City, category and totalExpense are required');
    }

    await query(
      `INSERT INTO regional_contributions (id, city, category, total_expense, period_month, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), safeCity, safeCategory, safeAmount, safePeriodMonth]
    );

    return this.refreshRegionalAverage(safeCity, safeCategory, safePeriodMonth);
  }

  async getRegionalAverages(city: string, category: string, periodMonth?: string): Promise<any> {
    try {
      const safeCity = String(city ?? '').trim();
      const safeCategory = String(category ?? '').trim();
      const safePeriodMonth = this.sanitizePeriodMonth(periodMonth);

      if (!safeCity || !safeCategory) {
        return { avgExpense: 0, userCount: 0 };
      }

      const result = await query(
        `SELECT
           AVG(total_expense) as avg_expense,
           COUNT(*) as user_count
         FROM regional_contributions
         WHERE city = $1 AND category = $2 AND period_month = $3`,
        [safeCity, safeCategory, safePeriodMonth]
      );

      const row = result.rows[0];
      return {
        avgExpense: parseFloat(row?.avg_expense ?? 0),
        userCount: parseInt(row?.user_count ?? 0, 10),
      };
    } catch (error) {
      console.error('Erro ao calcular médias regionais', error);
      return { avgExpense: 0, userCount: 0 };
    }
  }

  async registerUserCity(_userId: string, _city: string): Promise<void> {
    // Mantido apenas para compatibilidade com versoes antigas do app.
    // A comparacao regional atual nao grava cidade no cadastro do usuario.
  }
}

export const syncService = new SyncService();
