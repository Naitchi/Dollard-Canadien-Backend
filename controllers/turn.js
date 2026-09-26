import { dicesRoll, getValuesByIndex, isValidDiceSelection } from '../functions/dice.js';
import {
  PLAYING_STEPS,
  actionDeadline,
  advanceTurn,
  lockRemainingDices,
  resolveTurn,
} from '../functions/turn.js';
import pusher from '../pusher.js';
import {
  HttpError,
  channel,
  controller,
  requireActivePlayer,
  requirePlayer,
  updateGame,
} from './helpers.js';

const CLIENT_STEP_TRANSITIONS = { none: 'dices', dices: 'lockAnimation' };

export const changeGameStep = controller('changeGameStep', async (req, res) => {
  const { id, user, step } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireActivePlayer(game, user);
    if (CLIENT_STEP_TRANSITIONS[game.step] !== step) {
      throw new HttpError(409, `Impossible de passer de l'étape "${game.step}" à "${step}".`);
    }
    game.step = step;
    game.turnDeadline = actionDeadline(game);
  });

  // TODO faire un troisieme pusher pour le step ?? (pour l'instant ca marche juste pas opti)
  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});

export const lockDices = controller('lockDices', async (req, res) => {
  const { id, user, lockedDices } = req.body;

  const { game } = await updateGame(id, (game) => {
    const activePlayer = requireActivePlayer(game, user);
    if (game.step !== 'dices' && game.step !== 'lockAnimation') {
      throw new HttpError(409, "Ce n'est pas le moment de verrouiller des dés.");
    }
    if (!isValidDiceSelection(lockedDices, activePlayer.dices.length)) {
      throw new HttpError(422, 'Sélection de dés invalide.');
    }

    activePlayer.lockedDices.push(...getValuesByIndex(activePlayer.dices, lockedDices));

    if (activePlayer.lockedDices.length < 6) {
      activePlayer.dices = dicesRoll(6 - activePlayer.lockedDices.length);
      game.step = 'none';
      game.turnDeadline = actionDeadline(game);
    } else {
      resolveTurn(game);
    }
  });

  // TODO faire deux pusher en fonction de si ça change de joueur actif ou non
  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});

export const endTurn = controller('endTurn', async (req, res) => {
  const { id, user } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireActivePlayer(game, user);
    if (game.step !== 'scoreAdditionAnimation') {
      throw new HttpError(409, "Le joueur actif n'a pas verrouillé 6 dés.");
    }
    // TODO changer pour pas faire jouer le mec si il reste que lui (que le joueur actuel est mort et quil est le dernier) (normalelement c'est bon mais je laisse pour validation)
    // TODO revoir on affiche pas le bon joueur quand c'est le joueur actif qui meurt
    advanceTurn(game);
  });

  // TODO faire deux pusher en fonction de si ça change de joueur actif ou non
  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});

export const turnTimeout = controller('turnTimeout', async (req, res) => {
  const { id, user } = req.body;

  const { game } = await updateGame(id, (game) => {
    requirePlayer(game, user);
    if (!game.actif || game.step === 'gameEnd') {
      throw new HttpError(409, "La partie n'est pas en cours.");
    }
    if (!game.turnDeadline || Date.now() < new Date(game.turnDeadline).getTime()) {
      throw new HttpError(409, 'Le joueur actif a encore du temps.');
    }

    if (PLAYING_STEPS.includes(game.step)) {
      lockRemainingDices(game);
      resolveTurn(game);
    } else {
      advanceTurn(game);
    }
  });

  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});
