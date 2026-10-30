# Quiz Relay

Quiz Relay is a real-time, turn-based multiplayer trivia game for 2–8 players. Players join a private room with a code, take turns selecting categories, answer together, and compete over ten timed rounds.

## Features

- Unique six-character rooms, nickname and avatar entry—no accounts
- Host-controlled lobby, including automatic host hand-off after a disconnect
- Server-authoritative choices, time limits, score calculations, and results
- Four-choice, 15-second trivia rounds with correctness and speed scoring
- Reconnection tokens that restore a player’s seat and score after a brief connection loss
- Responsive, mobile-friendly interface and a live scoreboard

## Run locally

1. Install Node.js 20 or later.
2. In the project folder, run `npm install`.
3. Copy `.env.example` to `.env` if you want to change any settings.
4. Run `npm run dev`.
5. Open `http://localhost:5173` in two or more browser windows or devices on the same network.

The interface runs on port `5173`; the authoritative game service runs on port `3001`.

## Validate the project

```bash
npm test
npm run build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Local game-service port. Defaults to `3001`. |
| `CLIENT_ORIGIN` | No | Browser origin permitted to connect. Defaults to `http://localhost:5173`. |
| `VITE_SOCKET_URL` | No | URL of the game-service endpoint if the UI and service use different origins. |
| `QUESTION_API_ENABLED` | No | Reserved for enabling an external question provider; the current fallback bank is always available. |
| `REDIS_URL` | Production | Required when deploying across multiple Vercel function instances. |

## Deploy on Vercel

Vercel can host the UI and WebSocket-capable Node function in one project. Create a Redis database (for example, Upstash Redis) in the same region, configure `REDIS_URL`, then import this repository into Vercel and set:

- Build command: `vite build`
- Output directory: `dist`
- `CLIENT_ORIGIN`: the deployed site URL, for example `https://quiz-relay.vercel.app`
- `VITE_SOCKET_URL`: the deployed site URL
- `REDIS_URL`: your managed Redis connection URL

`vercel.json` routes Socket.IO traffic to the function entry point. A production multi-instance release must wire the game-room store and Socket.IO adapter to Redis so all function instances operate on the same room state. The local implementation intentionally uses in-memory rooms for a small, fast development setup; it must not be horizontally scaled until that Redis adapter is enabled.

## Game integrity

The browser never receives a correct answer during the question phase. The server validates membership, host privileges, category turns, answer range, one-answer-per-player enforcement, timer expiration, score calculation, and winners. It sends the correct answer only during the reveal phase.
