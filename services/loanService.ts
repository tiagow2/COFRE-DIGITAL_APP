import { getDatabase, initializeDatabase } from './database';

export interface Loan {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  installments: number;
  paidInstallments: number;
  installmentValue: number;
  createdAt: string;
}

export const loanService = {
  async ensureTable() {
    await initializeDatabase();
    // A tabela e as migrações já são garantidas pelo database.ts
  },

  async addLoan(userId: string, loan: Omit<Loan, 'userId' | 'paidInstallments' | 'createdAt'>) {
    if (!userId) throw new Error('Usuário não autenticado.');
    await this.ensureTable();
    const db = getDatabase();
    const now = new Date().toISOString();
    
    // Inserindo tanto nas colunas antigas quanto nas novas para respeitar as restrições NOT NULL originais
    await db.runAsync(
      `INSERT INTO loans (
        id, user_id, userId, name, 
        total_amount, total, 
        installments, 
        paid_installments, paid, current, 
        installment_value, monthly, 
        rate, created_at, createdAt, updatedAt
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loan.id, 
        userId, userId, 
        loan.name, 
        loan.totalAmount, loan.totalAmount, 
        loan.installments, 
        0, 0, 0, 
        loan.installmentValue, loan.installmentValue, 
        0, 
        now, now, now
      ]
    );
  },

  async listLoans(userId: string): Promise<Loan[]> {
    if (!userId) return [];
    await this.ensureTable();
    const db = getDatabase();
    const rows = await db.getAllAsync(
      `SELECT id, user_id, userId, name, total_amount, total, installments, paid_installments, current, installment_value, monthly, created_at, createdAt
       FROM loans WHERE user_id = ? OR userId = ? ORDER BY created_at DESC, createdAt DESC`,
      [userId, userId]
    );
    return rows.map((r: any) => ({
      id: String(r.id),
      userId: String(r.user_id || r.userId),
      name: String(r.name),
      totalAmount: Number(r.total_amount || r.total || 0),
      installments: Number(r.installments || 0),
      paidInstallments: Number(r.paid_installments || r.current || 0),
      installmentValue: Number(r.installment_value || r.monthly || 0),
      createdAt: String(r.created_at || r.createdAt || '')
    }));
  },

  async registerPayment(id: string, userId: string) {
    if (!userId) return;
    await this.ensureTable();
    const db = getDatabase();
    
    // Atualiza ambas as estruturas de colunas
    await db.runAsync(
      `UPDATE loans 
       SET paid_installments = paid_installments + 1, current = current + 1, paid = paid + installment_value
       WHERE id = ? AND (user_id = ? OR userId = ?)`,
      [id, userId, userId]
    );
  }
};