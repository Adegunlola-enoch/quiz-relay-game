import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/index.js';

const sockets: Socket[] = [];
const waitFor = <T>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

afterEach(() => sockets.splice(0).forEach((socket) => socket.close()));

describe('multiplayer socket flow', () => {
  it('synchronizes a room between two independently connected players', async () => {
    const server = createGameServer();
    await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
    const port = (server.httpServer.address() as AddressInfo).port;
    const host = io(`http://localhost:${port}`, { transports: ['websocket'] });
    const guest = io(`http://localhost:${port}`, { transports: ['websocket'] });
    sockets.push(host, guest);
    await Promise.all([waitFor(host, 'connect'), waitFor(guest, 'connect')]);

    const hostSession = waitFor<{ code: string; playerId: string }>(host, 'session:ready');
    host.emit('room:create', { nickname: 'Maya', avatar: 'star' });
    const session = await hostSession;
    const guestSession = waitFor<{ playerId: string }>(guest, 'session:ready');
    const synchronizedLobby = waitFor<{ players: unknown[] }>(host, 'game:state');
    guest.emit('room:join', { code: session.code, nickname: 'Sam', avatar: 'rocket' });
    await guestSession;
    expect((await synchronizedLobby).players).toHaveLength(2);

    const categoryState = waitFor<{ phase: string; categoryOptions: string[] }>(guest, 'game:state');
    host.emit('game:start', { code: session.code, playerId: session.playerId });
    const category = await categoryState;
    expect(category.phase).toBe('category');
    expect(category.categoryOptions).toHaveLength(3);
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  });
});
