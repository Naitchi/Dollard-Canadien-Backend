import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MAX_USERNAME_LENGTH,
  ensureHost,
  findPlayerBySecret,
  getActivePlayer,
  getNextPlayerId,
  getPublicId,
  isValidUser,
  uniqueUsername,
} from '../../functions/players.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isValidUser', () => {
  it('accepts a user with a non-empty id and username', () => {
    expect(isValidUser({ id: 'secret', username: 'Alice' })).toBe(true);
  });

  it('rejects missing, empty or blank fields', () => {
    expect(isValidUser(undefined)).toBe(false);
    expect(isValidUser({ id: '', username: 'Alice' })).toBe(false);
    expect(isValidUser({ id: 'secret', username: '   ' })).toBe(false);
    expect(isValidUser({ id: 'secret' })).toBe(false);
    expect(isValidUser({ id: 42, username: 'Alice' })).toBe(false);
  });
});

describe('getPublicId', () => {
  it('is deterministic for the same game and secret (a rejoining player keeps their id)', () => {
    expect(getPublicId('game-1', 'secret-a')).toBe(getPublicId('game-1', 'secret-a'));
  });

  it('differs between games and between secrets', () => {
    const id = getPublicId('game-1', 'secret-a');
    expect(getPublicId('game-2', 'secret-a')).not.toBe(id);
    expect(getPublicId('game-1', 'secret-b')).not.toBe(id);
  });

  it('never contains the secret itself', () => {
    const id = getPublicId('game-1', 'secret-a');
    expect(id).not.toContain('secret-a');
    expect(id).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe('findPlayerBySecret', () => {
  const game = {
    players: [
      { _id: 'pub1', secret: 'secret1', username: 'alice' },
      { _id: 'pub2', secret: 'secret2', username: 'bob' },
    ],
  };

  it('returns the player owning the secret', () => {
    expect(findPlayerBySecret(game, 'secret2')).toBe(game.players[1]);
  });

  it('does not match on the public id', () => {
    expect(findPlayerBySecret(game, 'pub1')).toBeUndefined();
  });

  it('returns undefined for an unknown, empty or non-string secret', () => {
    expect(findPlayerBySecret(game, 'nope')).toBeUndefined();
    expect(findPlayerBySecret(game, '')).toBeUndefined();
    expect(findPlayerBySecret(game, undefined)).toBeUndefined();
    expect(findPlayerBySecret(game, { $ne: null })).toBeUndefined();
  });
});

describe('uniqueUsername', () => {
  const game = { players: [{ username: 'Bob' }, { username: 'Bob (2)' }, { username: 'alice' }] };

  it('keeps a free username, trimmed', () => {
    expect(uniqueUsername(game, '  Carol  ')).toBe('Carol');
  });

  it('suffixes a username already taken in the lobby, whatever its case', () => {
    expect(uniqueUsername(game, 'bob')).toBe('bob (3)');
    expect(uniqueUsername(game, 'ALICE')).toBe('ALICE (2)');
  });

  it('cuts usernames that are too long', () => {
    expect(uniqueUsername({ players: [] }, 'x'.repeat(500))).toHaveLength(MAX_USERNAME_LENGTH);
  });
});

describe('ensureHost', () => {
  const player = (id) => ({ _id: id, username: `name-${id}` });

  it('keeps the current host when they are in the lobby', () => {
    const game = {
      creatorId: 'c',
      host: { id: 'h', username: 'name-h' },
      players: [player('a'), player('h')],
    };
    ensureHost(game);
    expect(game.host).toEqual({ id: 'h', username: 'name-h' });
  });

  it('passes the role to the player who has been there the longest when the host left', () => {
    const game = {
      creatorId: 'h',
      host: { id: 'h', username: 'name-h' },
      players: [player('a'), player('b')],
    };
    ensureHost(game);
    expect(game.host).toEqual({ id: 'a', username: 'name-a' });
  });

  it('gives the role back to the creator when they return', () => {
    const game = {
      creatorId: 'c',
      host: { id: 'a', username: 'name-a' },
      players: [player('a'), player('c')],
    };
    ensureHost(game);
    expect(game.host).toEqual({ id: 'c', username: 'name-c' });
  });

  it('keeps the host of an empty lobby so they get it back on return', () => {
    const game = {
      creatorId: 'h',
      host: { id: 'h', username: 'name-h' },
      players: [],
    };
    ensureHost(game);
    expect(game.host).toEqual({ id: 'h', username: 'name-h' });
  });

  it('works for games created before creatorId existed', () => {
    const game = {
      creatorId: null,
      host: { id: 'gone', username: 'x' },
      players: [player('a')],
    };
    ensureHost(game);
    expect(game.host.id).toBe('a');
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
