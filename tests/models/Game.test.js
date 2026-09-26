import { describe, it, expect } from 'vitest';
import Game from '../../models/Game.js';

// Uses the real mongoose model (no DB connection needed to build documents
// and serialize them), because the whole point is to check what actually
// leaves the server.
const makeGame = () =>
  new Game({
    host: { id: 'pub-1', username: 'Alice' },
    players: [
      { _id: 'pub-1', secret: 'secret-1', username: 'Alice' },
      { _id: 'pub-2', secret: 'secret-2', username: 'Bob' },
    ],
  });

describe('Game model serialization', () => {
  it('never includes the players secrets when a game is serialized', () => {
    const json = JSON.stringify(makeGame());
    expect(json).not.toContain('secret-1');
    expect(json).not.toContain('secret-2');
    expect(json).toContain('pub-1');
  });

  it('never includes the secrets when only the players array is serialized (updatePlayers event)', () => {
    const json = JSON.stringify(makeGame().players);
    expect(json).not.toContain('secret-1');
  });

  it('never includes the secrets when the game is nested in a response', () => {
    const json = JSON.stringify({ game: makeGame(), me: 'pub-1' });
    expect(json).not.toContain('secret-1');
  });

  it('keeps the secrets available server side', () => {
    expect(makeGame().players[0].secret).toBe('secret-1');
  });

  it('gives every new game a random, unguessable lobby id', () => {
    const [a, b] = [new Game()._id, new Game()._id];
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });

  it('starts with no stake (for the first loser) and nobody eliminated', () => {
    const game = new Game();
    expect(game.stake.target).toBe('firstLoser');
    expect(game.stake.text).toBe('');
    expect([...game.eliminated]).toEqual([]);
  });

  it('makes every game private by default (reachable only through its link)', () => {
    expect(new Game().private).toBe(true);
  });

  it('stores `private` as a real boolean (a "false" string used to be truthy on the front)', () => {
    expect(new Game({ private: false }).private).toBe(false);
    expect(new Game({ private: 'false' }).private).toBe(false);
    expect(JSON.parse(JSON.stringify(new Game({ private: true }))).private).toBe(true);
  });
});
