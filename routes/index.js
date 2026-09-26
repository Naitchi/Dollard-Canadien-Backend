import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import {
  addAPlayer,
  changeGameStep,
  changeOptions,
  createALobby,
  endTurn,
  getALobby,
  lockDices,
  readyUp,
  removeAPlayer,
  restartGame,
  sendMessage,
  startGame,
  turnTimeout,
} from '../controllers/index.js';

const router = express.Router();

const tooManyRequests = 'Trop de requêtes, réessaie dans un instant.';
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooManyRequests,
});

const createLobbyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: tooManyRequests,
});

const chatLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 10,
  keyGenerator: (req) => `chat:${req.body?.user?.id ?? ipKeyGenerator(req.ip)}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Doucement ! Attends un peu avant de renvoyer un message.',
});

router.use(apiLimiter);

router.post('/createALobby', createLobbyLimiter, createALobby);
router.get('/lobby/:id', getALobby);
router.post('/addAPlayer', addAPlayer);
router.post('/readyUp', readyUp);
router.post('/startGame', startGame);
router.post('/lockDices', lockDices);
router.post('/endTurn', endTurn);
router.post('/changeGameStep', changeGameStep);
router.post('/changeOptions', changeOptions);
router.post('/removeAPlayer', removeAPlayer);
router.post('/turnTimeout', turnTimeout);
router.post('/restartGame', restartGame);
router.post('/sendMessage', chatLimiter, sendMessage);

export default router;
