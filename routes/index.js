import express from 'express';
const router = express.Router();
import { message, newChatter, chatterLeft } from '../controllers/index.js';

router.post('/', message);
router.post('/newChatter', newChatter);
router.post('/chatterLeft', chatterLeft);

export default router;
