import { Budget, CreditCard, Goal, Loan, Transaction, Challenge } from '@/context/FinanceContext';
import { Database, getDatabase } from './database';
import { debugLogger } from './debugLogger';

const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export class FinanceRepository {
  private db: Database;
  private userId: string;

  constructor(userId: string) {
    this.db = getDatabase();
    this.userId = userId;
  }

  async addTransaction(tx: Omit<Transaction, 'id' | 'date'> & { date?: string }): Promise<Transaction> {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const date = tx.date || now;

    await this.db.runAsync(
      `INSERT INTO transactions (id, userId, type, description, amount, category, icon, date, paymentMethod, creditCardId, creditCardName, signatureRequired, signatureApproved, signatureScore, receiptPhoto, signature, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        this.userId,
        tx.type,
        asText(tx.description, 'Transação'),
        asNumber(tx.amount),
        asText(tx.category, tx.type === 'income' ? 'Receita' : 'Outros'),
        asText(tx.icon, tx.type === 'income' ? 'wallet-outline' : 'ellipsis-horizontal-outline'),
        date,
        asText(tx.paymentMethod, 'balance'),
        asText(tx.creditCardId),
        asText(tx.creditCardName),
        tx.signatureRequired ? 1 : 0,
        tx.signatureApproved ? 1 : 0,
        asNumber(tx.signatureScore),
        asText(tx.photo),
        asText(tx.signature),
        now,
        now,
        0,
      ]
    );

    await this.addToSyncQueue('create', 'transactions', id, { ...tx, id, date });

    debugLogger.log('Transação adicionada', { id, description: tx.description });
    return { ...tx, id, date } as Transaction;
  }

  async getTransactions(): Promise<Transaction[]> {
    return await this.db.getAllAsync(
      `SELECT id, userId, type, description, amount, category, icon, date, paymentMethod, creditCardId, creditCardName, signatureRequired, signatureApproved, signatureScore, receiptPhoto as photo, signature, createdAt, updatedAt, synced, syncedAt
       FROM transactions
       WHERE userId = ?
       ORDER BY date DESC`,
      [this.userId]
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.addToSyncQueue('delete', 'transactions', id, { id });
    await this.db.runAsync(
      `DELETE FROM transactions WHERE id = ? AND userId = ?`,
      [id, this.userId]
    );
    debugLogger.log('Transação removida localmente', { id });
  }

  async addBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const id = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO budgets (id, userId, category, limit_amount, period, color, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.userId, asText(budget.category, 'Outros'), asNumber(budget.limit), asText(budget.period, 'monthly'), asText(budget.color, '#1565C0'), now, now, 0]
    );

    await this.addToSyncQueue('create', 'budgets', id, { ...budget, id });
    debugLogger.log('Orçamento adicionado', { id, category: budget.category });
    return { ...budget, id } as Budget;
  }

  async getBudgets(): Promise<Budget[]> {
    const rows = await this.db.getAllAsync(
      `SELECT id, userId, category, limit_amount as "limit", period, color, createdAt, updatedAt FROM budgets WHERE userId = ?`,
      [this.userId]
    );
    return rows;
  }

  async addGoal(goal: Omit<Goal, 'id' | 'current'>): Promise<Goal> {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO goals (id, userId, name, target, current, monthly, icon, color, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.userId, asText(goal.name, 'Meta'), asNumber(goal.target), 0, asNumber(goal.monthly), asText(goal.icon, 'flag-outline'), asText(goal.color, '#1565C0'), now, now, 0]
    );

    await this.addToSyncQueue('create', 'goals', id, { ...goal, id, current: 0 });
    debugLogger.log('Meta adicionada', { id, name: goal.name });
    return { ...goal, id, current: 0 } as Goal;
  }

  async getGoals(): Promise<Goal[]> {
    return await this.db.getAllAsync(
      `SELECT * FROM goals WHERE userId = ?`,
      [this.userId]
    );
  }

  async depositToGoal(goalId: string, amount: number): Promise<void> {
    const goal = await this.db.getFirstAsync(
      `SELECT current FROM goals WHERE id = ? AND userId = ?`,
      [goalId, this.userId]
    );

    if (!goal) throw new Error('Goal not found');

    const newCurrent = goal.current + amount;
    await this.db.runAsync(
      `UPDATE goals SET current = ?, updatedAt = ?, synced = 0 WHERE id = ? AND userId = ?`,
      [newCurrent, new Date().toISOString(), goalId, this.userId]
    );

    await this.addToSyncQueue('update', 'goals', goalId, { goalId, amount, newCurrent });
    debugLogger.log('Depósito adicionado à meta', { goalId, amount });
  }

  async addCreditCard(card: Omit<CreditCard, 'id'>): Promise<CreditCard> {
    const id = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO creditCards (id, userId, name, lastDigits, limit_amount, used, dueDate, color, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.userId, asText(card.name, 'Cartão'), asText(card.lastDigits, '0000'), asNumber(card.limit), asNumber(card.used), asText(card.dueDate), asText(card.color, '#1565C0'), now, now, 0]
    );

    await this.addToSyncQueue('create', 'creditCards', id, { ...card, id });
    debugLogger.log('Cartão adicionado', { id, name: card.name });
    return { ...card, id } as CreditCard;
  }

  async getCreditCards(): Promise<CreditCard[]> {
    return await this.db.getAllAsync(
      `SELECT id, userId, name, lastDigits, limit_amount as "limit", used, dueDate, color, createdAt, updatedAt FROM creditCards WHERE userId = ?`,
      [this.userId]
    );
  }

  async updateCreditCardUsed(cardId: string, newUsed: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE creditCards SET used = ?, updatedAt = ?, synced = 0 WHERE id = ? AND userId = ?`,
      [newUsed, now, cardId, this.userId]
    );
    await this.addToSyncQueue('update', 'creditCards', cardId, { used: newUsed });
  }

  async addLoan(loan: Omit<Loan, 'id'>): Promise<Loan> {
    const id = `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO loans (id, userId, name, total, paid, installments, current, rate, monthly, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.userId, asText(loan.name, 'Empréstimo'), asNumber(loan.total), asNumber(loan.paid), asNumber(loan.installments), asNumber(loan.current), asNumber(loan.rate), asNumber(loan.monthly), now, now, 0]
    );

    await this.addToSyncQueue('create', 'loans', id, { ...loan, id });
    debugLogger.log('Empréstimo adicionado', { id, name: loan.name });
    return { ...loan, id } as Loan;
  }

  async getLoans(): Promise<Loan[]> {
    return await this.db.getAllAsync(
      `SELECT * FROM loans WHERE userId = ?`,
      [this.userId]
    );
  }

  async addChallenge(challenge: Omit<Challenge, 'id' | 'currentAmount' | 'status'>): Promise<Challenge> {
    const id = `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO challenges (id, userId, title, targetAmount, currentAmount, deadline, status, medalIcon, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, this.userId, asText(challenge.title, 'Desafio'), asNumber(challenge.targetAmount), 0, asText(challenge.deadline, now), 'active', asText(challenge.medalIcon, 'trophy-outline'), now, now, 0]
    );

    await this.addToSyncQueue('create', 'challenges', id, { ...challenge, id, currentAmount: 0, status: 'active' });
    debugLogger.log('Desafio adicionado', { id, title: challenge.title });
    return { ...challenge, id, currentAmount: 0, status: 'active' } as Challenge;
  }

  async getChallenges(): Promise<Challenge[]> {
    return await this.db.getAllAsync(
      `SELECT * FROM challenges WHERE userId = ?`,
      [this.userId]
    );
  }

  async updateChallengeProgress(challengeId: string, currentAmount: number, status: 'active' | 'completed'): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE challenges SET currentAmount = ?, status = ?, updatedAt = ?, synced = 0 WHERE id = ? AND userId = ?`,
      [currentAmount, status, now, challengeId, this.userId]
    );
    await this.addToSyncQueue('update', 'challenges', challengeId, { currentAmount, status });
  }

  async addToSyncQueue(action: 'create' | 'update' | 'delete', table_name: string, record_id: string, payload: any): Promise<void> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await this.db.runAsync(
        `INSERT INTO syncQueue (id, userId, action, table_name, record_id, payload, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, this.userId, action, table_name, record_id, JSON.stringify(payload ?? {}), new Date().toISOString(), 0]
      );
    } catch (error) {
      debugLogger.log('Falha ao registrar syncQueue; dado local preservado', {
        action,
        table_name,
        record_id,
        error: (error as Error).message,
      });
    }
  }

  async getSyncQueue(): Promise<any[]> {
    return await this.db.getAllAsync(
      `SELECT * FROM syncQueue WHERE userId = ? AND synced = 0 ORDER BY createdAt ASC`,
      [this.userId]
    );
  }

  async markAsSynced(syncIds: string[]): Promise<void> {
    if (syncIds.length === 0) return;
    const placeholders = syncIds.map(() => '?').join(',');
    await this.db.runAsync(
      `UPDATE syncQueue SET synced = 1 WHERE id IN (${placeholders})`,
      syncIds
    );
  }

  async getRegionalAverages(city: string, category: string): Promise<{ avgExpense: number; userCount: number } | null> {
    return await this.db.getFirstAsync(
      `SELECT avgExpense, userCount FROM regionalAverages WHERE city = ? AND category = ?`,
      [city, category]
    );
  }

  async updateRegionalAverages(city: string, category: string, avgExpense: number, userCount: number): Promise<void> {
    const id = `region_${city}_${category}`;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO regionalAverages (id, city, category, avgExpense, userCount, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, city, category, avgExpense, userCount, new Date().toISOString()]
    );
  }

  async clearAllData(): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions WHERE userId = ?`, [this.userId]);
    await this.db.runAsync(`DELETE FROM budgets WHERE userId = ?`, [this.userId]);
    await this.db.runAsync(`DELETE FROM goals WHERE userId = ?`, [this.userId]);
    await this.db.runAsync(`DELETE FROM creditCards WHERE userId = ?`, [this.userId]);
    await this.db.runAsync(`DELETE FROM loans WHERE userId = ?`, [this.userId]);
    debugLogger.log('Todos os dados do usuário foram limpos', { userId: this.userId });
  }
}
