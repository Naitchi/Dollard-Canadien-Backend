import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dicesRoll,
  getActivePlayer,
  getPlayerById,
  deletePlayersIds,
  getValuesByIndex,
  sumArray,
  getAttackResult,
  getDamage,
  getNextPlayerId,
  damageDistribution,
} from '../functions/functions.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// Converts a desired dice face (1-6) into the Math.random() value that
// Math.floor(random * 6) + 1 will turn into that face.
const valueToRandom = (value) => (value - 0.5) / 6;

// Makes Math.random() return a scripted sequence of values, one per call,
// expressed as the dice faces (1-6) that should come out of dicesRoll().
const mockDiceSequence = (...diceValues) => {
  const queue = diceValues.map(valueToRandom);
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    if (i >= queue.length) {
      throw new Error(
        `Math.random called more times (${i + 1}) than the scripted sequence provided (${queue.length})`,
      );
    }
    return queue[i++];
  });
};

describe('dicesRoll', () => {
  it('returns an array of the requested length', () => {
    expect(dicesRoll(6)).toHaveLength(6);
    expect(dicesRoll(10)).toHaveLength(10);
  });

  it('returns an empty array for n=0', () => {
    expect(dicesRoll(0)).toEqual([]);
  });

  it('produces only integers within [1,6] over many rolls (real RNG)', () => {
    const results = dicesRoll(1000);
    expect(results).toHaveLength(1000);
    for (const value of results) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it('maps Math.random() boundaries to the correct dice faces', () => {
    mockDiceSequence(1, 2, 3, 4, 5, 6);
    expect(dicesRoll(6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('getActivePlayer', () => {
  it('finds the player matching game.actif using loose equality', () => {
    const game = {
      actif: 5,
      players: [{ _id: '5' }, { _id: 6 }],
    };
    // '5' == 5 is true, so the first player should be matched.
    expect(getActivePlayer(game)).toEqual({ _id: '5' });
  });

  it('returns undefined when no player matches', () => {
    const game = {
      actif: 'nope',
      players: [{ _id: 'a' }, { _id: 'b' }],
    };
    expect(getActivePlayer(game)).toBeUndefined();
  });
});

describe('getPlayerById', () => {
  const game = {
    players: [
      { _id: 'id1', username: 'alice' },
      { _id: 'id2', username: 'bob' },
    ],
  };

  it('returns the index when both id and username match', () => {
    expect(getPlayerById(game, { id: 'id1', username: 'alice' })).toBe(0);
    expect(getPlayerById(game, { id: 'id2', username: 'bob' })).toBe(1);
  });

  it('returns -1 when the id matches but the username does not', () => {
    expect(getPlayerById(game, { id: 'id1', username: 'wrong-name' })).toBe(-1);
  });

  it('returns -1 when the username matches but the id does not', () => {
    expect(getPlayerById(game, { id: 'wrong-id', username: 'alice' })).toBe(-1);
  });

  it('returns -1 when neither matches', () => {
    expect(getPlayerById(game, { id: 'nope', username: 'nope' })).toBe(-1);
  });
});

describe('deletePlayersIds', () => {
  it('strips _id from every player and returns the mutated game', () => {
    const game = {
      players: [
        { _id: 'a', username: 'alice' },
        { _id: 'b', username: 'bob' },
      ],
    };
    const result = deletePlayersIds(game);
    expect(result).toBe(game);
    expect(result.players[0]).not.toHaveProperty('_id');
    expect(result.players[1]).not.toHaveProperty('_id');
    expect(result.players[0].username).toBe('alice');
    expect(result.players[1].username).toBe('bob');
  });

  it('returns the game unchanged when game.players is not an array', () => {
    const game = { players: undefined };
    const result = deletePlayersIds(game);
    expect(result).toBe(game);
    expect(result.players).toBeUndefined();
  });

  it('returns the game unchanged when game.players is missing entirely', () => {
    const game = {};
    const result = deletePlayersIds(game);
    expect(result).toBe(game);
    expect(result.players).toBeUndefined();
  });
});

describe('getValuesByIndex', () => {
  it('returns the values at the requested indexes', () => {
    expect(getValuesByIndex(['a', 'b', 'c'], [0, 2])).toEqual(['a', 'c']);
    expect(getValuesByIndex([10, 20, 30], [1, 1, 0])).toEqual([20, 20, 10]);
  });

  it('throws when arrayOfValues is not an array', () => {
    expect(() => getValuesByIndex('not-an-array', [0])).toThrow(
      'Les deux arguments doivent être des tableaux',
    );
  });

  it('throws when arrayOfIndexes is not an array', () => {
    expect(() => getValuesByIndex(['a'], 'not-an-array')).toThrow(
      'Les deux arguments doivent être des tableaux',
    );
  });

  it('throws on a negative index', () => {
    expect(() => getValuesByIndex(['a', 'b'], [-1])).toThrow('Index hors des limites');
  });

  it('throws on an index that is too large', () => {
    expect(() => getValuesByIndex(['a', 'b'], [5])).toThrow('Index hors des limites');
  });
});

describe('sumArray', () => {
  it('sums the values of the array', () => {
    expect(sumArray([1, 2, 3])).toBe(6);
    expect(sumArray([5])).toBe(5);
  });

  it('returns 0 for an empty array', () => {
    expect(sumArray([])).toBe(0);
  });

  it('throws when the input is not an array', () => {
    expect(() => sumArray('not-an-array')).toThrow("L'entrée doit être un tableau");
  });

  it('throws when the array contains a non-number element', () => {
    expect(() => sumArray([1, 'x', 3])).toThrow('Valeur non numérique trouvée');
  });
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

describe('getNextPlayerId', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the next alive player in round-robin order', () => {
    const game = {
      actif: 'a',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 10 },
        { _id: 'c', hp: 10 },
      ],
    };
    expect(getNextPlayerId(game)).toBe('b');
  });

  it('wraps around from the last player back to the first', () => {
    const game = {
      actif: 'c',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 10 },
        { _id: 'c', hp: 10 },
      ],
    };
    expect(getNextPlayerId(game)).toBe('a');
  });

  it('returns null when only one player has hp > 0', () => {
    const game = {
      actif: 'a',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 0 },
      ],
    };
    expect(getNextPlayerId(game)).toBeNull();
  });

  it('skips dead players in the middle of the rotation', () => {
    const game = {
      actif: 'a',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 0 },
        { _id: 'c', hp: 10 },
      ],
    };
    expect(getNextPlayerId(game)).toBe('c');
  });

  it('still finds the anchor point when the active player is the one who just died', () => {
    const game = {
      actif: 'b',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 0 }, // active, but dead
        { _id: 'c', hp: 10 },
      ],
    };
    expect(getNextPlayerId(game)).toBe('c');
  });

  it('returns null when the active player cannot be found in the filtered list', () => {
    const game = {
      actif: 'does-not-exist',
      players: [
        { _id: 'a', hp: 10 },
        { _id: 'b', hp: 10 },
      ],
    };
    expect(getNextPlayerId(game)).toBeNull();
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
