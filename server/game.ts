import { randomBytes, randomUUID } from 'node:crypto';
import { categoryChoices, nextQuestion } from './questions.js';
import type { Avatar, Category, GameRoom, Player, PublicGameState } from './types.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOTAL_ROUNDS = 10;
const QUESTION_MS = 15_000;
const REVEAL_MS = 4_000;

export class GameError extends Error {}

export class GameService {
  readonly rooms = new Map<string, GameRoom>();
  private readonly onChange: (room: GameRoom) => void;

  constructor(onChange: (room: GameRoom) => void) {
    this.onChange = onChange;
  }

  createRoom(nickname: string, avatar: Avatar, socketId: string) {
    const player = this.newPlayer(nickname, avatar, socketId);
    const room: GameRoom = { code: this.roomCode(), hostId: player.id, phase: 'lobby', players: [player], round: 0, totalRounds: TOTAL_ROUNDS, categoryOptions: [], answers: {}, usedQuestionIds: [], createdAt: Date.now() };
    this.rooms.set(room.code, room);
    return { room, player };
  }

  joinRoom(code: string, nickname: string, avatar: Avatar, socketId: string) {
    const room = this.requireRoom(code);
    if (room.phase !== 'lobby') throw new GameError('This game has already started.');
    if (room.players.length >= 8) throw new GameError('This room is full.');
    if (room.players.some((player) => player.nickname.toLowerCase() === nickname.toLowerCase())) throw new GameError('That nickname is already in use in this room.');
    const player = this.newPlayer(nickname, avatar, socketId);
    room.players.push(player);
    this.emit(room);
    return { room, player };
  }

  reconnect(code: string, token: string, socketId: string) {
    const room = this.requireRoom(code);
    const player = room.players.find((entry) => entry.reconnectToken === token);
    if (!player) throw new GameError('Your player session could not be restored.');
    player.socketId = socketId;
    player.connected = true;
    this.emit(room);
    return { room, player };
  }

  startGame(code: string, playerId: string) {
    const room = this.requireRoom(code);
    this.requireHost(room, playerId);
    if (room.players.filter((player) => player.connected).length < 2) throw new GameError('At least two connected players are needed to begin.');
    if (room.phase !== 'lobby' && room.phase !== 'results') throw new GameError('The game cannot start right now.');
    this.clearTimer(room);
    room.phase = 'category';
    room.round = 1;
    room.usedQuestionIds = [];
    room.players.forEach((player) => { player.score = 0; });
    this.prepareCategory(room);
  }

  chooseCategory(code: string, playerId: string, category: Category) {
    const room = this.requireRoom(code);
    if (room.phase !== 'category') throw new GameError('A category cannot be selected right now.');
    if (room.chooserId !== playerId) throw new GameError('It is not your turn to choose a category.');
    if (!room.categoryOptions.includes(category)) throw new GameError('Choose one of the displayed categories.');
    room.question = nextQuestion(category, room.usedQuestionIds);
    room.usedQuestionIds.push(room.question.id);
    room.phase = 'question';
    room.answers = {};
    room.deadline = Date.now() + QUESTION_MS;
    this.clearTimer(room);
    room.timer = setTimeout(() => this.finishQuestion(room.code), QUESTION_MS + 25);
    this.emit(room);
  }

  submitAnswer(code: string, playerId: string, answerIndex: number) {
    const room = this.requireRoom(code);
    if (room.phase !== 'question' || !room.question || !room.deadline) throw new GameError('There is no active question.');
    if (Date.now() >= room.deadline) throw new GameError('Time is up for this question.');
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= room.question.answers.length) throw new GameError('That answer is invalid.');
    if (room.answers[playerId]) throw new GameError('Your answer is already locked in.');
    const player = this.requirePlayer(room, playerId);
    if (!player.connected) throw new GameError('You are disconnected from this room.');
    room.answers[playerId] = { answerIndex, submittedAt: Date.now() };
    if (room.players.filter((entry) => entry.connected).every((entry) => room.answers[entry.id])) this.finishQuestion(room.code);
    else this.emit(room);
  }

  disconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((entry) => entry.socketId === socketId);
      if (!player) continue;
      player.connected = false;
      player.socketId = undefined;
      if (room.hostId === player.id) {
        const successor = room.players.find((entry) => entry.connected);
        if (successor) room.hostId = successor.id;
      }
      this.emit(room);
      return;
    }
  }

  publicState(room: GameRoom): PublicGameState {
    const state: PublicGameState = {
      code: room.code,
      phase: room.phase,
      round: room.round,
      totalRounds: room.totalRounds,
      chooserId: room.chooserId,
      categoryOptions: room.categoryOptions,
      deadline: room.phase === 'question' ? room.deadline : undefined,
      answersSubmitted: Object.keys(room.answers),
      players: room.players.map((player) => ({ id: player.id, nickname: player.nickname, avatar: player.avatar, score: player.score, connected: player.connected, isHost: player.id === room.hostId }))
    };
    if (room.question) state.question = { id: room.question.id, category: room.question.category, prompt: room.question.prompt, answers: room.question.answers };
    if (room.phase === 'reveal' && room.question) {
      const roundScores: Record<string, number> = {};
      for (const player of room.players) roundScores[player.id] = this.roundPoints(room, player.id);
      state.reveal = { correctIndex: room.question.correctIndex, correctAnswer: room.question.answers[room.question.correctIndex], roundScores };
    }
    if (room.phase === 'results') {
      const highScore = Math.max(...room.players.map((player) => player.score));
      state.winnerIds = room.players.filter((player) => player.score === highScore).map((player) => player.id);
    }
    return state;
  }

  private finishQuestion(code: string) {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'question' || !room.question) return;
    this.clearTimer(room);
    for (const player of room.players) player.score += this.roundPoints(room, player.id);
    room.phase = 'reveal';
    this.emit(room);
    room.timer = setTimeout(() => {
      if (room.round >= room.totalRounds) {
        room.phase = 'results';
        room.question = undefined;
        room.deadline = undefined;
        this.emit(room);
        return;
      }
      room.round += 1;
      room.phase = 'category';
      room.question = undefined;
      room.answers = {};
      room.deadline = undefined;
      this.prepareCategory(room);
    }, REVEAL_MS);
  }

  private prepareCategory(room: GameRoom) {
    const players = room.players;
    room.chooserId = players[(room.round - 1) % players.length]?.id;
    room.categoryOptions = categoryChoices();
    this.emit(room);
  }

  private roundPoints(room: GameRoom, playerId: string) {
    const answer = room.answers[playerId];
    if (!answer || !room.question || answer.answerIndex !== room.question.correctIndex || !room.deadline) return 0;
    const elapsed = Math.max(0, Math.min(QUESTION_MS, answer.submittedAt - (room.deadline - QUESTION_MS)));
    return 100 + Math.round(((QUESTION_MS - elapsed) / QUESTION_MS) * 100);
  }

  private newPlayer(nickname: string, avatar: Avatar, socketId: string): Player {
    const cleaned = nickname.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 2 || cleaned.length > 16) throw new GameError('Choose a nickname between 2 and 16 characters.');
    return { id: randomUUID(), nickname: cleaned, avatar, score: 0, connected: true, socketId, reconnectToken: randomBytes(24).toString('hex'), joinedAt: Date.now() };
  }

  private roomCode() {
    let code = '';
    do code = Array.from({ length: 6 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join(''); while (this.rooms.has(code));
    return code;
  }

  private requireRoom(code: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new GameError('No room was found with that code.');
    return room;
  }

  private requirePlayer(room: GameRoom, playerId: string) {
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) throw new GameError('You are not a member of this room.');
    return player;
  }

  private requireHost(room: GameRoom, playerId: string) {
    if (room.hostId !== playerId) throw new GameError('Only the host can do that.');
  }

  private clearTimer(room: GameRoom) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = undefined;
  }

  private emit(room: GameRoom) { this.onChange(room); }
}
