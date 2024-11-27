import express from 'express';
const router = express.Router();
import { getDicesResults } from '../controllers/index.js';

router.post('/getDicesResults', getDicesResults);

export default router;
