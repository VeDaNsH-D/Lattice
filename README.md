# LATTICE

Realtime collaboration platform backend for Lattice, with Socket.IO-based collaboration events and WebRTC signaling.

## Current Progress

### Implemented and intact

- Realtime Socket.IO server in `backend/index.js`
- Collaborative socket events:
	- room join/leave
	- presence updates
	- chat messages
	- reactions
	- cursor updates
	- screen-share state
	- WebRTC signaling (`offer/answer/ICE` passthrough)
	- call leave notifications
	- in-memory activity feed per room
- Auth API:
	- `POST /api/auth/register`
	- `POST /api/auth/signup`
	- `POST /api/auth/login`
	- `GET /api/auth/me`
- Data models for collaborative domain:
	- users, projects, project members, roles
	- rooms, messages
	- links, comments, invites

### In progress / not fully wired yet

- Most collaboration models exist but do not yet have full CRUD route/controller coverage.
- Frontend exists as a Vite React scaffold and is not yet connected to backend realtime/auth flows.
- Realtime room state and activity are in-memory (not persisted in MongoDB yet).

### Newly added (AI backend logic)

- AI-enriched link ingestion:
	- `POST /api/links` stores link + auto-generates 3-sentence summary + embedding
	- collision detection runs against recent project links
	- if overlap/conflict is detected, a debate room is auto-created and an AI opener message is posted
- Debate thread listing:
	- `GET /api/links/debates?projectId=...`
- Daily Pulse generation:
	- cron job runs every day at 9:00 AM (configurable)
	- for each active project with new links in last 24h, generates a ~60s script and TTS mp3
	- manual trigger endpoint: `POST /api/pulse/run` with `{ projectId }`
	- pulse retrieval: `GET /api/pulse/latest?projectId=...` and `GET /api/pulse/history?projectId=...`

## Local Setup

### Backend

1. Install dependencies:

```bash
cd backend
npm install
```

2. Configure environment in `backend/.env`:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_or_openai_compatible_key

# optional overrides
AI_BASE_URL=https://api.groq.com/openai/v1
AI_CHAT_MODEL=llama-3.3-70b-versatile
AI_EMBEDDING_MODEL=text-embedding-3-small

# TTS uses these (defaults to AI key/base)
TTS_BASE_URL=https://api.groq.com/openai/v1
TTS_MODEL=playai-tts
TTS_VOICE=alloy

# daily pulse scheduler
DAILY_PULSE_CRON=0 9 * * *
DAILY_PULSE_TIMEZONE=Asia/Kolkata
PUBLIC_BASE_URL=http://localhost:8000
```

3. Start backend:

```bash
cd backend
npm start
```

Backend health endpoints:

- `GET /` -> backend info
- `GET /health` -> `{ "ok": true }`

### Frontend

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Start frontend dev server:

```bash
cd frontend
npm run dev
```

3. Connect frontend to backend base URL:

- `http://localhost:8000`

## Collaborative Backend Event Surface

- `room:join`
- `room:leave`
- `room:state`
- `room:user-joined`
- `room:user-left`
- `presence:update`
- `activity:new`
- `chat:send`
- `chat:new`
- `reaction:send`
- `reaction:new`
- `cursor:move`
- `cursor:update`
- `screen-share:start`
- `screen-share:stop`
- `screen-share:state`
- `webrtc:signal`
- `call:leave`

## Project Structure

```text
README.md
backend/
	index.js
	controllers/
	middlewares/
	models/
	routes/
	utils/
frontend/
	src/
	public/
	package.json
```

## Notes

- Socket.IO credentials are not needed for local development.
- Redis is optional and only needed when scaling Socket.IO across multiple backend instances.
- TURN credentials are recommended later for production-grade WebRTC connectivity across restrictive NAT networks.