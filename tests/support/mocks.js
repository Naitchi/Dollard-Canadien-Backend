import { vi } from 'vitest';

// Factories for vi.mock() in the controller tests: no DB and no Pusher.
// (Kept apart from ./controllers.js, which imports the mocked modules.)

export const gameModelMock = () => {
  // Implementation passed to vi.fn() directly (not via mockImplementation) so
  // that vi.restoreAllMocks() in afterEach restores it instead of wiping it.
  const GameCtor = vi.fn((data) => ({
    _id: 'mockedNewGameId',
    maxHp: 30,
    host: {},
    players: [],
    ...data,
    save: vi.fn().mockResolvedValue(undefined),
  }));
  GameCtor.findById = vi.fn();
  return { default: GameCtor };
};

export const pusherMock = () => ({
  default: { trigger: vi.fn().mockResolvedValue(undefined) },
});
