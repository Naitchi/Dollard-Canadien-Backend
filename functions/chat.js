import crypto from 'crypto';

export const MAX_MESSAGE_LENGTH = 200;

/**
 * Cleans up a chat message sent by a client.
 *
 * @param {any} text - The text from the request body.
 * @returns {string | null} The trimmed text, or null if it's empty, too long or not text.
 */
export const normalizeMessage = (text) => {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
};

/**
 * Builds the chat message broadcast to the lobby.
 *
 * @param {Player} player - The author.
 * @param {string} text - The (already normalized) text.
 * @returns {{ id: string, playerId: string, username: string, text: string, sentAt: string }}
 * The message; its id lets clients ignore one they already have.
 */
export const createMessage = (player, text) => ({
  id: crypto.randomUUID(),
  playerId: player._id,
  username: player.username,
  text,
  sentAt: new Date().toISOString(),
});
