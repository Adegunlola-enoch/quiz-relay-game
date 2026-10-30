export type Avatar = 'bolt' | 'star' | 'rocket' | 'heart' | 'crown' | 'sparkle' | 'smile' | 'gamepad';
export type Phase = 'lobby' | 'category' | 'question' | 'reveal' | 'results';
export type Category = 'General Knowledge' | 'Science & Nature' | 'Entertainment' | 'Sports' | 'History' | 'Geography';

export interface Player {
  id: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  connected: boolean;
  socketId?: string;
  reconnectToken: string;
  joinedAt: number;
}

export interface Question {
  id: string;
  category: Category;
  prompt: string;
  answers: string[];
  correctIndex: number;
}

export interface SubmittedAnswer {
  answerIndex: number;
  submittedAt: number;
}

export interface GameRoom {
  code: string;
  hostId: string;
  phase: Phase;
  players: Player[];
  round: number;
  totalRounds: number;
  chooserId?: string;
  categoryOptions: Category[];
  question?: Question;
  answers: Record<string, SubmittedAnswer>;
  deadline?: number;
  timer?: NodeJS.Timeout;
  usedQuestionIds: string[];
  createdAt: number;
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface PublicGameState {
  code: string;
  phase: Phase;
  players: PublicPlayer[];
  round: number;
  totalRounds: number;
  chooserId?: string;
  categoryOptions: Category[];
  question?: Pick<Question, 'id' | 'category' | 'prompt' | 'answers'>;
  deadline?: number;
  answersSubmitted: string[];
  reveal?: { correctIndex: number; correctAnswer: string; roundScores: Record<string, number> };
  winnerIds?: string[];
}
