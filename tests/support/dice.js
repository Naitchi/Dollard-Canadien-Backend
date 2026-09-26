import crypto from 'crypto';
import { vi } from 'vitest';

// Makes the dice RNG (crypto.randomInt) return a scripted sequence of dice
// faces (1-6), one per die rolled by dicesRoll().
export const mockDiceSequence = (...diceValues) => {
  let i = 0;
  vi.spyOn(crypto, 'randomInt').mockImplementation(() => {
    if (i >= diceValues.length) {
      throw new Error(
        `crypto.randomInt called more times (${i + 1}) than the scripted sequence provided (${diceValues.length})`,
      );
    }
    return diceValues[i++];
  });
};
