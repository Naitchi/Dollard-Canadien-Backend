import crypto from 'crypto';

/**
 * Generates a lobby id. It's also what the invite link contains, so it has to
 * be impossible to guess (a Mongo ObjectId isn't: two lobbies created one
 * after the other have ids that differ by 1). 128 random bits, URL-safe.
 *
 * @returns {string} A new lobby id (22 characters).
 */
export const generateLobbyId = () => crypto.randomBytes(16).toString('base64url');

/**
 * Checks that a string has the shape of a lobby id, before querying the DB with it.
 *
 * @param {any} id - The id sent by the client.
 * @returns {boolean} True if it looks like a lobby id.
 */
export const isValidLobbyId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(id);

export const MAX_HP_LIMIT = 999;
export const MAX_PLAYERS_LIMIT = 99;
export const STAKE_TARGETS = ['firstLoser', 'losers', 'winner'];
export const MAX_STAKE_LENGTH = 100;

/**
 * Validates the lobby options sent by the host.
 *
 * @param {any} options - The options from the request body.
 * @param {number} playerCount - The number of players already in the lobby.
 * @returns {string | null} An error message, or null if the options are valid.
 */
export const validateOptions = (options, playerCount) => {
  if (!Number.isInteger(options?.maxHp) || options.maxHp < 1 || options.maxHp > MAX_HP_LIMIT)
    return `Les points de vie doivent être un entier entre 1 et ${MAX_HP_LIMIT}.`;
  if (
    !Number.isInteger(options.maxPlayers) ||
    options.maxPlayers < 2 ||
    options.maxPlayers > MAX_PLAYERS_LIMIT
  )
    return `Le nombre de joueurs maximum doit être un entier entre 2 et ${MAX_PLAYERS_LIMIT}.`;
  if (options.maxPlayers < playerCount) return `Il y a déjà ${playerCount} joueurs dans le salon.`;
  if (options.stake !== undefined) {
    if (!STAKE_TARGETS.includes(options.stake?.target)) return 'Enjeu invalide.';
    if (typeof options.stake.text !== 'string' || options.stake.text.length > MAX_STAKE_LENGTH)
      return `L'enjeu doit faire au plus ${MAX_STAKE_LENGTH} caractères.`;
  }
  return null;
};
