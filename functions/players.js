import crypto from 'crypto';

export const MAX_USERNAME_LENGTH = 24;

/**
 * Checks that a user sent by the client has a usable secret and username.
 *
 * @param {any} user - The user object from the request body.
 * @returns {boolean} True if the user is valid.
 */
export const isValidUser = (user) =>
  typeof user?.id === 'string' &&
  user.id !== '' &&
  typeof user.username === 'string' &&
  user.username.trim() !== '';

/**
 * Derives a player's public id from their private secret.
 *
 * Deterministic so that a player who leaves and rejoins the same lobby (e.g.
 * after a page refresh) gets the same public id back - and stays the host if
 * they were. Salted with the game id so the same person can't be linked
 * across games. The secret is a random uuid, so it can't be recovered from
 * the hash.
 *
 * @param {string} gameId - The id of the game.
 * @param {string} secret - The player's private secret.
 * @returns {string} The player's public id.
 */
export const getPublicId = (gameId, secret) =>
  crypto.createHash('sha256').update(`${gameId}:${secret}`).digest('hex').slice(0, 24);

/**
 * Finds the player a secret belongs to.
 *
 * @param {Game} game - The game object containing a list of players.
 * @param {string} secret - The private secret sent by the client (`user.id`).
 * @returns {Player | undefined} The matching player, or undefined if none.
 */
export const findPlayerBySecret = (game, secret) => {
  if (typeof secret !== 'string' || secret === '') return undefined;
  return game.players.find((player) => player.secret === secret);
};

/**
 * Picks the name a player will have in a lobby: trimmed, shortened if too
 * long, and suffixed with a number if another player already has it (case
 * insensitive), so that nobody can pass themselves off as someone else.
 *
 * @param {Game} game - The game the player joins.
 * @param {string} username - The username sent by the client.
 * @returns {string} The username to use in this game.
 */
export const uniqueUsername = (game, username) => {
  const base = username.trim().slice(0, MAX_USERNAME_LENGTH);
  const taken = new Set(game.players.map((player) => player.username.toLowerCase()));
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    candidate = `${base} (${n})`;
  }
  return candidate;
};

/**
 * Makes sure the lobby's host is actually in it, so that someone can always
 * start the game: the creator if they're here (they get the role back when
 * they return, e.g. after a page refresh), otherwise the current host,
 * otherwise the player who has been in the lobby the longest. An empty lobby
 * keeps its host, so that they get it back if they return.
 *
 * @param {Game} game - The game to update (mutated).
 */
export const ensureHost = (game) => {
  const findPlayer = (id) => game.players.find((player) => player._id === id);
  const host = findPlayer(game.creatorId) ?? findPlayer(game.host.id) ?? game.players[0];
  if (host && host._id !== game.host.id) {
    game.host = { id: host._id, username: host.username };
  }
};

/**
 * Gets the active player from the game based on the `actif` property.
 *
 * @param {Game} game - The game object containing players and the active player's ID.
 * @returns {Player} The active player object.
 */
export const getActivePlayer = (game) => {
  const activeId = game.actif;
  return game.players.filter((player) => player._id == activeId)[0];
};

/**
 * Gets the ID of the next player in the game.
 *
 * @param {Game} game - The game object containing players and the active player's ID.
 * @returns {string | null} The ID of the next player or null if no other player alive.
 */
export const getNextPlayerId = (game) => {
  const activePlayerId = game.actif;
  const playersAlive = game.players.filter((player) => player.hp > 0);
  if (playersAlive.length === 1) {
    console.log("Plus qu'un joueur vivant");
    return null;
  }

  const nextPlayer = game.players.filter(
    (player) => player.hp > 0 || player._id === activePlayerId,
  );
  const currentIndex = nextPlayer.findIndex((player) => player._id == activePlayerId);
  if (currentIndex === -1) {
    console.error('Joueur actif non trouvé dans la liste des joueurs');
    return null;
  }
  const nextIndex = (currentIndex + 1) % nextPlayer.length;

  return nextPlayer[nextIndex]._id;
};
