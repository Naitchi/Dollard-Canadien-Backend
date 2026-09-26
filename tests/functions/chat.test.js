import { describe, it, expect } from 'vitest';
import { MAX_MESSAGE_LENGTH, createMessage, normalizeMessage } from '../../functions/chat.js';

describe('normalizeMessage', () => {
  it('trims the text', () => {
    expect(normalizeMessage('  gg  ')).toBe('gg');
  });

  it('rejects empty, blank, too long or non-text messages', () => {
    expect(normalizeMessage('')).toBeNull();
    expect(normalizeMessage('   ')).toBeNull();
    expect(normalizeMessage('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBeNull();
    expect(normalizeMessage(42)).toBeNull();
    expect(normalizeMessage(undefined)).toBeNull();
  });

  it('accepts a message of exactly the maximum length', () => {
    expect(normalizeMessage('x'.repeat(MAX_MESSAGE_LENGTH))).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});

describe('createMessage', () => {
  it('signs the message with the public id and username of its author, never the secret', () => {
    const player = { _id: 'pub-bob', secret: 'bob-secret', username: 'Bob' };

    const message = createMessage(player, 'gg');

    expect(message).toMatchObject({ playerId: 'pub-bob', username: 'Bob', text: 'gg' });
    expect(JSON.stringify(message)).not.toContain('bob-secret');
    expect(new Date(message.sentAt).getTime()).not.toBeNaN();
  });

  it('gives every message its own id', () => {
    const player = { _id: 'pub-bob', username: 'Bob' };
    expect(createMessage(player, 'a').id).not.toBe(createMessage(player, 'a').id);
  });
});
