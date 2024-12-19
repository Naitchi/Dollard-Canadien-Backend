import express from 'express';
import { lockDices, startGame } from '../controllers/index.js';

const router = express.Router();

router.post('/lockDices', lockDices);
router.post('/startGame', startGame);

export default router;
