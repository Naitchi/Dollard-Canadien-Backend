import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../models/Game.js', () => {
  const GameCtor = vi.fn().mockImplementation((data) => ({
    ...data,
    save: vi.fn().mockResolvedValue({ ...data, _id: 'mockedNewGameId' }),
  }));
  GameCtor.findOne = vi.fn();
  GameCtor.findOneAndUpdate = vi.fn();
  GameCtor.findByIdAndUpdate = vi.fn();
  return { default: GameCtor };
});

vi.mock('../pusher.js', () => ({
  default: { trigger: vi.fn().mockResolvedValue(undefined) },
}));

import Game from '../models/Game.js';
import pusher from '../pusher.js';
import {
  createALobby,
  getALobby,
  changeOptions,
  addAPlayer,
  removeAPlayer,
  readyUp,
  startGame,
  lockDices,
  endTurn,
  changeGameStep,
} from '../controllers/index.js';

// A valid 24-char hex string, required because the controllers do
// `new mongoose.Types.ObjectId(id)` for real (mongoose itself isn't mocked).
const VALID_ID = '507f1f77bcf86cd799439011';

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

// Helper: makes findByIdAndUpdate / findOneAndUpdate just echo back the
// `$set` payload they were given, so we can assert on the mutated game
// object the controller built, without needing a real DB.
const echoSet = () =>
  vi.fn().mockImplementation((_filter, update) => Promise.resolve(update.$set ?? update));

beforeEach(() => {
  // mockReset() (not mockClear()) is important here: it also drops any
  // unconsumed mockResolvedValueOnce() queued by a previous test (e.g. a
  // test that returns early before reaching the mocked call), which would
  // otherwise leak into the next test. We leave the Game constructor's
  // default `save` implementation (set in the factory above) untouched.
  Game.mockClear();
  Game.findOne.mockReset();
  Game.findOneAndUpdate.mockReset();
  Game.findByIdAndUpdate.mockReset();
  pusher.trigger.mockReset();
  pusher.trigger.mockResolvedValue(undefined);
});

describe('createALobby', () => {
  it('creates a game with the host as first (ready) player and responds 201', async () => {
    const req = {
      body: {
        private: 'false',
        user: { id: 'host-1', username: 'Alice' },
      },
    };
    const res = mockRes();

    await createALobby(req, res);

    expect(Game).toHaveBeenCalledWith({
      private: 'false',
      host: req.body.user,
      players: [{ username: 'Alice', _id: 'host-1', ready: true }],
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ private: 'false', host: req.body.user }),
    );
  });

  it('responds 500 when save() rejects', async () => {
    Game.mockImplementationOnce((data) => ({
      ...data,
      save: vi.fn().mockRejectedValue(new Error('DB down')),
    }));
    const req = { body: { private: 'false', user: { id: 'host-1', username: 'Alice' } } };
    const res = mockRes();

    await createALobby(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Une erreur s'est produite");
  });
});

describe('getALobby', () => {
  it('responds 404 when the game is not found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const req = { params: { id: VALID_ID } };
    const res = mockRes();

    await getALobby(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé');
  });

  it('responds 200 with the game when found', async () => {
    const fakeGame = { _id: VALID_ID, players: [] };
    Game.findOne.mockResolvedValueOnce(fakeGame);
    const req = { params: { id: VALID_ID } };
    const res = mockRes();

    await getALobby(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(fakeGame);
  });
});

describe('changeOptions', () => {
  const baseBody = {
    id: VALID_ID,
    user: { id: 'host-1', username: 'Alice' },
    options: { private: 'true', maxPlayers: 4, maxHp: 50 },
  };

  it('responds 404 when no lobby is found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const res = mockRes();

    await changeOptions({ body: baseBody }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé.');
  });

  it('responds 409 when the game is already active', async () => {
    Game.findOne.mockResolvedValueOnce({ actif: 'someone', host: { id: 'host-1' }, players: [] });
    const res = mockRes();

    await changeOptions({ body: baseBody }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith('La partie est déjà lancé.');
  });

  it('responds 403 when requester is not the host', async () => {
    Game.findOne.mockResolvedValueOnce({ actif: null, host: { id: 'other-host' }, players: [] });
    const res = mockRes();

    await changeOptions({ body: baseBody }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith("Vous n'avez pas l'autorité pour faire ça.");
  });

  it('updates options, triggers pusher, and responds 201 on the happy path', async () => {
    const game = { actif: null, host: { id: 'host-1' }, players: [], private: 'false', maxPlayers: 99, maxHp: 30 };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findOneAndUpdate.mockResolvedValueOnce({ ...game, ...baseBody.options, players: [] });
    const res = mockRes();

    await changeOptions({ body: baseBody }, res);

    expect(game.private).toBe('true');
    expect(game.maxPlayers).toBe(4);
    expect(game.maxHp).toBe(50);
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'updateGame',
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith('Les options ont bien été modifié.');
  });
});

describe('addAPlayer', () => {
  it('responds 404 when no lobby is found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const res = mockRes();

    await addAPlayer({ body: { id: VALID_ID, user: { id: 'p2', username: 'Bob' } } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé');
  });

  it('pushes the new player as a properly shaped player (_id/username/ready), triggers pusher, and responds 201', async () => {
    const game = { players: [{ _id: 'p1', username: 'Alice' }] };
    const newUser = { id: 'p2', username: 'Bob' };
    Game.findOne.mockResolvedValueOnce(game);
    const updatedGame = {
      players: [{ _id: 'p1', username: 'Alice' }, { _id: 'p2', username: 'Bob', ready: false }],
    };
    // The controller calls deletePlayersIds(game) right after findOneAndUpdate, which
    // strips `_id` from the shared `game.players` array in place - so we snapshot the
    // pushed player's shape here, synchronously, before that later mutation happens.
    let pushedPlayersSnapshot;
    Game.findOneAndUpdate.mockImplementationOnce((_filter, update) => {
      pushedPlayersSnapshot = update.$set.players.map((p) => ({ ...p }));
      return Promise.resolve(updatedGame);
    });
    const res = mockRes();

    await addAPlayer({ body: { id: VALID_ID, user: newUser } }, res);

    expect(pushedPlayersSnapshot).toHaveLength(2);
    expect(pushedPlayersSnapshot[1]).toEqual({ _id: 'p2', username: 'Bob', ready: false });
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'updatePlayers',
      expect.any(Array),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(updatedGame);
  });
});

describe('removeAPlayer', () => {
  const makeGame = () => ({
    host: { id: 'host-1' },
    players: [
      { _id: 'host-1', index: 0, username: 'Alice' },
      { _id: 'p2', index: 1, username: 'Bob' },
    ],
  });

  it('responds 404 when no lobby is found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const res = mockRes();

    await removeAPlayer(
      { body: { id: VALID_ID, user: { id: 'host-1' }, IndexToKick: 1 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé');
  });

  it.each([
    ['a non-number', 'not-a-number'],
    ['negative', -1],
    ['out of range', 5],
  ])('responds 400 when IndexToKick is invalid (%s)', async (_label, badIndex) => {
    Game.findOne.mockResolvedValueOnce(makeGame());
    const res = mockRes();

    await removeAPlayer(
      { body: { id: VALID_ID, user: { id: 'host-1' }, IndexToKick: badIndex } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Index de joueur invalide');
  });

  it('responds 403 when requester is neither host nor the targeted player', async () => {
    Game.findOne.mockResolvedValueOnce(makeGame());
    const res = mockRes();

    // 'p2' (not host) trying to kick index 0 which is Alice (not themselves)
    await removeAPlayer(
      { body: { id: VALID_ID, user: { id: 'p2' }, IndexToKick: 0 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith("Vous n'avez pas l'autorité pour faire ça.");
  });

  it('allows the host to kick another player, splices and reindexes, responds 200', async () => {
    const game = makeGame();
    Game.findOne.mockResolvedValueOnce(game);
    Game.findOneAndUpdate.mockResolvedValueOnce({ players: [{ _id: 'host-1', index: 0 }] });
    const res = mockRes();

    await removeAPlayer(
      { body: { id: VALID_ID, user: { id: 'host-1' }, IndexToKick: 1 } },
      res,
    );

    expect(game.players).toHaveLength(1);
    expect(game.players[0]._id).toBe('host-1');
    expect(game.players[0].index).toBe(0);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('allows a non-host player to kick themselves, splices and reindexes, responds 200', async () => {
    const game = makeGame();
    Game.findOne.mockResolvedValueOnce(game);
    Game.findOneAndUpdate.mockResolvedValueOnce({ players: [{ _id: 'host-1', index: 0 }] });
    const res = mockRes();

    // 'p2' kicking themselves (IndexToKick 1 === their own player) should be allowed.
    await removeAPlayer(
      { body: { id: VALID_ID, user: { id: 'p2' }, IndexToKick: 1 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('readyUp', () => {
  it('responds 404 when no lobby is found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const res = mockRes();

    await readyUp({ body: { id: VALID_ID, user: { id: 'p1', username: 'Alice' } } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé');
  });

  it('responds 404 when no matching player is found', async () => {
    Game.findOne.mockResolvedValueOnce({
      players: [{ _id: 'p1', username: 'Alice', ready: false }],
    });
    const res = mockRes();

    await readyUp({ body: { id: VALID_ID, user: { id: 'nope', username: 'Ghost' } } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Joueur avec cet id trouvé');
  });

  it('toggles ready and responds 201 on the happy path', async () => {
    const game = { players: [{ _id: 'p1', username: 'Alice', ready: false }] };
    Game.findOne.mockResolvedValueOnce(game);
    const updatedGame = { players: [{ _id: 'p1', username: 'Alice', ready: true }] };
    Game.findOneAndUpdate.mockResolvedValueOnce(updatedGame);
    const res = mockRes();

    await readyUp({ body: { id: VALID_ID, user: { id: 'p1', username: 'Alice' } } }, res);

    expect(game.players[0].ready).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(updatedGame);
  });
});

describe('startGame', () => {
  const hostUser = { id: 'p1', username: 'Alice' };

  it('responds 404 when no lobby is found', async () => {
    Game.findOne.mockResolvedValueOnce(null);
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Aucun Lobby trouvé.');
  });

  it('responds 409 when the game is already active', async () => {
    Game.findOne.mockResolvedValueOnce({ actif: 'p1', host: { id: 'p1' }, players: [] });
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith('La partie est déjà lancé.');
  });

  it('responds 403 when requester is not the host', async () => {
    Game.findOne.mockResolvedValueOnce({ actif: null, host: { id: 'other' }, players: [] });
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith("Vous n'avez pas l'autorité pour faire ça.");
  });

  it('responds 422 when there are not enough players', async () => {
    Game.findOne.mockResolvedValueOnce({
      actif: null,
      host: { id: 'p1' },
      players: [{ _id: 'p1', ready: true, dices: [] }],
    });
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.send).toHaveBeenCalledWith('Pas assez de joueurs pour lancer la partie.');
  });

  it('responds 409 when not everyone is ready', async () => {
    Game.findOne.mockResolvedValueOnce({
      actif: null,
      host: { id: 'p1' },
      players: [
        { _id: 'p1', ready: true, dices: [] },
        { _id: 'p2', ready: false, dices: [] },
      ],
    });
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith('Tout les joueurs ne sont pas prêt.');
  });

  it('assigns actif to the first player, rolls their dice, and responds 201 on the happy path', async () => {
    const game = {
      actif: null,
      host: { id: 'p1' },
      players: [
        { _id: 'p1', ready: true, dices: [] },
        { _id: 'p2', ready: true, dices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findOneAndUpdate.mockImplementationOnce((_filter, update) =>
      Promise.resolve(update.$set),
    );
    const res = mockRes();

    await startGame({ body: { id: VALID_ID, user: hostUser } }, res);

    const [, updateArg] = Game.findOneAndUpdate.mock.calls[0];
    expect(updateArg.$set.actif).toBe('p1');
    expect(updateArg.$set.players[0].dices).toHaveLength(6);
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'updateGame',
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith('La partie a bien été lancé.');
  });
});

describe('lockDices', () => {
  it('responds 500 "Pas ton tour" when the requester is not the active player', async () => {
    Game.findOne.mockResolvedValueOnce({
      actif: 'p1',
      players: [{ _id: 'p1', dices: [], lockedDices: [], hp: 30, index: 0 }],
    });
    const res = mockRes();

    await lockDices(
      { body: { id: VALID_ID, user: { id: 'not-p1' }, lockedDices: [] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Pas ton tour mon grand >:(');
  });

  it('rerolls the remaining dice and resets step to "none" when fewer than 6 dice are locked', async () => {
    const game = {
      actif: 'p1',
      step: 'dices',
      players: [
        { _id: 'p1', dices: [1, 2, 3, 4, 5, 6], lockedDices: [], hp: 30, index: 0, attackDices: [] },
        { _id: 'p2', dices: [], lockedDices: [], hp: 30, index: 1, attackDices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findByIdAndUpdate.mockImplementationOnce(echoSet());
    const res = mockRes();

    // lock indexes 0 and 1 -> values [1, 2], total locked = 2 (not 6)
    await lockDices(
      { body: { id: VALID_ID, user: { id: 'p1' }, lockedDices: [0, 1] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.step).toBe('none');
    expect(body.players[0].lockedDices).toEqual([1, 2]);
    expect(body.players[0].dices).toHaveLength(4);
  });

  it('applies HP loss when 6 dice are locked with a score below 30', async () => {
    const game = {
      actif: 'p1',
      step: 'dices',
      players: [
        {
          _id: 'p1',
          dices: [1, 2],
          lockedDices: [1, 1, 1, 1], // 4 already locked, sum so far 4
          hp: 30,
          index: 0,
          attackDices: [],
        },
        { _id: 'p2', dices: [], lockedDices: [], hp: 30, index: 1, attackDices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findByIdAndUpdate.mockImplementationOnce(echoSet());
    const res = mockRes();

    // lock both remaining dices [1, 2] -> total locked = [1,1,1,1,1,2], sum = 7 (< 30)
    await lockDices(
      { body: { id: VALID_ID, user: { id: 'p1' }, lockedDices: [0, 1] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.players[0].lockedDices).toHaveLength(6);
    expect(body.players[0].hp).toBe(30 - (30 - 7)); // 30 - 23 = 7
    expect(body.players[0].dices).toEqual([]);
    expect(body.step).toBe('scoreAdditionAnimation');
  });

  it('resolves an attack when 6 dice are locked with a score of 30 or more', async () => {
    const game = {
      actif: 'p1',
      step: 'dices',
      players: [
        {
          _id: 'p1',
          dices: [6],
          lockedDices: [6, 6, 6, 6, 6], // 5 already locked, sum so far 30
          hp: 30,
          index: 0,
          attackDices: [],
        },
        { _id: 'p2', dices: [], lockedDices: [], hp: 30, index: 1, attackDices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findByIdAndUpdate.mockImplementationOnce(echoSet());
    const res = mockRes();

    // lock the last dice [6] -> total locked = six 6s, sum = 36 (>= 30, attack = 6)
    await lockDices(
      { body: { id: VALID_ID, user: { id: 'p1' }, lockedDices: [0] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.step).toBe('scoreAdditionAnimation');
    expect(body.players[0].dices).toEqual([]);
    expect(Array.isArray(body.players[0].attackDices)).toBe(true);
    expect(body.players[0].attackDices.length).toBeGreaterThan(0);
  });
});

describe('endTurn', () => {
  it('responds 500 "Pas ton tour" when the requester is not the active player', async () => {
    Game.findOne.mockResolvedValueOnce({
      actif: 'p1',
      players: [{ _id: 'p1', hp: 30, index: 0, lockedDices: [] }],
    });
    const res = mockRes();

    await endTurn({ body: { id: VALID_ID, user: { id: 'not-p1' } } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Pas ton tour mon grand >:(');
  });

  it('responds 500 when the active player has not locked 6 dice', async () => {
    Game.findOne.mockResolvedValueOnce({
      actif: 'p1',
      players: [{ _id: 'p1', hp: 30, index: 0, lockedDices: [1, 2, 3] }],
    });
    const res = mockRes();

    await endTurn({ body: { id: VALID_ID, user: { id: 'p1' } } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Le joueur actif n'a pas verrouillé 6 dés.");
  });

  it('advances actif to the next alive player and resets their dice on the happy path', async () => {
    const game = {
      actif: 'p1',
      step: 'scoreAdditionAnimation',
      players: [
        { _id: 'p1', hp: 30, index: 0, lockedDices: [1, 2, 3, 4, 5, 6], dices: [], attackDices: [] },
        { _id: 'p2', hp: 30, index: 1, lockedDices: [], dices: [], attackDices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findByIdAndUpdate.mockImplementationOnce(echoSet());
    const res = mockRes();

    await endTurn({ body: { id: VALID_ID, user: { id: 'p1' } } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.actif).toBe('p2');
    expect(body.step).toBe('none');
    expect(body.players[1].lockedDices).toEqual([]);
    expect(body.players[1].attackDices).toEqual([]);
    expect(body.players[1].dices).toHaveLength(6);
  });

  it('sets step to "gameEnd" when no next player is alive', async () => {
    const game = {
      actif: 'p1',
      step: 'scoreAdditionAnimation',
      players: [
        { _id: 'p1', hp: 30, index: 0, lockedDices: [1, 2, 3, 4, 5, 6], dices: [], attackDices: [] },
        { _id: 'p2', hp: 0, index: 1, lockedDices: [], dices: [], attackDices: [] },
      ],
    };
    Game.findOne.mockResolvedValueOnce(game);
    Game.findByIdAndUpdate.mockImplementationOnce(echoSet());
    const res = mockRes();

    await endTurn({ body: { id: VALID_ID, user: { id: 'p1' } } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.send.mock.calls[0][0];
    expect(body.step).toBe('gameEnd');
  });
});

describe('changeGameStep', () => {
  it('updates the step, triggers pusher, and responds 200', async () => {
    const updatedGame = { _id: VALID_ID, step: 'dices' };
    Game.findByIdAndUpdate.mockResolvedValueOnce(updatedGame);
    const res = mockRes();

    await changeGameStep({ body: { id: VALID_ID, step: 'dices' } }, res);

    expect(Game.findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      { $set: { step: 'dices' } },
      { new: true },
    );
    expect(pusher.trigger).toHaveBeenCalledWith(
      `DollarCanadien-${VALID_ID}`,
      'updateGame',
      updatedGame,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(updatedGame);
  });

  it('responds 500 when the update rejects', async () => {
    Game.findByIdAndUpdate.mockRejectedValueOnce(new Error('DB down'));
    const res = mockRes();

    await changeGameStep({ body: { id: VALID_ID, step: 'dices' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith("Une erreur s'est produite");
  });
});
