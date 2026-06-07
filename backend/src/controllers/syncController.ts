import { Request, Response } from 'express';
import { SyncPayload, syncService } from '../services/syncService';

export async function handleSync(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string;
    const payload = req.body as SyncPayload;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not provided' });
    }

    const result = await syncService.processSyncRequest(userId, payload);

    if (result.success) {
      res.json({ success: true, message: 'Sync completed' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Erro no sync', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/regional-averages?city=&category=&periodMonth=
 * Retorna medias regionais anonimas.
 */
export async function getRegionalAverages(req: Request, res: Response) {
  try {
    const { city, category, periodMonth } = req.query;

    if (!city || !category) {
      return res.status(400).json({ error: 'City and category are required' });
    }

    const averages = await syncService.getRegionalAverages(
      city as string,
      category as string,
      periodMonth as string | undefined
    );

    res.json(averages);
  } catch (error) {
    console.error('Erro ao buscar medias regionais', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/regional-contribution
 * Recebe somente cidade, categoria e total mensal agregado.
 * Nao recebe UID, e-mail ou transacoes individuais.
 */
export async function submitRegionalContribution(req: Request, res: Response) {
  try {
    const { city, category, totalExpense, periodMonth } = req.body;

    if (!city || !category || totalExpense === undefined) {
      return res.status(400).json({ error: 'City, category and totalExpense are required' });
    }

    const averages = await syncService.submitRegionalContribution(
      city,
      category,
      Number(totalExpense),
      periodMonth
    );

    res.json({ success: true, ...averages });
  } catch (error) {
    console.error('Erro ao registrar contribuicao regional', error);
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/user-location
 * Mantido para compatibilidade. Nao grava UID nem atualiza perfil do usuario.
 */
export async function registerUserLocation(req: Request, res: Response) {
  try {
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ error: 'City is required' });
    }

    res.json({ success: true, message: 'Anonymous city received' });
  } catch (error) {
    console.error('Erro ao registrar localizacao', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
