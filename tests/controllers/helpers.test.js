import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../models/Game.js', async () => (await import('../support/mocks.js')).gameModelMock());
vi.mock('../../pusher.js', async () => (await import('../support/mocks.js')).pusherMock());

import mongoose from 'mongoose';
import Game from '../../models/Game.js';
import { endTurn, lockDices, readyUp } from '../../controllers/index.js';
import {
  VALID_ID,
  call,
  makeGame,
  resetControllerMocks,
  user,
} from '../support/controllers.js';

beforeEach(resetControllerMocks);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('common error handling', () => {
  it('responds 404 without querying the DB when the id is not a lobby id', async () => {
    for (const id of ['not-an-id', '507f1f77bcf86cd799439011', { $ne: null }]) {
      const res = await call(readyUp, { id, user: user('bob') });
      expect(res.status).toHaveBeenCalledWith(404);
    }
    expect(Game.findById).not.toHaveBeenCalled();
  });

  it('responds 404 when the game does not exist', async () => {
    Game.findById.mockResolvedValue(null);

    const res = await call(lockDices, { id: VALID_ID, user: user('bob'), lockedDices: [0] });

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responds 500 instead of hanging when the DB throws', async () => {
    Game.findById.mockRejectedValue(new Error('DB down'));

    const res = await call(endTurn, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Une erreur s'est produite");
  });

  it('reloads and replays the change when someone else modified the game in between', async () => {
    const stale = makeGame();
    stale.save.mockRejectedValueOnce(new mongoose.Error.VersionError({ _id: VALID_ID }, 1, []));
    const fresh = makeGame();
    Game.findById.mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);

    const res = await call(readyUp, { id: VALID_ID, user: user('bob') });

    expect(Game.findById).toHaveBeenCalledTimes(2);
    expect(fresh.players[1].ready).toBe(true);
    expect(fresh.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('gives up with a 500 after too many conflicting writes', async () => {
    Game.findById.mockImplementation(async () => {
      const game = makeGame();
      game.save.mockRejectedValue(new mongoose.Error.VersionError({ _id: VALID_ID }, 1, []));
      return game;
    });

    const res = await call(readyUp, { id: VALID_ID, user: user('bob') });

    expect(Game.findById).toHaveBeenCalledTimes(5);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
