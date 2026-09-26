import { describe, it, expect } from 'vitest';
import { generateLobbyId, isValidLobbyId, validateOptions } from '../../functions/lobby.js';

describe('generateLobbyId / isValidLobbyId', () => {
  it('generates 22-character URL-safe ids that pass validation', () => {
    const id = generateLobbyId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(isValidLobbyId(id)).toBe(true);
  });

  it('never generates two ids that follow each other (unlike Mongo ObjectIds)', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateLobbyId));
    expect(ids.size).toBe(1000);
  });

  it('rejects anything that is not a lobby id, including old ObjectIds', () => {
    expect(isValidLobbyId('507f1f77bcf86cd799439011')).toBe(false);
    expect(isValidLobbyId('abc')).toBe(false);
    expect(isValidLobbyId('k3Jx9QzL0aB7/mN2+pR5tW')).toBe(false);
    expect(isValidLobbyId({ $ne: null })).toBe(false);
    expect(isValidLobbyId(undefined)).toBe(false);
  });
});

describe('validateOptions', () => {
  const valid = { maxHp: 30, maxPlayers: 4 };

  it('returns null for valid options', () => {
    expect(validateOptions(valid, 3)).toBeNull();
  });

  it('rejects maxHp that is not a positive integer within the limit', () => {
    for (const maxHp of [0, -5, 2.5, 1000, '30', NaN]) {
      expect(validateOptions({ ...valid, maxHp }, 1)).toEqual(expect.any(String));
    }
  });

  it('rejects maxPlayers below 2, above the limit, or not an integer', () => {
    for (const maxPlayers of [0, 1, 100, 3.5, '4']) {
      expect(validateOptions({ ...valid, maxPlayers }, 1)).toEqual(expect.any(String));
    }
  });

  it('rejects maxPlayers lower than the number of players already in the lobby', () => {
    expect(validateOptions({ ...valid, maxPlayers: 3 }, 4)).toContain('4 joueurs');
  });

  it('rejects missing options', () => {
    expect(validateOptions(undefined, 1)).toEqual(expect.any(String));
  });

  it('accepts a stake for the first loser, the losers or the winner', () => {
    for (const target of ['firstLoser', 'losers', 'winner']) {
      expect(validateOptions({ ...valid, stake: { target, text: 'payer sa tournée' } }, 1)).toBeNull();
    }
  });

  it('rejects an unknown stake target or a stake text that is too long', () => {
    expect(validateOptions({ ...valid, stake: { target: 'everyone', text: '' } }, 1)).toEqual(
      expect.any(String),
    );
    expect(
      validateOptions({ ...valid, stake: { target: 'winner', text: 'x'.repeat(101) } }, 1),
    ).toContain('100');
    expect(validateOptions({ ...valid, stake: { target: 'winner', text: 42 } }, 1)).toEqual(
      expect.any(String),
    );
  });
});
