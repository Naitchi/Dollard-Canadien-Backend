import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../models/Game.js', async () => (await import('../support/mocks.js')).gameModelMock());
vi.mock('../../pusher.js', async () => (await import('../support/mocks.js')).pusherMock());

import pusher from '../../pusher.js';
import { changeGameStep, endTurn, lockDices, turnTimeout } from '../../controllers/index.js';
import { ACTION_TIMEOUT_MS } from '../../functions/turn.js';
import { mockDiceSequence } from '../support/dice.js';
import {
  VALID_ID,
  call,
  givenGame,
  makeGame,
  makeStartedGame,
  resetControllerMocks,
  user,
} from '../support/controllers.js';

beforeEach(resetControllerMocks);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('changeGameStep', () => {
  it('lets the active player roll (none -> dices) and resets the deadline', async () => {
    const game = givenGame(makeStartedGame({ turnDeadline: new Date(0) }));

    const res = await call(changeGameStep, { id: VALID_ID, user: user('host'), step: 'dices' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.step).toBe('dices');
    expect(game.turnDeadline.getTime()).toBeGreaterThan(Date.now() + ACTION_TIMEOUT_MS - 5_000);
  });

  it('never pushes the deadline past the limit of the whole turn', async () => {
    const turnLimit = new Date(Date.now() + 5_000);
    const game = givenGame(makeStartedGame({ turnLimit }));

    await call(changeGameStep, { id: VALID_ID, user: user('host'), step: 'dices' });

    expect(game.turnDeadline).toEqual(turnLimit);
  });

  it('lets the active player start the lock animation (dices -> lockAnimation)', async () => {
    const game = givenGame(makeStartedGame({ step: 'dices' }));

    await call(changeGameStep, { id: VALID_ID, user: user('host'), step: 'lockAnimation' });

    expect(game.step).toBe('lockAnimation');
  });

  it('responds 409 for any transition the server controls itself', async () => {
    const game = givenGame(makeStartedGame());

    const res = await call(changeGameStep, {
      id: VALID_ID,
      user: user('host'),
      step: 'gameEnd',
    });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(game.step).toBe('none');
  });

  it('responds 403 when the requester is not the active player', async () => {
    givenGame(makeStartedGame());

    const res = await call(changeGameStep, { id: VALID_ID, user: user('bob'), step: 'dices' });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 before the game has started', async () => {
    givenGame(makeGame());

    const res = await call(changeGameStep, { id: VALID_ID, user: user('host'), step: 'dices' });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('lockDices', () => {
  const rollingGame = (dices, lockedDices = []) => {
    const game = makeStartedGame({ step: 'dices' });
    game.players[0].dices = dices;
    game.players[0].lockedDices = lockedDices;
    return givenGame(game);
  };

  it('locks the selected dice, rerolls the others and goes back to step "none"', async () => {
    const game = rollingGame([1, 2, 3, 4, 5, 6]);

    const res = await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [5, 4] });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.players[0].lockedDices).toEqual([6, 5]);
    expect(game.players[0].dices).toHaveLength(4);
    expect(game.step).toBe('none');
  });

  it('responds 422 when the same die is selected several times', async () => {
    const game = rollingGame([6, 1, 1, 1, 1, 1]);

    const res = await call(lockDices, {
      id: VALID_ID,
      user: user('host'),
      lockedDices: [0, 0, 0, 0, 0, 0],
    });

    expect(res.status).toHaveBeenCalledWith(422);
    expect(game.players[0].lockedDices).toEqual([]);
  });

  it('responds 422 when no die is selected (no free reroll)', async () => {
    rollingGame([1, 2, 3, 4, 5, 6]);

    const res = await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [] });

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('responds 422 for an index that does not exist', async () => {
    rollingGame([1, 2]);

    const res = await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [2] });

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('responds 409 when the dice have not been rolled yet (step "none")', async () => {
    const game = rollingGame([1, 2, 3, 4, 5, 6]);
    game.step = 'none';

    const res = await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [0] });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responds 403 when the requester is not the active player', async () => {
    rollingGame([1, 2, 3, 4, 5, 6]);

    const res = await call(lockDices, { id: VALID_ID, user: user('bob'), lockedDices: [0] });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('applies the HP loss once the 6th die is locked with a score below 30', async () => {
    const game = rollingGame([1], [1, 2, 3, 4, 5]); // 16

    await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [0] });

    expect(game.players[0].hp).toBe(30 - 14);
    expect(game.step).toBe('scoreAdditionAnimation');
  });

  it('resolves an attack when the score is above 30', async () => {
    const game = rollingGame([6], [6, 6, 6, 6, 6]); // 36 -> attack number 6
    mockDiceSequence(6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

    await call(lockDices, { id: VALID_ID, user: user('host'), lockedDices: [0] });

    expect(game.players[0].attackDices).toEqual([
      [6, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    expect(game.players[1].hp).toBe(24);
  });
});

describe('endTurn', () => {
  it('passes the turn to the next player', async () => {
    const game = givenGame(makeStartedGame({ step: 'scoreAdditionAnimation' }));

    const res = await call(endTurn, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.actif).toBe('pub-bob');
    expect(game.step).toBe('none');
    expect(game.players[1].dices).toHaveLength(6);
  });

  it('ends the game when only one player is left alive', async () => {
    const game = makeStartedGame({ step: 'scoreAdditionAnimation' });
    game.players[1].hp = 0;
    givenGame(game);

    await call(endTurn, { id: VALID_ID, user: user('host') });

    expect(game.step).toBe('gameEnd');
  });

  it('responds 409 when the turn has not been resolved yet', async () => {
    givenGame(makeStartedGame({ step: 'dices' }));

    const res = await call(endTurn, { id: VALID_ID, user: user('host') });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('responds 403 when the requester is not the active player', async () => {
    givenGame(makeStartedGame({ step: 'scoreAdditionAnimation' }));

    const res = await call(endTurn, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('turnTimeout', () => {
  const expired = new Date(Date.now() - 1_000);

  it('locks the remaining dice of an AFK active player and resolves their turn', async () => {
    const game = makeStartedGame({ step: 'dices', turnDeadline: expired });
    game.players[0].dices = [5, 5, 5];
    game.players[0].lockedDices = [5, 5, 5];
    givenGame(game);

    const res = await call(turnTimeout, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(game.players[0].lockedDices).toEqual([5, 5, 5, 5, 5, 5]);
    expect(game.step).toBe('scoreAdditionAnimation');
    expect(pusher.trigger).toHaveBeenCalledWith(`DollarCanadien-${VALID_ID}`, 'updateGame', game);
  });

  it('passes the turn when the result was shown but the active player never ended it', async () => {
    const game = givenGame(
      makeStartedGame({ step: 'scoreAdditionAnimation', turnDeadline: expired }),
    );

    await call(turnTimeout, { id: VALID_ID, user: user('bob') });

    expect(game.actif).toBe('pub-bob');
    expect(game.step).toBe('none');
  });

  it('responds 409 while the active player still has time', async () => {
    const game = givenGame(makeStartedGame({ step: 'dices' }));

    const res = await call(turnTimeout, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(game.save).not.toHaveBeenCalled();
  });

  it('responds 403 when the requester is not in the game', async () => {
    givenGame(makeStartedGame({ turnDeadline: expired }));

    const res = await call(turnTimeout, { id: VALID_ID, user: user('mallory') });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('responds 409 when the game is over', async () => {
    givenGame(makeStartedGame({ step: 'gameEnd', turnDeadline: expired }));

    const res = await call(turnTimeout, { id: VALID_ID, user: user('bob') });

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
