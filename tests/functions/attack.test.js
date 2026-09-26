import { describe, it, expect, vi, afterEach } from 'vitest';
import { damageDistribution, getAttackResult, getDamage } from '../../functions/attack.js';
import { mockDiceSequence } from '../support/dice.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAttackResult', () => {
  it('stops as soon as a roll has zero matches (scripted, no reset)', () => {
    // First roll of 6 dice: two 6's -> 4 dice remain for next roll.
    // Second roll of 4 dice: zero 6's -> stop.
    mockDiceSequence(6, 6, 1, 2, 3, 4, /* second roll */ 1, 2, 3, 4);
    expect(getAttackResult(6)).toEqual([
      [6, 6, 1, 2, 3, 4],
      [1, 2, 3, 4],
    ]);
  });

  it('resets remainingDice to 6 when every die matches (scripted)', () => {
    // First roll of 6 dice: all six are 5's -> remainingDice hits 0 -> reset to 6.
    // Second roll of 6 dice: zero 5's -> stop.
    mockDiceSequence(5, 5, 5, 5, 5, 5, /* second roll */ 1, 2, 3, 4, 6, 1);
    expect(getAttackResult(5)).toEqual([
      [5, 5, 5, 5, 5, 5],
      [1, 2, 3, 4, 6, 1],
    ]);
  });

  it('always ends on a roll with zero occurrences of attackNumber (real RNG)', () => {
    const attackNumber = 4;
    const result = getAttackResult(attackNumber);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);

    for (const roll of result) {
      expect(Array.isArray(roll)).toBe(true);
      for (const value of roll) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    }

    const lastRoll = result[result.length - 1];
    const matchesInLastRoll = lastRoll.filter((value) => value === attackNumber).length;
    expect(matchesInLastRoll).toBe(0);
  });
});

describe('getDamage', () => {
  it('returns 0 for an empty results array', () => {
    expect(getDamage([], 5)).toBe(0);
  });

  it('counts matching dice across all rolls and multiplies by attackNumber', () => {
    const attackResults = [
      [6, 6, 1, 2, 3, 4],
      [1, 2, 3, 4],
    ];
    // Two 6's total -> 2 * 6 = 12.
    expect(getDamage(attackResults, 6)).toBe(12);
  });

  it('sums matches spread over multiple rolls', () => {
    const attackResults = [
      [3, 3, 3],
      [3, 1, 2],
    ];
    // Four 3's total -> 4 * 3 = 12.
    expect(getDamage(attackResults, 3)).toBe(12);
  });
});

describe('damageDistribution', () => {
  it('has a single target absorb all the damage', () => {
    const game = {
      players: [
        { _id: 'attacker', hp: 30, index: 0 },
        { _id: 't1', hp: 30, index: 1 },
      ],
    };
    const result = damageDistribution(game, 'attacker', 0, 10);
    expect(result).toBe(game);
    expect(game.players[0].hp).toBe(30);
    expect(game.players[1].hp).toBe(20);
  });

  it('spills overflow damage into the next target, clamping the dying target to exactly 0', () => {
    const game = {
      players: [
        { _id: 'attacker', hp: 30, index: 0 },
        { _id: 't1', hp: 5, index: 1 },
        { _id: 't2', hp: 30, index: 2 },
      ],
    };
    // validTargets = [t1, t2], number=0 -> targetIndex starts at t1.
    // t1 (hp 5) dies absorbing 5 damage, remaining 10 damage goes to t2.
    const result = damageDistribution(game, 'attacker', 0, 15);
    expect(result).toBe(game);
    expect(game.players[0].hp).toBe(30);
    expect(game.players[1].hp).toBe(0);
    expect(game.players[2].hp).toBe(20);
  });

  it('wraps targetIndex around after a target dies and the array shrinks', () => {
    const game = {
      players: [
        { _id: 'attacker', hp: 30, index: 0 },
        { _id: 't0', hp: 100, index: 1 },
        { _id: 't1', hp: 5, index: 2 },
        { _id: 't2', hp: 100, index: 3 },
      ],
    };
    // validTargets = [t0, t1, t2], number=1 -> targetIndex starts at t1 (index 1).
    // t1 (hp 5) dies absorbing 5 damage of the 12 total, leaving 7.
    // After splicing t1 out, validTargets = [t0, t2] (length 2); the pointer
    // increments from 1 to 2, which wraps (2 % 2 === 0) back to t0 instead of
    // continuing on to t2 - so t0 takes the remaining 7 damage and t2 is
    // skipped entirely.
    const result = damageDistribution(game, 'attacker', 1, 12);
    expect(result).toBe(game);
    expect(game.players[1].hp).toBe(93); // t0: 100 - 7
    expect(game.players[2].hp).toBe(0); // t1: died, clamped to 0
    expect(game.players[3].hp).toBe(100); // t2: untouched (skipped by the wrap)
  });

  it('lets hp go negative (no clamping) when only one valid target remains', () => {
    // Per the code, the branch condition is `target.hp >= dmgToDeal || validTargets.length == 1`,
    // so once a single target is left it always absorbs the full remaining
    // damage in one shot, even if that drives its hp below zero.
    const game = {
      players: [
        { _id: 'attacker', hp: 30, index: 0 },
        { _id: 'solo', hp: 5, index: 1 },
      ],
    };
    const result = damageDistribution(game, 'attacker', 0, 20);
    expect(result).toBe(game);
    expect(game.players[1].hp).toBe(-15);
  });

  it('does nothing (but still returns the game, consistent with every other branch) when there are no valid targets', () => {
    const game = {
      players: [
        { _id: 'attacker', hp: 30, index: 0 },
        { _id: 'dead', hp: 0, index: 1 },
      ],
    };
    const result = damageDistribution(game, 'attacker', 0, 10);
    expect(result).toBe(game);
    expect(game.players[0].hp).toBe(30);
    expect(game.players[1].hp).toBe(0);
  });
});
