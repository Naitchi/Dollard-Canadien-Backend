import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../models/Game.js', async () => (await import('../support/mocks.js')).gameModelMock());
vi.mock('../../pusher.js', async () => (await import('../support/mocks.js')).pusherMock());

import pusher from '../../pusher.js';
import { sendMessage } from '../../controllers/index.js';
import {
  VALID_ID,
  call,
  givenGame,
  makeGame,
  resetControllerMocks,
  user,
} from '../support/controllers.js';

beforeEach(resetControllerMocks);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendMessage', () => {
  it('broadcasts the message to the lobby, signed by the server with the author public id', async () => {
    givenGame(makeGame());

    const res = await call(sendMessage, {
      id: VALID_ID,
      // A client can't pretend to be someone else: the username comes from the game.
      user: { id: 'bob-secret', username: 'Not Bob' },
      text: '  gg  ',
    });

    expect(res.status).toHaveBeenCalledWith(201);
    const message = res.send.mock.calls[0][0];
    expect(message).toMatchObject({ playerId: 'pub-bob', username: 'bob', text: 'gg' });
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'chatMessage',
      message,
    );
  });

  it('works during the game and on the results screen too', async () => {
    givenGame(makeGame({ actif: 'pub-host', step: 'gameEnd' }));

    const res = await call(sendMessage, { id: VALID_ID, user: user('bob'), text: 'bien joué' });

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responds 403 when the author is not in the game', async () => {
    givenGame(makeGame());

    const res = await call(sendMessage, { id: VALID_ID, user: user('mallory'), text: 'coucou' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(pusher.trigger).not.toHaveBeenCalled();
  });

  it('responds 422 for an empty or too long message', async () => {
    givenGame(makeGame());

    for (const text of ['   ', 'x'.repeat(201), undefined]) {
      const res = await call(sendMessage, { id: VALID_ID, user: user('bob'), text });
      expect(res.status).toHaveBeenCalledWith(422);
    }
    expect(pusher.trigger).not.toHaveBeenCalled();
  });

  it('responds 404 for an unknown game', async () => {
    const res = await call(sendMessage, { id: 'nope', user: user('bob'), text: 'coucou' });

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
