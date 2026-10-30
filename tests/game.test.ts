import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameError, GameService } from '../server/game.js';
import type { GameRoom } from '../server/types.js';

describe('authoritative game rules', () => {
  let game: GameService;
  let updates: GameRoom[];

  beforeEach(() => {
    vi.useFakeTimers();
    updates = [];
    game = new GameService((room) => updates.push(room));
  });

  it('creates a unique room and prevents games with just one player', () => {
    const host = game.createRoom('Maya', 'star', 'socket-host');
    expect(host.room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(() => game.startGame(host.room.code, host.player.id)).toThrow('At least two');
  });

  it('keeps answer keys private until the reveal and validates player actions', () => {
    const host = game.createRoom('Maya', 'star', 'socket-host');
    const guest = game.joinRoom(host.room.code, 'Sam', 'rocket', 'socket-guest');
    expect(() => game.startGame(host.room.code, guest.player.id)).toThrow(GameError);
    game.startGame(host.room.code, host.player.id);
    expect(host.room.phase).toBe('category');
    game.chooseCategory(host.room.code, host.player.id, host.room.categoryOptions[0]);
    expect(host.room.phase).toBe('question');
    const publicQuestion = game.publicState(host.room).question;
    expect(publicQuestion).toBeDefined();
    expect(JSON.stringify(publicQuestion)).not.toContain('correctIndex');
    expect(() => game.submitAnswer(host.room.code, host.player.id, 99)).toThrow('invalid');
    const correct = host.room.question!.correctIndex;
    game.submitAnswer(host.room.code, host.player.id, correct);
    expect(() => game.submitAnswer(host.room.code, host.player.id, correct)).toThrow('already locked');
    game.submitAnswer(host.room.code, guest.player.id, (correct + 1) % 4);
    expect(host.room.phase).toBe('reveal');
    expect(host.room.players[0].score).toBeGreaterThan(99);
    expect(host.room.players[1].score).toBe(0);
    expect(game.publicState(host.room).reveal?.correctIndex).toBe(correct);
  });

  it('hands host controls to another connected player if the host disconnects', () => {
    const host = game.createRoom('Maya', 'star', 'socket-host');
    const guest = game.joinRoom(host.room.code, 'Sam', 'rocket', 'socket-guest');
    game.disconnect('socket-host');
    expect(host.room.hostId).toBe(guest.player.id);
    expect(game.publicState(host.room).players[0].connected).toBe(false);
  });
});
