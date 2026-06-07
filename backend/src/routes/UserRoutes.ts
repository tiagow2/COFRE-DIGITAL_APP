import { Router } from 'express';
import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
} from '../controllers/userController';
import { query } from '../database/connection';

const router = Router();

// POST /api/user/create-profile - Cria ou atualiza perfil de usuário (ON CONFLICT)
router.post('/create-profile', createUserProfile);

// GET /api/user/profile - Busca perfil do usuário autenticado
router.get('/profile', getUserProfile);

// PUT /api/user/profile - Atualiza perfil (renda, cidade, saldo inicial)
router.put('/profile', updateUserProfile);

// POST /api/user/onboarding-complete - Marca onboarding como completo
router.post('/onboarding-complete', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not provided' });
    }
    await query(
      `UPDATE users SET onboarding_completed = true WHERE firebase_uid = $1`,
      [userId]
    );
    res.json({ success: true, message: 'Onboarding marked as complete' });
  } catch (error) {
    console.error('Error marking onboarding complete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
