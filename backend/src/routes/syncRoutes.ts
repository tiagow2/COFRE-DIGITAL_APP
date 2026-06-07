import { Router } from 'express';
import {
  getRegionalAverages,
  handleSync,
  registerUserLocation,
  submitRegionalContribution,
} from '../controllers/syncController';

const router = Router();

router.post('/sync', handleSync);
router.get('/regional-averages', getRegionalAverages);
router.post('/regional-contribution', submitRegionalContribution);
router.post('/user-location', registerUserLocation);

export default router;
