import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  dicesRoll,
  getValuesByIndex,
  isValidDiceSelection,
  sumArray,
} from '../../functions/dice.js';
import { mockDiceSequence } from '../support/dice.js';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('draws every die from the cryptographic RNG, never from Math.random()', () => {
    const randomInt = vi.spyOn(crypto, 'randomInt');
    const mathRandom = vi.spyOn(Math, 'random');

    dicesRoll(6);

    expect(randomInt).toHaveBeenCalledTimes(6);
    expect(randomInt).toHaveBeenCalledWith(1, 7);
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('returns the faces drawn, in order', () => {
    mockDiceSequence(1, 2, 3, 4, 5, 6);
    expect(dicesRoll(6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('isValidDiceSelection', () => {
  it('accepts distinct in-range integer indexes', () => {
    expect(isValidDiceSelection([0], 6)).toBe(true);
    expect(isValidDiceSelection([5, 0, 2], 6)).toBe(true);
  });

  it('rejects an empty selection (rerolling without keeping a die)', () => {
    expect(isValidDiceSelection([], 6)).toBe(false);
  });

  it('rejects the same die selected several times', () => {
    expect(isValidDiceSelection([0, 0, 0, 0, 0, 0], 6)).toBe(false);
  });

  it('rejects out-of-range or non-integer indexes', () => {
    expect(isValidDiceSelection([3], 3)).toBe(false);
    expect(isValidDiceSelection([-1], 6)).toBe(false);
    expect(isValidDiceSelection([1.5], 6)).toBe(false);
    expect(isValidDiceSelection(['0'], 6)).toBe(false);
  });

  it('rejects a non-array', () => {
    expect(isValidDiceSelection(undefined, 6)).toBe(false);
    expect(isValidDiceSelection('0,1', 6)).toBe(false);
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
