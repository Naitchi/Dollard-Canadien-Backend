import express from 'express';
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
router.post('/endTurn', endTurn);
router.post('/changeGameStep', changeGameStep);
router.post('/changeOptions', changeOptions);
router.post('/removeAPlayer', removeAPlayer);

// route pour tester des fonctionnalités :
router.post('/test', test);

export default router;
