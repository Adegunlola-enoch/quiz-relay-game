// Vercel function entry point. Vercel's WebSocket-capable Node runtime invokes this server.
import { createGameServer } from '../server/index.js';

const { httpServer } = createGameServer();
export default httpServer;
