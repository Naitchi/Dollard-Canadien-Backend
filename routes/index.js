import express from 'express';
import {
  addAPlayer,
  createALobby,
  getALobby,
  lockDices,
  readyUp,
  startGame,
  test,
} from '../controllers/index.js';

const router = express.Router();

router.post('/createALobby', createALobby);
router.get('/lobby/:id', getALobby);
router.post('/addAPlayer', addAPlayer);
router.post('/readyUp', readyUp);
router.post('/startGame', startGame);
router.post('/lockDices', lockDices);

// route pour tester des fonctionnalités :
router.post('/test', test);

export default router;
