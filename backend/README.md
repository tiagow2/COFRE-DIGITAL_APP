# Cofre Digital - Backend

API Node.js + Express para sincronização de dados e cálculo de médias regionais.

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco de dados

Crie um arquivo `.env` baseado em `.env.example`:

```bash
cp .env.example .env
```

Configure as variáveis:

```
DATABASE_URL=postgresql://user:password@localhost:5432/cofre_digital
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

### 3. Executar migrations

O banco de dados é criado automaticamente na primeira execução.

### 4. Desenvolvimento

```bash
npm run dev
```

O servidor estará em `http://localhost:3000`

### 5. Build para produção

```bash
npm run build
npm start
```

## API Endpoints

### Sincronização

**POST /api/sync**

Sincroniza dados do cliente com o servidor.

```json
{
  "action": "create|update|delete",
  "table": "transactions|budgets|goals|creditCards|loans",
  "recordId": "uuid",
  "data": { /* dados do registro */ },
  "syncImages": false
}
```

Headers:
- `X-User-ID`: ID do usuário (Firebase UID)

### Médias Regionais

**GET /api/regional-averages?city=São Paulo&category=Alimentação**

Retorna a media de gastos por categoria para uma cidade usando somente amostras anonimas agregadas.

Response:
```json
{
  "avgExpense": 150.50,
  "userCount": 245
}
```

### Contribuição Regional Anônima

**POST /api/regional-contribution**

Registra uma amostra anonima para calculo de medias regionais. Nao recebe Firebase UID, e-mail, nome, ID de dispositivo nem transacoes individuais.

```json
{
  "city": "Sao Paulo",
  "category": "Alimentacao",
  "totalExpense": 950.75,
  "periodMonth": "2026-06"
}
```

O app envia somente cidade via GPS, categoria e total mensal agregado.

### Health Check

**GET /api/health**

Verifica se o servidor está rodando.

## Estrutura

```
backend/
├── src/
│   ├── database/
│   │   └── connection.ts       # Conexão com PostgreSQL
│   ├── routes/
│   │   └── syncRoutes.ts       # Definição de rotas
│   ├── controllers/
│   │   └── syncController.ts   # Lógica dos endpoints
│   ├── services/
│   │   └── syncService.ts      # Lógica de negócio
│   └── server.ts               # Arquivo principal
├── dist/                       # Build compilado
├── package.json
├── tsconfig.json
└── .env.example
```

## Próximas etapas

- [ ] Autenticação com Firebase
- [ ] Validação de requisições
- [ ] Testes automatizados
- [ ] Deploy em produção
- [ ] Documentação com Swagger
