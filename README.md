# SHELFLIFE

Realtime collaboration backend for ShelfLife with Socket.IO-based chat, presence, reactions, cursor sync, activity logs, and WebRTC signaling. The temporary test frontend has been removed so the actual frontend can connect directly to this backend.

## What Is Updated

- Added a realtime backend in [backend/index.js](backend/index.js) using Express + Socket.IO.
- Added room join/leave, presence updates, activity feed events, chat, custom reactions, cursor movement, screen share signals, and WebRTC signaling.
- MongoDB is now optional for local testing; if `MONGO_URI` is not set, the server still runs for realtime development.

## Local Host Setup

### 1. Install dependencies

From the project root, install the backend dependencies:

```bash
cd backend
npm install
```

### 2. Configure environment variables

Create a `.env` file inside `backend/` if you want MongoDB enabled:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
```

If you skip `MONGO_URI`, the app still runs and only the realtime test UI is active.

### 3. Start the backend

```bash
cd backend
npm start
```

The server will run on:

- `http://localhost:8000`

### 4. Connect the frontend

Point the actual frontend application at `http://localhost:8000`.

The backend exposes Socket.IO for:

- room presence
- chat
- live reactions
- cursor sync
- WebRTC signaling for call setup
- screen-share signaling

## How To Test Realtime Features

Use any frontend client that connects to the Socket.IO server and emits the documented events. The backend is now intentionally frontend-agnostic.

For local manual testing, you can use your real frontend once it is ready, or a minimal Socket.IO test client.

Note: the current implementation provides signaling over Socket.IO, not a production TURN stack. It is best for local testing and same-network demos.

## Socket.IO And WebRTC Notes

- Socket.IO is used for room membership, chat, reactions, presence, activity logs, cursor sync, and signaling.
- WebRTC is used for the actual media path for audio/video/screen-share.
- No Socket.IO credentials are required for local development.
- If you later deploy across multiple Node instances, Redis can be added for cross-instance Socket.IO broadcasting.
- If you want reliable NAT traversal for real calls outside local testing, you will likely need TURN server credentials.

## Project Structure

```text
README.md
backend/
	index.js
	package.json
	package-lock.json
```

## Current Backend Event Surface

- `room:join`
- `room:leave`
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
- `activity:new`
- `presence:update`

## Next Steps

- Add persistent storage for activity history and reactions.
- Add proper WebRTC media room logic for multi-peer calls.
- Add a TURN server for more reliable remote connectivity.
- Replace the test UI with the main ShelfLife frontend once it is uploaded.