-- Tabela principal de Usuários
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Transações (Isolada por user_id)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category VARCHAR(80),
  payment_method VARCHAR(20),
  card_id UUID,
  receipt_image_url TEXT,
  signature_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Médias Regionais Anonimizada (Sem ligação ao ID de usuário único publicamente)
CREATE TABLE regional_spending_averages (
  id UUID PRIMARY KEY,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(50),
  category VARCHAR(80) NOT NULL,
  average_amount NUMERIC(12,2) NOT NULL,
  sample_size INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Empréstimos e Dívidas
CREATE TABLE loans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  installments INTEGER NOT NULL,
  paid_installments INTEGER DEFAULT 0,
  installment_value NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para otimização do filtro regional
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_regional_city_cat ON regional_spending_averages(city, category);
CREATE INDEX idx_loans_user ON loans(user_id);