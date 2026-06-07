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

  async getRegionalAverages(city: string, category: string): Promise<any> {
    try {
      let result = await query(
        `SELECT avg_expense, user_count FROM regional_averages WHERE city = $1 AND category = $2`,
        [city, category]
      );

      if (result.rows.length === 0) {
        result = await query(
          `SELECT 
             AVG(user_expense.total) as avg_expense,
             COUNT(*) as user_count
           FROM (
             SELECT t.user_id, SUM(t.amount) as total
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             WHERE u.city = $1 AND t.category = $2 AND t.type = 'expense'
               AND t.date >= NOW() - INTERVAL '30 days'
             GROUP BY t.user_id
           ) user_expense`,
          [city, category]
        );

        if (result.rows.length > 0 && result.rows[0].avg_expense) {
          const avgExpense = parseFloat(result.rows[0].avg_expense);
          const userCount = parseInt(result.rows[0].user_count);

          const id = uuidv4();
          await query(
            `INSERT INTO regional_averages (id, city, category, avg_expense, user_count, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (city, category) DO UPDATE SET avg_expense = $4, user_count = $5, updated_at = NOW()`,
            [id, city, category, avgExpense, userCount]
          );

          return { avgExpense, userCount };
        }
      }

      const row = result.rows[0];
      return row
        ? {
            avgExpense: parseFloat(row.avg_expense ?? row.avgExpense ?? 0),
            userCount: parseInt(row.user_count ?? row.userCount ?? 0),
          }
        : { avgExpense: 0, userCount: 0 };
    } catch (error) {
      console.error('Erro ao calcular médias regionais', error);
      return { avgExpense: 0, userCount: 0 };
    }
  }

  /**
   * Registra um usuário para fins de cálculo de médias regionais
   */
  async registerUserCity(userId: string, city: string): Promise<void> {
    try {
      const dbUserId = await this.resolveUserId(userId);
      await query(
        `UPDATE users SET city = $1 WHERE id = $2`,
        [city, dbUserId]
      );
    } catch (error) {
      console.error('Erro ao registrar cidade do usuário', error);
    }
  }
}

export const syncService = new SyncService();
