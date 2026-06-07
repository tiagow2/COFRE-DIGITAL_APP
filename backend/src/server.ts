import cors from 'cors';
import * as dotenv from 'dotenv';
import express from 'express';
import { closePool, initializeDatabase } from './database/connection';
import syncRoutes from './routes/syncRoutes';
import userRoutes from './routes/UserRoutes';
import creditCardRoutes from './routes/creditCardRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', syncRoutes);
app.use('/api/user', userRoutes);
app.use('/api/credit-cards', creditCardRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  try {
    console.log('Inicializando servidor...');

    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM recebido, fechando servidor...');
      await closePool();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT recebido, fechando servidor...');
      await closePool();
      process.exit(0);
    });
  } catch (error) {
    console.error('Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

start();
