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