import { Router } from 'express';
import {
  createCreditCard,
  deleteCreditCard,
  getCreditCards,
  updateCreditCard,
} from '../controllers/creditCardController';

const router = Router();

// GET /api/credit-cards - Lista cartões do usuário autenticado
router.get('/', getCreditCards);

// POST /api/credit-cards - Cria novo cartão
router.post('/', createCreditCard);

// PUT /api/credit-cards/:cardId - Atualiza cartão por ID
router.put('/:cardId', updateCreditCard);

// DELETE /api/credit-cards/:cardId - Deleta cartão por ID
router.delete('/:cardId', deleteCreditCard);

export default router;
