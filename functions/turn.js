import { damageDistribution, getAttackResult, getDamage } from './attack.js';
import { dicesRoll, sumArray } from './dice.js';
import { getActivePlayer, getNextPlayerId } from './players.js';

// Temps laissé au joueur actif pour chaque action (lancer, verrouiller)
export const ACTION_TIMEOUT_MS = 45_000;
// ...et pour son tour entier, quel que soit le nombre d'actions.
export const TURN_TIMEOUT_MS = 120_000;

// Durées des animations de résultat côté front. Doivent rester synchronisées
// avec DicesResultsAnimation (dernier timeout), AttackAnimation
// (ROUND_DELAY_MS / FINAL_BADGE_DELAY_MS) et DamageAnimation (DURATION_MS).
export const SCORE_ANIMATION_MS = 6_000;
export const ATTACK_ROUND_MS = 2_800;
export const ATTACK_BADGE_MS = 2_000;
export const DAMAGE_ANIMATION_MS = 2_500;

// Marge ajoutée à la durée des animations avant qu'un autre joueur puisse
// passer le tour : latence Pusher, onglets en arrière-plan ralentis, etc.
export const ANIMATION_GRACE_MS = 10_000;

// Étapes pendant lesquelles le joueur actif n'a pas encore fini de verrouiller ses dés.
export const PLAYING_STEPS = ['none', 'dices', 'lockAnimation'];

/**
 * Computes how long the result animations of a turn last on the front: the
 * score, then either the attack or the damage taken under 30.
 *
 * @param {number[][]} attackDices - The attack rolls of the turn (empty if no attack).
 * @param {number} score - The sum of the 6 locked dice.
 * @returns {number} The duration in milliseconds.
 */
export const resultAnimationDuration = (attackDices, score) => {
  if (attackDices.length > 0) {
    return SCORE_ANIMATION_MS + attackDices.length * ATTACK_ROUND_MS + ATTACK_BADGE_MS;
  }
  return SCORE_ANIMATION_MS + (score < 30 ? DAMAGE_ANIMATION_MS : 0);
};

/**
 * Computes the deadline for the active player's next action: ACTION_TIMEOUT_MS
 * from now, but never past the limit of the whole turn.
 *
 * @param {Game} game - The game (its `turnLimit` is read).
 * @param {number} now - The current timestamp.
 * @returns {Date} The deadline.
 */
export const actionDeadline = (game, now = Date.now()) => {
  const deadline = now + ACTION_TIMEOUT_MS;
  if (!game.turnLimit) return new Date(deadline);
  return new Date(Math.min(deadline, new Date(game.turnLimit).getTime()));
};

/**
 * Gives the turn to a player: fresh dice, nothing locked, new deadline.
 *
 * @param {Game} game - The game to update (mutated).
 * @param {string} playerId - The public id of the player whose turn starts.
 * @param {number} now - The current timestamp.
 */
export const startTurn = (game, playerId, now = Date.now()) => {
  game.actif = playerId;
  game.step = 'none';
  const player = getActivePlayer(game);
  player.attackDices = [];
  player.lockedDices = [];
  player.dices = dicesRoll(6);
  game.turnLimit = new Date(now + TURN_TIMEOUT_MS);
  game.turnDeadline = actionDeadline(game, now);
};

/**
 * Adds the players who just died to `game.eliminated`, so that the first one
 * in that list is the first loser. Players dying during the same turn are
 * ordered by how far below 0 HP they went.
 *
 * @param {Game} game - The game to update (mutated).
 */
export const recordEliminations = (game) => {
  if (!game.eliminated) game.eliminated = [];
  const newlyDead = game.players
    .filter((player) => player.hp <= 0 && !game.eliminated.includes(player._id))
    .sort((a, b) => a.hp - b.hp);
  game.eliminated.push(...newlyDead.map((player) => player._id));
};

/**
 * Resolves the active player's turn once their 6 dice are locked: HP loss
 * under 30, nothing at exactly 30, an attack above 30.
 *
 * @param {Game} game - The game to update (mutated).
 * @param {number} now - The current timestamp.
 */
export const resolveTurn = (game, now = Date.now()) => {
  const activePlayer = getActivePlayer(game);
  const score = sumArray(activePlayer.lockedDices);
  if (score <= 30) {
    activePlayer.hp -= 30 - score;
  } else {
    const attack = score - 30;

    const attackResult = getAttackResult(attack);
    activePlayer.attackDices = attackResult;
    const totalDamage = getDamage(attackResult, attack);
    damageDistribution(game, game.actif, attack, totalDamage);
  }
  activePlayer.dices = [];
  recordEliminations(game);

  game.step = 'scoreAdditionAnimation';
  game.turnDeadline = new Date(
    now + resultAnimationDuration(activePlayer.attackDices, score) + ANIMATION_GRACE_MS,
  );
};

/**
 * Locks every die the active player still has, e.g. when they ran out of time.
 *
 * @param {Game} game - The game to update (mutated).
 */
export const lockRemainingDices = (game) => {
  const activePlayer = getActivePlayer(game);
  activePlayer.lockedDices.push(...activePlayer.dices);
  activePlayer.dices = [];
};

/**
 * Passes the turn to the next alive player, or ends the game if only one is left.
 *
 * @param {Game} game - The game to update (mutated).
 * @param {number} now - The current timestamp.
 */
export const advanceTurn = (game, now = Date.now()) => {
  const nextPlayerId = getNextPlayerId(game);
  if (!nextPlayerId) {
    game.step = 'gameEnd';
    game.turnDeadline = null;
    game.turnLimit = null;
    return;
  }
  startTurn(game, nextPlayerId, now);
};
