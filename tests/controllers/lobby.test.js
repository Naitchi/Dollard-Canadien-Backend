import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../models/Game.js', async () => (await import('../support/mocks.js')).gameModelMock());
vi.mock('../../pusher.js', async () => (await import('../support/mocks.js')).pusherMock());

import Game from '../../models/Game.js';
import pusher from '../../pusher.js';
import {
  addAPlayer,
  changeOptions,
  createALobby,
  getALobby,
  readyUp,
  removeAPlayer,
  restartGame,
  startGame,
} from '../../controllers/index.js';
import { getPublicId } from '../../functions/players.js';
import {
  VALID_ID,
  call,
  givenGame,
  makeGame,
  makePlayer,
  makeStartedGame,
  mockRes,
  resetControllerMocks,
  user,
} from '../support/controllers.js';

beforeEach(resetControllerMocks);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createALobby', () => {
  it('creates the game with the host as first ready player, identified by a public id', async () => {
    const res = await call(createALobby, { user: user('host') });

    const me = getPublicId('mockedNewGameId', 'host-secret');
    expect(res.status).toHaveBeenCalledWith(201);
    const { game, me: returnedMe } = res.send.mock.calls[0][0];
    expect(returnedMe).toBe(me);
    expect(me).not.toBe('host-secret');
    expect(game.host).toEqual({ id: me, username: 'host' });
    expect(game.creatorId).toBe(me);
    expect(game.players).toEqual([
      { _id: me, secret: 'host-secret', username: 'host', ready: true, hp: 30, index: 0 },
    ]);
    expect(game.save).toHaveBeenCalled();
  });

  it('ignores a `private` flag from the client (public lobbies do not exist for now)', async () => {
    await call(createALobby, { private: false, user: user('host') });

    expect(Game).toHaveBeenCalledWith();
  });

  it('responds 400 when the user is invalid', async () => {
    const res = await call(createALobby, { user: { id: '', username: 'x' } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Game).not.toHaveBeenCalled();
  });

  it('responds 500 when save() rejects', async () => {
    Game.mockImplementationOnce((data) => ({
      _id: 'mockedNewGameId',
      maxHp: 30,
      players: [],
      ...data,
      save: vi.fn().mockRejectedValue(new Error('DB down')),
    }));

    const res = await call(createALobby, { user: user('host') });

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getALobby', () => {
  const get = async (secret) => {
    const res = mockRes();
    await getALobby(
      {
        params: { id: VALID_ID },
        get: (header) => (header.toLowerCase() === 'x-player-secret' ? secret : undefined),
      },
      res,
    );
    return res;
  };

  it('returns the game and the public id of the requesting player', async () => {
    const game = givenGame(makeGame());

    const res = await get('bob-secret');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ game, me: 'pub-bob', serverTime: expect.any(Number) });
  });

  it('returns me = null when the requester is not in the game', async () => {
    const game = givenGame(makeGame());

    const res = await get(undefined);

    expect(res.send).toHaveBeenCalledWith({ game, me: null, serverTime: expect.any(Number) });
  });
});

describe('changeOptions', () => {
  const options = { maxHp: 50, maxPlayers: 4 };

  it('updates the options, triggers pusher and responds 200', async () => {
    const game = givenGame(makeGame());

    const res = await call(changeOptions, { id: VALID_ID, user: user('host'), options });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game).toMatchObject(options);
    expect(game.save).toHaveBeenCalled();
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('saves the stake, trimmed', async () => {
    const game = givenGame(makeGame());

    await call(changeOptions, {
      id: VALID_ID,
      user: user('host'),
      options: { ...options, stake: { target: 'losers', text: '  payer sa tournée  ' } },
    });

    expect(game.stake).toEqual({ target: 'losers', text: 'payer sa tournée' });
  });

  it('keeps the stake when the options do not include it', async () => {
    const game = givenGame(makeGame({ stake: { target: 'winner', text: 'choisir la musique' } }));

    await call(changeOptions, { id: VALID_ID, user: user('host'), options });

    expect(game.stake).toEqual({ target: 'winner', text: 'choisir la musique' });
  });

  it('responds 403 when the requester is not the host', async () => {
    const game = givenGame(makeGame());

    const res = await call(changeOptions, { id: VALID_ID, user: user('bob'), options });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(game.save).not.toHaveBeenCalled();
  });

  it('responds 403 when someone uses the host PUBLIC id as if it were their secret', async () => {
    givenGame(makeGame());

    const res = await call(changeOptions, {
      id: VALID_ID,
      user: { id: 'pub-host', username: 'host' },
      options,
    });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 when the game has already started', async () => {
    givenGame(makeStartedGame());

    const res = await call(changeOptions, { id: VALID_ID, user: user('host'), options });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responds 422 with the reason when the options are invalid', async () => {
    const game = givenGame(makeGame());

    const res = await call(changeOptions, {
      id: VALID_ID,
      user: user('host'),
      options: { ...options, maxHp: 0 },
    });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('points de vie'));
    expect(game.save).not.toHaveBeenCalled();
  });
});

describe('addAPlayer', () => {
  it('adds the player with a public id, the lobby HP and ready = false', async () => {
    const game = givenGame(makeGame({ maxHp: 50 }));

    const res = await call(addAPlayer, { id: VALID_ID, user: user('carol') });

    const me = getPublicId(VALID_ID, 'carol-secret');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith({ game, me });
    expect(game.players[2]).toEqual({
      _id: me,
      secret: 'carol-secret',
      username: 'carol',
      ready: false,
      hp: 50,
      index: 2,
    });
    expect(game.host.id).toBe('pub-host');
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('renames a player whose username is already taken in the lobby', async () => {
    const game = givenGame(makeGame());

    await call(addAPlayer, { id: VALID_ID, user: { id: 'mallory-secret', username: ' BOB ' } });

    expect(game.players[2].username).toBe('BOB (2)');
  });

  it('does not add the same player twice', async () => {
    const game = givenGame(makeGame());

    const res = await call(addAPlayer, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ game, me: 'pub-bob' });
    expect(game.players).toHaveLength(2);
    expect(pusher.trigger).not.toHaveBeenCalled();
  });

  it('gives the host role back to the creator when they return (e.g. after a refresh)', async () => {
    const creatorId = getPublicId(VALID_ID, 'host-secret');
    const game = givenGame(
      makeGame({
        creatorId,
        host: { id: 'pub-bob', username: 'bob' }, // transmitted while they were away
        players: [makePlayer('bob')],
      }),
    );

    await call(addAPlayer, { id: VALID_ID, user: user('host') });

    expect(game.host).toEqual({ id: creatorId, username: 'host' });
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('makes the first player to join an empty lobby its host', async () => {
    const game = givenGame(makeGame({ players: [] }));

    await call(addAPlayer, { id: VALID_ID, user: user('carol') });

    expect(game.host.id).toBe(getPublicId(VALID_ID, 'carol-secret'));
  });

  it('responds 409 when the lobby is full', async () => {
    const game = givenGame(makeGame({ maxPlayers: 2 }));

    const res = await call(addAPlayer, { id: VALID_ID, user: user('carol') });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith('Le salon est plein.');
    expect(game.players).toHaveLength(2);
  });

  it('responds 409 when the game has already started', async () => {
    givenGame(makeStartedGame());

    const res = await call(addAPlayer, { id: VALID_ID, user: user('carol') });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responds 400 when the user is invalid', async () => {
    const res = await call(addAPlayer, { id: VALID_ID, user: { id: 'x', username: '' } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('removeAPlayer', () => {
  const threePlayers = () =>
    makeGame({
      players: [
        makePlayer('host', { ready: true, index: 0 }),
        makePlayer('bob', { index: 1 }),
        makePlayer('carol', { index: 2 }),
      ],
    });

  it('lets the host kick another player, reindexing the others', async () => {
    const game = givenGame(threePlayers());

    const res = await call(removeAPlayer, { id: VALID_ID, user: user('host'), targetId: 'pub-bob' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.players.map((player) => [player._id, player.index])).toEqual([
      ['pub-host', 0],
      ['pub-carol', 1],
    ]);
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('passes the host role on when the host leaves, so the game can still be started', async () => {
    const game = givenGame(threePlayers());

    await call(removeAPlayer, { id: VALID_ID, user: user('host'), targetId: 'pub-host' });

    expect(game.host).toEqual({ id: 'pub-bob', username: 'bob' });

    // bob can now start the game (once carol is ready)
    game.players[1].ready = true;
    const res = await call(startGame, { id: VALID_ID, user: user('bob') });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('lets a player leave by themselves', async () => {
    const game = givenGame(threePlayers());

    const res = await call(removeAPlayer, { id: VALID_ID, user: user('bob'), targetId: 'pub-bob' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.players.map((player) => player._id)).toEqual(['pub-host', 'pub-carol']);
  });

  it('responds 403 when a non-host player tries to kick someone else', async () => {
    const game = givenGame(threePlayers());

    const res = await call(removeAPlayer, {
      id: VALID_ID,
      user: user('bob'),
      targetId: 'pub-carol',
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(game.players).toHaveLength(3);
  });

  it('responds 403 when the requester is not in the game', async () => {
    givenGame(threePlayers());

    const res = await call(removeAPlayer, {
      id: VALID_ID,
      user: user('mallory'),
      targetId: 'pub-bob',
    });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 404 when the target does not exist', async () => {
    givenGame(threePlayers());

    const res = await call(removeAPlayer, { id: VALID_ID, user: user('host'), targetId: 'nope' });

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responds 409 once the game has started', async () => {
    givenGame(makeStartedGame());

    const res = await call(removeAPlayer, { id: VALID_ID, user: user('bob'), targetId: 'pub-bob' });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('readyUp', () => {
  it('toggles the ready flag of the requesting player', async () => {
    const game = givenGame(makeGame());

    const res = await call(readyUp, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.players[1].ready).toBe(true);
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'updatePlayers',
      game.players,
    );
  });

  it('responds 403 when the requester is not in the game', async () => {
    givenGame(makeGame());

    const res = await call(readyUp, { id: VALID_ID, user: user('mallory') });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 once the game has started', async () => {
    givenGame(makeStartedGame());

    const res = await call(readyUp, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('startGame', () => {
  it('starts the game: everyone at maxHp, first player active with 6 dice and a deadline', async () => {
    const game = givenGame(
      makeGame({
        maxHp: 50,
        players: [
          makePlayer('host', { ready: true, index: 7 }),
          makePlayer('bob', { ready: true, index: 7 }),
        ],
      }),
    );

    const res = await call(startGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(game.actif).toBe('pub-host');
    expect(game.step).toBe('none');
    expect(game.players.map((player) => player.hp)).toEqual([50, 50]);
    expect(game.players.map((player) => player.index)).toEqual([0, 1]);
    expect(game.players[0].dices).toHaveLength(6);
    expect(game.turnDeadline.getTime()).toBeGreaterThan(Date.now());
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('does not require the host to be flagged ready', async () => {
    givenGame(
      makeGame({
        players: [makePlayer('host', { ready: false }), makePlayer('bob', { ready: true })],
      }),
    );

    const res = await call(startGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('responds 409 when not everyone is ready', async () => {
    givenGame(makeGame());

    const res = await call(startGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responds 422 when there are not enough players', async () => {
    givenGame(makeGame({ players: [makePlayer('host', { ready: true })] }));

    const res = await call(startGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('responds 403 when the requester is not the host', async () => {
    givenGame(makeGame({ players: [makePlayer('host'), makePlayer('bob', { ready: true })] }));

    const res = await call(startGame, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 when the game is already started', async () => {
    givenGame(makeStartedGame());

    const res = await call(startGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('restartGame', () => {
  const endedGame = () =>
    makeStartedGame({
      step: 'gameEnd',
      maxHp: 40,
      stake: { target: 'firstLoser', text: 'payer sa tournée' },
      eliminated: ['pub-bob'],
      turnDeadline: null,
      players: [
        makePlayer('host', { ready: true, hp: 12, lockedDices: [6, 6, 6, 6, 6, 6] }),
        makePlayer('bob', { ready: true, hp: -4, index: 1 }),
      ],
    });

  it('sends everyone back to the lobby with the same players and rules, all HP back', async () => {
    const game = givenGame(endedGame());

    const res = await call(restartGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.actif).toBeNull();
    expect(game.step).toBe('none');
    expect(game.eliminated).toEqual([]);
    expect(game.players.map((player) => [player._id, player.hp])).toEqual([
      ['pub-host', 40],
      ['pub-bob', 40],
    ]);
    expect(game.players[0].lockedDices).toEqual([]);
    expect(game.stake).toEqual({ target: 'firstLoser', text: 'payer sa tournée' });
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('asks everyone but the host to get ready again', async () => {
    const game = givenGame(endedGame());

    await call(restartGame, { id: VALID_ID, user: user('host') });

    expect(game.players.map((player) => player.ready)).toEqual([true, false]);
  });

  it('responds 403 when the requester is not the host', async () => {
    givenGame(endedGame());

    const res = await call(restartGame, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 while the game is not over', async () => {
    givenGame(makeStartedGame());

    const res = await call(restartGame, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
