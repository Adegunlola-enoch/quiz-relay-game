import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type Avatar = 'bolt' | 'star' | 'rocket' | 'heart' | 'crown' | 'sparkle' | 'smile' | 'gamepad';
type Phase = 'lobby' | 'category' | 'question' | 'reveal' | 'results';
type Category = 'General Knowledge' | 'Science & Nature' | 'Entertainment' | 'Sports' | 'History' | 'Geography';
type HomeScreen = 'home' | 'create' | 'join';
interface Player { id: string; nickname: string; avatar: Avatar; score: number; connected: boolean; isHost: boolean; }
interface State {
  code: string; phase: Phase; players: Player[]; round: number; totalRounds: number; chooserId?: string; categoryOptions: Category[];
  question?: { id: string; category: Category; prompt: string; answers: string[] };
  deadline?: number; answersSubmitted: string[];
  reveal?: { correctIndex: number; correctAnswer: string; roundScores: Record<string, number> };
  winnerIds?: string[];
}
interface Session { code: string; playerId: string; reconnectToken: string; }
const avatars: Record<Avatar, string> = { bolt: '⚡', star: '★', rocket: '🚀', heart: '♥', crown: '♛', sparkle: '✦', smile: '☺', gamepad: '🎮' };
const storageKey = 'quiz-relay-session';

export function App() {
  const socketRef = useRef<Socket | null>(null);
  const [screen, setScreen] = useState<'home' | 'create' | 'join' | 'room'>('home');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<Avatar>('bolt');
  const [joinCode, setJoinCode] = useState('');
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting');

  useEffect(() => {
  // Connect to Render in production and localhost during development.
  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

  const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
  });

  socketRef.current = socket;

  socket.on('connect', () => {
    console.log('Connected to Quiz Relay backend:', socket.id);
    setConnection('connected');

    const saved = readSession();
    if (saved) socket.emit('room:reconnect', saved);
  });

  socket.on('disconnect', () => {
    setConnection('offline');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection failed:', error.message);
    setConnection('offline');
  });

  socket.on('game:error', (message: string) => setNotice(message));

  socket.on('session:ready', (nextSession: Session) => {
    localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    setScreen('room');
    setNotice('');
  });

  socket.on('game:state', (nextState: State) => {
    setState(nextState);
    setScreen('room');
  });

  return () => {
    socket.close();
  };
}, []);

  const submitProfile = (mode: 'create' | 'join') => {
    const socket = socketRef.current;
    if (!socket?.connected) return setNotice('Trying to reconnect—please wait a moment.');
    if (mode === 'create') socket.emit('room:create', { nickname, avatar });
    else socket.emit('room:join', { code: joinCode.toUpperCase(), nickname, avatar });
  };
  const send = (event: string, payload: Record<string, unknown> = {}) => {
    if (!session || !socketRef.current?.connected) return setNotice('You are offline. Reconnecting…');
    socketRef.current.emit(event, { ...payload, code: session.code, playerId: session.playerId });
  };

  const homeScreen: HomeScreen = screen === 'room' ? 'home' : screen;
  if (screen !== 'room' || !state || !session) return <Home screen={homeScreen} setScreen={setScreen} nickname={nickname} setNickname={setNickname} avatar={avatar} setAvatar={setAvatar} joinCode={joinCode} setJoinCode={setJoinCode} onSubmit={submitProfile} notice={notice} connection={connection} />;
  return <Room state={state} session={session} notice={notice} connection={connection} onStart={() => send('game:start')} onCategory={(category) => send('game:category', { category })} onAnswer={(answerIndex) => send('game:answer', { answerIndex })} onExit={() => { localStorage.removeItem(storageKey); setSession(null); setState(null); setScreen('home'); }} />;
}

function Home(props: {
  screen: HomeScreen; setScreen: (screen: HomeScreen) => void; nickname: string; setNickname: (value: string) => void;
  avatar: Avatar; setAvatar: (avatar: Avatar) => void; joinCode: string; setJoinCode: (value: string) => void; onSubmit: (mode: 'create' | 'join') => void; notice: string; connection: string;
}) {
  const { screen, setScreen } = props;
  if (screen === 'home') return <main className="home-shell">
    <header className="topbar"><Brand /><span className={`connection ${props.connection}`}>{props.connection === 'connected' ? '● Online' : '● Connecting'}</span></header>
    <section className="hero">
      <div className="eyebrow">LIVE MULTIPLAYER TRIVIA</div><h1>Pass the category.<br /><i>Own the answer.</i></h1>
      <p>Bring 2–8 people together for a fast, friendly trivia showdown. No accounts. Just a room code and a sharp mind.</p>
      <div className="hero-actions"><button className="button primary" onClick={() => setScreen('create')}>Create a game <span>→</span></button><button className="button secondary" onClick={() => setScreen('join')}>Join with code</button></div>
    </section>
    <section className="how"><div><b>01</b><h3>Create a room</h3><p>Pick a nickname and share your private code.</p></div><div><b>02</b><h3>Choose smart</h3><p>Take turns selecting the next category.</p></div><div><b>03</b><h3>Answer fast</h3><p>Correct answers score more when you are quick.</p></div></section>
  </main>;
  return <main className="form-shell"><button className="back" onClick={() => setScreen('home')}>← Back</button><div className="form-card"><Brand /><h1>{screen === 'create' ? 'Start a room' : 'Join your crew'}</h1><p>{screen === 'create' ? 'Your friends will join using the code we create.' : 'Ask the host for their six-character room code.'}</p>
    <label>YOUR NICKNAME<input autoFocus maxLength={16} value={props.nickname} onChange={(event) => props.setNickname(event.target.value)} placeholder="e.g. Maya" /></label>
    {screen === 'join' && <label>ROOM CODE<input className="code-input" maxLength={6} value={props.joinCode} onChange={(event) => props.setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123" /></label>}
    <span className="label">PICK YOUR MARK</span><div className="avatars">{(Object.keys(avatars) as Avatar[]).map((item) => <button key={item} className={props.avatar === item ? 'avatar chosen' : 'avatar'} onClick={() => props.setAvatar(item)}>{avatars[item]}</button>)}</div>
    {props.notice && <div className="notice">{props.notice}</div>}<button className="button primary full" onClick={() => props.onSubmit(screen)}>{screen === 'create' ? 'Create game' : 'Join game'} <span>→</span></button>
  </div></main>;
}

function Room({ state, session, notice, connection, onStart, onCategory, onAnswer, onExit }: { state: State; session: Session; notice: string; connection: string; onStart: () => void; onCategory: (category: Category) => void; onAnswer: (answerIndex: number) => void; onExit: () => void }) {
  const me = state.players.find((player) => player.id === session.playerId);
  const isChooser = state.chooserId === session.playerId;
  const hasAnswered = state.answersSubmitted.includes(session.playerId);
  return <main className="game-shell"><header className="game-header"><Brand compact /><div className="room-code"><span>ROOM</span><strong>{state.code}</strong><button aria-label="Copy room code" onClick={() => navigator.clipboard?.writeText(state.code)}>⧉</button></div><span className={`connection ${connection}`}>{connection === 'connected' ? '● Live' : '● Reconnecting'}</span><button className="leave" onClick={onExit}>Leave</button></header>
    <div className="game-layout"><aside className="scoreboard"><div className="score-title">SCOREBOARD <span>{state.phase === 'lobby' ? 'LOBBY' : `${state.round}/${state.totalRounds}`}</span></div>{[...state.players].sort((a, b) => b.score - a.score).map((player, index) => <div className={`player-row ${player.id === session.playerId ? 'me' : ''}`} key={player.id}><span className="rank">{index + 1}</span><span className="player-avatar">{avatars[player.avatar]}</span><span className="player-name">{player.nickname}{player.isHost && <small>HOST</small>}{!player.connected && <small>AWAY</small>}</span><strong>{player.score}</strong></div>)}</aside>
      <section className="play-area"><PhaseContent state={state} me={me} isChooser={isChooser} hasAnswered={hasAnswered} onStart={onStart} onCategory={onCategory} onAnswer={onAnswer} />{notice && <div className="notice game-notice">{notice}</div>}</section>
    </div></main>;
}

function PhaseContent({ state, me, isChooser, hasAnswered, onStart, onCategory, onAnswer }: { state: State; me?: Player; isChooser: boolean; hasAnswered: boolean; onStart: () => void; onCategory: (category: Category) => void; onAnswer: (index: number) => void }) {
  if (!me) return <div className="stage"><h2>Restoring your seat…</h2></div>;
  if (state.phase === 'lobby') return <div className="stage lobby-stage"><div className="orb">✦</div><div className="eyebrow">THE LOBBY</div><h2>Bring in your brightest people.</h2><p>{state.players.length === 1 ? 'Share the room code above. You need one more player to begin.' : `${state.players.length} players ready. The host can start whenever everyone is in.`}</p>{me.isHost ? <button className="button primary" disabled={state.players.filter((player) => player.connected).length < 2} onClick={onStart}>Start game <span>→</span></button> : <div className="waiting">Waiting for {state.players.find((player) => player.isHost)?.nickname} to start…</div>}</div>;
  if (state.phase === 'category') return <div className="stage"><div className="round-pill">ROUND {state.round} OF {state.totalRounds}</div><h2>{isChooser ? 'Your call.' : `${state.players.find((player) => player.id === state.chooserId)?.nickname} is choosing.`}</h2><p>{isChooser ? 'Choose a category for this round. Everyone gets the same question.' : 'Get ready—the question starts as soon as a category is picked.'}</p><div className="categories">{state.categoryOptions.map((category) => <button key={category} disabled={!isChooser} className="category" onClick={() => onCategory(category)}><span>{categoryIcon(category)}</span>{category}</button>)}</div></div>;
  if (state.phase === 'question') return <QuestionStage state={state} hasAnswered={hasAnswered} onAnswer={onAnswer} />;
  if (state.phase === 'reveal') return <div className="stage reveal"><div className="eyebrow">ROUND COMPLETE</div><h2>{state.reveal?.roundScores[me.id] ? `+${state.reveal.roundScores[me.id]} points` : 'No points this time'}</h2><p className="answer-reveal">Correct answer: <strong>{state.reveal?.correctAnswer}</strong></p><div className="reveal-answer">✓ {state.reveal?.correctAnswer}</div><p>Next category arrives in a moment…</p></div>;
  const winners = state.players.filter((player) => state.winnerIds?.includes(player.id));
  return <div className="stage results"><div className="trophy">♛</div><div className="eyebrow">FINAL RESULTS</div><h2>{winners.length > 1 ? 'It’s a tie!' : `${winners[0]?.nickname} wins!`}</h2><p>{winners.length > 1 ? winners.map((player) => player.nickname).join(' and ') + ' finished level.' : `${winners[0]?.score} points of trivia brilliance.`}</p><div className="podium">{[...state.players].sort((a, b) => b.score - a.score).slice(0, 3).map((player, index) => <div className="podium-player" key={player.id}><span>{avatars[player.avatar]}</span><b>#{index + 1}</b><small>{player.nickname}</small><strong>{player.score}</strong></div>)}</div>{me.isHost && <button className="button primary" onClick={onStart}>Play another round <span>↻</span></button>}</div>;
}

function QuestionStage({ state, hasAnswered, onAnswer }: { state: State; hasAnswered: boolean; onAnswer: (index: number) => void }) {
  const seconds = useCountdown(state.deadline);
  return <div className="stage question-stage"><div className="question-top"><span className="round-pill">{state.question?.category}</span><span className={`timer ${seconds <= 5 ? 'urgent' : ''}`}>{seconds}s</span></div><div className="progress"><i style={{ width: `${Math.max(0, Math.min(100, (seconds / 15) * 100))}%` }} /></div><h2>{state.question?.prompt}</h2><div className="answers">{state.question?.answers.map((answer, index) => <button key={answer} disabled={hasAnswered} onClick={() => onAnswer(index)}><b>{'ABCD'[index]}</b><span>{answer}</span></button>)}</div><p className="answer-status">{hasAnswered ? 'Answer locked. Waiting for the others…' : `${state.answersSubmitted.length} of ${state.players.filter((player) => player.connected).length} answers in`}</p></div>;
}

function useCountdown(deadline?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, []);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

function Brand({ compact = false }: { compact?: boolean }) { return <div className="brand"><span>Q</span>{!compact && <strong>QUIZ<br />RELAY</strong>}</div>; }
function categoryIcon(category: Category) { return ({ 'General Knowledge': '✦', 'Science & Nature': '◌', Entertainment: '◐', Sports: '◒', History: '⌛', Geography: '◈' })[category]; }
function readSession(): Session | null { try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; } catch { return null; } }
