import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { GameError, GameService } from './game.js';
import type { Avatar, Category, GameRoom } from './types.js';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?? 'https://quiz-relay-game.vercel.app';
const allowedAvatars = new Set<Avatar>(['bolt', 'star', 'rocket', 'heart', 'crown', 'sparkle', 'smile', 'gamepad']);

export function createGameServer() {
  const app = express();
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
  app.get('/health', (_request, response) => response.json({ ok: true }));
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN, credentials: true } });
  const game = new GameService((room) => publish(io, game, room));

  io.on('connection', (socket) => {
    const invoke = <T>(handler: () => T) => {
      try { return handler(); } catch (error) {
        socket.emit('game:error', error instanceof Error ? error.message : 'Something went wrong.');
        return undefined;
      }
    };
    const identity = (nickname: unknown, avatar: unknown) => {
      if (typeof nickname !== 'string' || typeof avatar !== 'string' || !allowedAvatars.has(avatar as Avatar)) throw new GameError('Please provide a nickname and avatar.');
      return { nickname, avatar: avatar as Avatar };
    };

    socket.on('room:create', (payload: { nickname: unknown; avatar: unknown }) => invoke(() => {
      const { nickname, avatar } = identity(payload?.nickname, payload?.avatar);
      const { room, player } = game.createRoom(nickname, avatar, socket.id);
      socket.join(room.code);
      socket.emit('session:ready', { code: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      publish(io, game, room);
    }));

    socket.on('room:join', (payload: { code: unknown; nickname: unknown; avatar: unknown }) => invoke(() => {
      if (typeof payload?.code !== 'string') throw new GameError('Enter a room code.');
      const { nickname, avatar } = identity(payload.nickname, payload.avatar);
      const { room, player } = game.joinRoom(payload.code.toUpperCase(), nickname, avatar, socket.id);
      socket.join(room.code);
      socket.emit('session:ready', { code: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      publish(io, game, room);
    }));

    socket.on('room:reconnect', (payload: { code: unknown; reconnectToken: unknown }) => invoke(() => {
      if (typeof payload?.code !== 'string' || typeof payload?.reconnectToken !== 'string') throw new GameError('Session details are missing.');
      const { room, player } = game.reconnect(payload.code, payload.reconnectToken, socket.id);
      socket.join(room.code);
      socket.emit('session:ready', { code: room.code, playerId: player.id, reconnectToken: player.reconnectToken });
      publish(io, game, room);
    }));

    socket.on('game:start', (payload: { code: string; playerId: string }) => invoke(() => game.startGame(payload.code, payload.playerId)));
    socket.on('game:category', (payload: { code: string; playerId: string; category: Category }) => invoke(() => game.chooseCategory(payload.code, payload.playerId, payload.category)));
    socket.on('game:answer', (payload: { code: string; playerId: string; answerIndex: number }) => invoke(() => game.submitAnswer(payload.code, payload.playerId, payload.answerIndex)));
    socket.on('disconnect', () => game.disconnect(socket.id));
  });
  return { app, io, game, httpServer };
}

function publish(io: Server, game: GameService, room: GameRoom) {
  io.to(room.code).emit('game:state', game.publicState(room));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { httpServer } = createGameServer();
  httpServer.listen(PORT, () => console.log(`Quiz Relay server listening on http://localhost:${PORT}`));
}
