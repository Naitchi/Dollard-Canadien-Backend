import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ACTION_TIMEOUT_MS,
  ANIMATION_GRACE_MS,
  ATTACK_BADGE_MS,
  ATTACK_ROUND_MS,
  DAMAGE_ANIMATION_MS,
  SCORE_ANIMATION_MS,
  TURN_TIMEOUT_MS,
  actionDeadline,
  advanceTurn,
  lockRemainingDices,
  recordEliminations,
  resolveTurn,
  resultAnimationDuration,
  startTurn,
} from '../../functions/turn.js';
import { mockDiceSequence } from '../support/dice.js';

afterEach(() => {
  vi.restoreAllMocks();
});

const NOW = 1_700_000_000_000;


const makeGame = (overrides = {}) => ({
  actif: 'a',
  step: 'none',
  turnDeadline: null,
  players: [
    { _id: 'a', index: 0, hp: 30, dices: [], lockedDices: [], attackDices: [] },
    { _id: 'b', index: 1, hp: 30, dices: [], lockedDices: [], attackDices: [] },
  ],
  ...overrides,
});

describe('resultAnimationDuration', () => {
  it('only counts the score animation at exactly 30 (nothing happens)', () => {
    expect(resultAnimationDuration([], 30)).toBe(SCORE_ANIMATION_MS);
  });

  it('adds the damage animation under 30', () => {
    expect(resultAnimationDuration([], 21)).toBe(SCORE_ANIMATION_MS + DAMAGE_ANIMATION_MS);
  });

  it('adds one round per attack roll plus the final damage badge', () => {
    expect(resultAnimationDuration([[1], [2]], 35)).toBe(
      SCORE_ANIMATION_MS + 2 * ATTACK_ROUND_MS + ATTACK_BADGE_MS,
    );
  });
});

describe('startTurn', () => {
  it('gives the turn to the player with 6 fresh dice, nothing locked and a new deadline', () => {
    const game = makeGame({ step: 'scoreAdditionAnimation' });
    game.players[1].lockedDices = [1, 2, 3, 4, 5, 6];
    game.players[1].attackDices = [[1]];

    startTurn(game, 'b', NOW);

    expect(game.actif).toBe('b');
    expect(game.step).toBe('none');
    expect(game.players[1].dices).toHaveLength(6);
    expect(game.players[1].lockedDices).toEqual([]);
    expect(game.players[1].attackDices).toEqual([]);
    expect(game.turnDeadline).toEqual(new Date(NOW + ACTION_TIMEOUT_MS));
    expect(game.turnLimit).toEqual(new Date(NOW + TURN_TIMEOUT_MS));
  });
});

describe('actionDeadline', () => {
  it('gives the active player ACTION_TIMEOUT_MS for their next action', () => {
    const game = makeGame({ turnLimit: new Date(NOW + TURN_TIMEOUT_MS) });
    expect(actionDeadline(game, NOW)).toEqual(new Date(NOW + ACTION_TIMEOUT_MS));
  });

  it('never goes past the limit of the whole turn (no stalling forever)', () => {
    const turnLimit = new Date(NOW + 10_000);
    expect(actionDeadline(makeGame({ turnLimit }), NOW)).toEqual(turnLimit);
  });

  it('falls back to the action timeout for games without a turn limit', () => {
    expect(actionDeadline(makeGame({ turnLimit: null }), NOW)).toEqual(
      new Date(NOW + ACTION_TIMEOUT_MS),
    );
  });
});

describe('resolveTurn', () => {
  it('removes the missing points from the active player under 30', () => {
    const game = makeGame();
    game.players[0].lockedDices = [1, 2, 3, 4, 5, 6]; // 21

    resolveTurn(game, NOW);

    expect(game.players[0].hp).toBe(30 - 9);
    expect(game.players[1].hp).toBe(30);
    expect(game.step).toBe('scoreAdditionAnimation');
    expect(game.turnDeadline).toEqual(
      new Date(NOW + SCORE_ANIMATION_MS + DAMAGE_ANIMATION_MS + ANIMATION_GRACE_MS),
    );
  });

  it('records the active player as eliminated when the HP loss kills them', () => {
    const game = makeGame({ eliminated: [] });
    game.players[0].hp = 5;
    game.players[0].lockedDices = [1, 1, 1, 1, 1, 1]; // 6 -> -24 HP

    resolveTurn(game, NOW);

    expect(game.eliminated).toEqual(['a']);
  });

  it('is neutral at exactly 30', () => {
    const game = makeGame();
    game.players[0].lockedDices = [5, 5, 5, 5, 5, 5];

    resolveTurn(game, NOW);

    expect(game.players[0].hp).toBe(30);
    expect(game.players[0].attackDices).toEqual([]);
  });

  it('attacks another player above 30 and waits for the attack animation too', () => {
    const game = makeGame();
    game.players[0].lockedDices = [6, 6, 6, 6, 6, 6]; // 36 -> attack number 6
    // First attack roll: one 6 (5 dice left), second roll: no 6 -> stop.
    mockDiceSequence(6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

    resolveTurn(game, NOW);

    expect(game.players[0].attackDices).toEqual([
      [6, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    expect(game.players[0].hp).toBe(30);
    expect(game.players[1].hp).toBe(24);
    expect(game.players[0].dices).toEqual([]);
    expect(game.turnDeadline).toEqual(
      new Date(
        NOW + SCORE_ANIMATION_MS + 2 * ATTACK_ROUND_MS + ATTACK_BADGE_MS + ANIMATION_GRACE_MS,
      ),
    );
  });
});

describe('recordEliminations', () => {
  it('records newly dead players once, in the order they died', () => {
    const game = makeGame({ eliminated: ['c'] });
    game.players.push({ _id: 'c', hp: -2 });
    game.players[1].hp = 0;

    recordEliminations(game);
    recordEliminations(game);

    expect(game.eliminated).toEqual(['c', 'b']);
  });

  it('puts first the player who went the furthest below 0 when several die at once', () => {
    const game = makeGame();
    game.players.push({ _id: 'c', hp: 5 });
    game.players[1].hp = -1;
    game.players[2].hp = -7;

    recordEliminations(game);

    expect(game.eliminated).toEqual(['c', 'b']);
  });
});

describe('lockRemainingDices', () => {
  it('moves every die the active player still has into the locked dice', () => {
    const game = makeGame();
    game.players[0].lockedDices = [6, 6];
    game.players[0].dices = [1, 2, 3, 4];

    lockRemainingDices(game);

    expect(game.players[0].lockedDices).toEqual([6, 6, 1, 2, 3, 4]);
    expect(game.players[0].dices).toEqual([]);
  });
});

describe('advanceTurn', () => {
  it('starts the next alive player turn', () => {
    const game = makeGame({ step: 'scoreAdditionAnimation' });

    advanceTurn(game, NOW);

    expect(game.actif).toBe('b');
    expect(game.step).toBe('none');
    expect(game.players[1].dices).toHaveLength(6);
  });

  it('ends the game when only one player is left alive', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const game = makeGame({ step: 'scoreAdditionAnimation', turnDeadline: new Date(NOW) });
    game.players[1].hp = 0;

    advanceTurn(game, NOW);

    expect(game.step).toBe('gameEnd');
    expect(game.actif).toBe('a');
    expect(game.turnDeadline).toBeNull();
    expect(game.turnLimit).toBeNull();
  });
});
