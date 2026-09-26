import mongoose from 'mongoose';
import { isValidLobbyId } from '../functions/lobby.js';
import { findPlayerBySecret } from '../functions/players.js';
import Game from '../models/Game.js';


export const channel = (id) => `DollarCanadien-${id}`;


export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const controller = (name, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).send(error.message);
    console.error(`Erreur dans le contrôleur ${name}:`, error);
    res.status(500).send("Une erreur s'est produite");
  }
};

export const findGame = async (id) => {
  const game = isValidLobbyId(id) ? await Game.findById(id) : null;
  if (!game) throw new HttpError(404, 'Aucun Lobby trouvé.');
  return game;
};

const MAX_SAVE_ATTEMPTS = 5;

export const updateGame = async (id, mutate) => {
  for (let attempt = 1; ; attempt++) {
    const game = await findGame(id);
    const result = mutate(game);
    try {
      await game.save();
      return { game, result };
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError) || attempt >= MAX_SAVE_ATTEMPTS) {
        throw error;
      }
    }
  }
};

export const requirePlayer = (game, user) => {
  const player = findPlayerBySecret(game, user?.id);
  if (!player) throw new HttpError(403, 'Tu ne fais pas partie de cette partie.');
  return player;
};

export const requireHost = (game, user) => {
  const player = requirePlayer(game, user);
  if (player._id !== game.host.id) {
    throw new HttpError(403, "Vous n'avez pas l'autorité pour faire ça.");
  }
  return player;
};

export const requireActivePlayer = (game, user) => {
  if (!game.actif || game.step === 'gameEnd') {
    throw new HttpError(409, "La partie n'est pas en cours.");
  }
  const player = requirePlayer(game, user);
  if (player._id !== game.actif) throw new HttpError(403, 'Pas ton tour mon grand >:(');
  return player;
};

export const requireLobby = (game) => {
  if (game.actif) throw new HttpError(409, 'La partie est déjà lancée.');
};
