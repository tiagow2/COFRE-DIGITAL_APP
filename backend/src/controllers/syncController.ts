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
 * GET /api/regional-averages?city=&category=
 * Retorna médias regionais anônimas
 */
export async function getRegionalAverages(req: Request, res: Response) {
  try {
    const { city, category } = req.query;

    if (!city || !category) {
      return res.status(400).json({ error: 'City and category are required' });
    }

    const averages = await syncService.getRegionalAverages(
      city as string,
      category as string
    );

    res.json(averages);
  } catch (error) {
    console.error('Erro ao buscar médias regionais', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/user-location
 * Registra a localização (cidade) do usuário para cálculo de médias
 */
export async function registerUserLocation(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { city } = req.body;

    if (!userId || !city) {
      return res.status(400).json({ error: 'User ID and city are required' });
    }

    await syncService.registerUserCity(userId, city);

    res.json({ success: true, message: 'Location registered' });
  } catch (error) {
    console.error('Erro ao registrar localização', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
