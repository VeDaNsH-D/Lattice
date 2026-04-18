import "dotenv/config";

import http from "http";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import os from "os";
import path from "path";
import { Server } from "socket.io";

import {
    globalErrorHandler,
    notFoundHandler
} from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import linkRoutes from "./routes/link.routes.js";
import pulseRoutes from "./routes/pulse.routes.js";
import { scheduleDailyPulseJob } from "./services/daily-pulse.service.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const rooms = new Map();

app.use(cors());
app.use(express.json());
app.use("/media", express.static(path.join(process.cwd(), "generated")));

const PORT = process.env.PORT || 8000;

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            users: new Map(),
            activity: [],
        });
    }

    return rooms.get(roomId);
}

function createActivity(roomId, type, message, extra = {}) {
    const room = getRoom(roomId);
    const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        roomId,
        type,
        message,
        createdAt: new Date().toISOString(),
        ...extra,
    };

    room.activity.push(entry);

    if (room.activity.length > 100) {
        room.activity.shift();
    }

    io.to(roomId).emit("activity:new", entry);

    return entry;
}

function emitPresence(roomId) {
    const room = getRoom(roomId);

    io.to(roomId).emit("presence:update", {
        roomId,
        users: Array.from(room.users.values()),
    });
}

function sanitizeText(value, fallback = "") {
    if (typeof value !== "string") {
        return fallback;
    }

    return value.trim();
}

function removeSocketFromRoom(socket, roomId, options = {}) {
    if (!roomId || !rooms.has(roomId)) {
        return;
    }

    const room = rooms.get(roomId);
    const user = room.users.get(socket.id);

    socket.leave(roomId);
    room.users.delete(socket.id);

    if (user && options.announce !== false) {
        createActivity(roomId, "user-left", `${user.username} left ${roomId}.`, {
            user,
        });

        socket.to(roomId).emit("room:user-left", { roomId, user });
    }

    emitPresence(roomId);

    if (room.users.size === 0) {
        rooms.delete(roomId);
    }
}

/* MongoDB connection */
if (process.env.MONGO_URI) {
    mongoose
        .connect(process.env.MONGO_URI)
        .then(() => {
            console.log("Mongo connected");
        })
        .catch((err) => {
            console.error("Mongo connection error:", err);
        });
} else {
    console.log("Mongo URI not set; skipping database connection for local realtime testing.");
}

/* Root route */
app.get("/", (req, res) => {
    res.json({
        ok: true,
        service: "lattice-realtime-backend",
        message: "Backend is running",
    });
});

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

io.on("connection", (socket) => {
    socket.on("room:join", (payload = {}, ack) => {
        const roomId = sanitizeText(payload.roomId, "lobby") || "lobby";
        const username = sanitizeText(payload.username, "Guest") || "Guest";

        socket.data.roomId = roomId;
        socket.data.username = username;

        const room = getRoom(roomId);
        const user = {
            id: socket.id,
            username,
            joinedAt: new Date().toISOString(),
        };

        socket.join(roomId);
        room.users.set(socket.id, user);

        createActivity(roomId, "user-joined", `${username} joined ${roomId}.`, {
            user,
        });

        emitPresence(roomId);

        const state = {
            roomId,
            me: user,
            users: Array.from(room.users.values()),
            activity: room.activity,
        };

        socket.emit("room:state", state);
        socket.to(roomId).emit("room:user-joined", { roomId, user });

        if (typeof ack === "function") {
            ack({ ok: true, ...state });
        }
    });

    socket.on("chat:send", (payload = {}, ack) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";
        const message = sanitizeText(payload.message);

        if (!message) {
            if (typeof ack === "function") {
                ack({ ok: false, error: "Message cannot be empty." });
            }

            return;
        }

        const room = getRoom(roomId);
        const user = room.users.get(socket.id) || {
            id: socket.id,
            username: socket.data.username || "Guest",
        };

        const chatEvent = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            roomId,
            sender: user,
            message,
            createdAt: new Date().toISOString(),
        };

        createActivity(roomId, "chat", `${user.username}: ${message}`, {
            sender: user,
            message,
        });

        io.to(roomId).emit("chat:new", chatEvent);

        if (typeof ack === "function") {
            ack({ ok: true, messageId: chatEvent.id });
        }
    });

    socket.on("reaction:send", (payload = {}, ack) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";
        const reaction = sanitizeText(payload.reaction);
        const targetId = sanitizeText(payload.targetId);
        const targetType = sanitizeText(payload.targetType, "room") || "room";
        const label = sanitizeText(payload.label, reaction);

        if (!reaction) {
            if (typeof ack === "function") {
                ack({ ok: false, error: "Reaction cannot be empty." });
            }

            return;
        }

        const room = getRoom(roomId);
        const user = room.users.get(socket.id) || {
            id: socket.id,
            username: socket.data.username || "Guest",
        };

        const reactionEvent = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            roomId,
            sender: user,
            reaction,
            label,
            targetId,
            targetType,
            createdAt: new Date().toISOString(),
        };

        createActivity(roomId, "reaction", `${user.username} reacted with ${label}.`, {
            sender: user,
            reaction,
            label,
            targetId,
            targetType,
        });

        io.to(roomId).emit("reaction:new", reactionEvent);

        if (typeof ack === "function") {
            ack({ ok: true, reactionId: reactionEvent.id });
        }
    });

    socket.on("cursor:move", (payload = {}) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";
        const cursor = {
            userId: socket.id,
            username: socket.data.username || "Guest",
            x: Number.isFinite(payload.x) ? payload.x : 0,
            y: Number.isFinite(payload.y) ? payload.y : 0,
            createdAt: new Date().toISOString(),
        };

        socket.to(roomId).emit("cursor:update", cursor);
    });

    socket.on("screen-share:start", (payload = {}) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";

        createActivity(roomId, "screen-share-start", `${socket.data.username || "Guest"} started screen share.`);
        socket.to(roomId).emit("screen-share:state", {
            roomId,
            active: true,
            userId: socket.id,
            username: socket.data.username || "Guest",
        });
    });

    socket.on("screen-share:stop", (payload = {}) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";

        createActivity(roomId, "screen-share-stop", `${socket.data.username || "Guest"} stopped screen share.`);
        socket.to(roomId).emit("screen-share:state", {
            roomId,
            active: false,
            userId: socket.id,
            username: socket.data.username || "Guest",
        });
    });

    socket.on("room:leave", (payload = {}, ack) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";

        removeSocketFromRoom(socket, roomId);

        if (socket.data.roomId === roomId) {
            socket.data.roomId = null;
        }

        if (typeof ack === "function") {
            ack({ ok: true });
        }
    });

    socket.on("webrtc:signal", (payload = {}) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";

        socket.to(roomId).emit("webrtc:signal", {
            roomId,
            from: socket.id,
            username: socket.data.username || "Guest",
            signal: payload.signal,
        });
    });

    socket.on("call:leave", (payload = {}) => {
        const roomId = sanitizeText(payload.roomId, socket.data.roomId || "lobby") || "lobby";

        createActivity(roomId, "call-leave", `${socket.data.username || "Guest"} left the call.`);
        socket.to(roomId).emit("call:leave", {
            roomId,
            userId: socket.id,
            username: socket.data.username || "Guest",
        });
    });

    socket.on("disconnect", () => {
        const roomId = socket.data.roomId;

        removeSocketFromRoom(socket, roomId, { announce: true });
    });
});

/* App routes */
app.use("/api/auth", authRoutes);
app.use("/api/links", linkRoutes);
app.use("/api/pulse", pulseRoutes);

/* Not found + global errors */
app.use(notFoundHandler);
app.use(globalErrorHandler);

/* Start server */
scheduleDailyPulseJob();

server.listen(PORT, () => {
    const networkInterfaces = os.networkInterfaces();
    let networkIP = "localhost";

    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === "IPv4" && !net.internal) {
                networkIP = net.address;
            }
        }
    }

    console.log("🚀 Backend running on:");
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${networkIP}:${PORT}`);
});
