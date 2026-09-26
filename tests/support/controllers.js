import { vi } from 'vitest';
import Game from '../../models/Game.js';
import pusher from '../../pusher.js';

// Fixtures for the controller tests. The test files mock models/Game.js and
// pusher.js (see ./mocks.js) before importing this module.

// A lobby id in the right format (22 URL-safe characters): the controllers
// reject anything else before touching the DB.
export const VALID_ID = 'k3Jx9QzL0aB7_mN2-pR5tW';

export const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

// The client sends its SECRET as `user.id`; everybody else only ever sees
// the public `_id` of the player.
export const user = (name) => ({ id: `${name}-secret`, username: name });

export const makePlayer = (name, overrides = {}) => ({
  _id: `pub-${name}`,
  secret: `${name}-secret`,
  username: name,
  ready: false,
  hp: 30,
  index: 0,
  dices: [],
  lockedDices: [],
  attackDices: [],
  ...overrides,
});

// A stand-in for a mongoose document: plain data plus a mocked save().
export const makeGame = (overrides = {}) => ({
  _id: VALID_ID,
  private: false,
  maxHp: 30,
  maxPlayers: 99,
  host: { id: 'pub-host', username: 'host' },
  creatorId: 'pub-host',
  stake: { target: 'firstLoser', text: '' },
  eliminated: [],
  actif: null,
  step: 'none',
  turnDeadline: null,
  players: [makePlayer('host', { ready: true, index: 0 }), makePlayer('bob', { index: 1 })],
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// A game in progress where it's `host`'s turn.
export const makeStartedGame = (overrides = {}) =>
  makeGame({ actif: 'pub-host', turnDeadline: new Date(Date.now() + 60_000), ...overrides });

export const givenGame = (game) => {
  Game.findById.mockResolvedValue(game);
  return game;
};

export const call = async (controller, body) => {
  const res = mockRes();
  await controller({ body }, res);
  return res;
};

// For beforeEach: fresh mocks for every test, and quiet logs.
export const resetControllerMocks = () => {
  Game.mockClear();
  Game.findById.mockReset();
  pusher.trigger.mockReset();
  pusher.trigger.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
};
