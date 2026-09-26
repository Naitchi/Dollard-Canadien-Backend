import { validateOptions } from '../functions/lobby.js';
import {
  ensureHost,
  findPlayerBySecret,
  getPublicId,
  isValidUser,
  uniqueUsername,
} from '../functions/players.js';
import { startTurn } from '../functions/turn.js';
import Game from '../models/Game.js';
import pusher from '../pusher.js';
import {
  HttpError,
  channel,
  controller,
  findGame,
  requireHost,
  requireLobby,
  requirePlayer,
  updateGame,
} from './helpers.js';

export const createALobby = controller('createALobby', async (req, res) => {
  const { user } = req.body;
  if (!isValidUser(user)) throw new HttpError(400, 'Utilisateur invalide.');

  const game = new Game();
  const me = getPublicId(game._id, user.id);
  const username = uniqueUsername(game, user.username);
  game.host = { id: me, username };
  game.creatorId = me;
  game.players.push({
    _id: me,
    secret: user.id,
    username,
    ready: true,
    hp: game.maxHp,
    index: 0,
  });
  await game.save();

  res.status(201).send({ game, me });
});

export const getALobby = controller('getALobby', async (req, res) => {
  const game = await findGame(req.params.id);
  const me = findPlayerBySecret(game, req.get('x-player-secret'))?._id ?? null;
  res.status(200).send({ game, me, serverTime: Date.now() });
});

export const changeOptions = controller('changeOptions', async (req, res) => {
  const { id, user, options } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireLobby(game);
    requireHost(game, user);
    const error = validateOptions(options, game.players.length);
    if (error) throw new HttpError(422, error);

    game.maxPlayers = options.maxPlayers;
    game.maxHp = options.maxHp;
    if (options.stake) game.stake = { target: options.stake.target, text: options.stake.text.trim() };
    // TODO ajouter les autres options ici
  });

  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});

export const addAPlayer = controller('addAPlayer', async (req, res) => {
  const { id, user } = req.body;
  if (!isValidUser(user)) throw new HttpError(400, 'Utilisateur invalide.');

  const { game, result } = await updateGame(id, (game) => {
    const existing = findPlayerBySecret(game, user.id);
    if (existing) return { me: existing._id, joined: false };

    requireLobby(game);
    if (game.players.length >= game.maxPlayers) throw new HttpError(409, 'Le salon est plein.');

    const me = getPublicId(game._id, user.id);
    game.players.push({
      _id: me,
      secret: user.id,
      username: uniqueUsername(game, user.username),
      ready: false,
      hp: game.maxHp,
      index: game.players.length,
    });
    ensureHost(game);
    return { me, joined: true };
  });

  if (result.joined) await pusher.trigger(channel(id), 'updateGame', game);
  res.status(result.joined ? 201 : 200).send({ game, me: result.me });
});

export const removeAPlayer = controller('removeAPlayer', async (req, res) => {
  const { id, user, targetId } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireLobby(game);
    const requester = requirePlayer(game, user);
    const targetIndex = game.players.findIndex((player) => player._id === targetId);
    if (targetIndex === -1) throw new HttpError(404, 'Joueur introuvable.');
    if (requester._id !== game.host.id && requester._id !== targetId) {
      throw new HttpError(403, "Vous n'avez pas l'autorité pour faire ça.");
    }

    game.players.splice(targetIndex, 1);
    game.players.forEach((player, idx) => {
      player.index = idx;
    });
    ensureHost(game);
  });

  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});

export const readyUp = controller('readyUp', async (req, res) => {
  const { id, user } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireLobby(game);
    const player = requirePlayer(game, user);
    player.ready = !player.ready;
  });

  await pusher.trigger(channel(id), 'updatePlayers', game.players);
  res.status(200).send(game);
});

export const startGame = controller('startGame', async (req, res) => {
  const { id, user } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireLobby(game);
    requireHost(game, user);
    if (game.players.length <= 1) {
      throw new HttpError(422, 'Pas assez de joueurs pour lancer la partie.');
    }
    if (!game.players.every((player) => player.ready || player._id === game.host.id)) {
      throw new HttpError(409, 'Tout les joueurs ne sont pas prêt.');
    }

    game.players.forEach((player, index) => {
      player.index = index;
      player.hp = game.maxHp;
      player.dices = [];
      player.lockedDices = [];
      player.attackDices = [];
    });
    startTurn(game, game.players[0]._id);
  });

  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(201).send(game);
});

export const restartGame = controller('restartGame', async (req, res) => {
  const { id, user } = req.body;

  const { game } = await updateGame(id, (game) => {
    requireHost(game, user);
    if (game.step !== 'gameEnd') throw new HttpError(409, "La partie n'est pas terminée.");

    game.actif = null;
    game.step = 'none';
    game.turnDeadline = null;
    game.turnLimit = null;
    game.eliminated = [];
    game.players.forEach((player, index) => {
      player.index = index;
      player.hp = game.maxHp;
      player.ready = player._id === game.host.id;
      player.dices = [];
      player.lockedDices = [];
      player.attackDices = [];
    });
  });

  await pusher.trigger(channel(id), 'updateGame', game);
  res.status(200).send(game);
});
