import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const CURSOR_TTL_SECONDS = 120;
const DECAY_TTL_SECONDS = 7 * 24 * 60 * 60;

let ioRef = null;
let redisWriteClient = null;

const toSafeString = (value, fallback = "") => {
    if (typeof value === "string") {
        return value;
    }

    if (value === null || value === undefined) {
        return fallback;
    }

    return String(value);
};

const buildRedisUrl = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }

    if (process.env.UPSTASH_REDIS_URL) {
        return process.env.UPSTASH_REDIS_URL;
    }

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!restUrl || !restToken) {
        return null;
    }

    const { hostname } = new URL(restUrl);
    const encodedToken = encodeURIComponent(restToken);

    return `rediss://default:${encodedToken}@${hostname}:6379`;
};

export const initializeRealtimeSynapse = async (io) => {
    ioRef = io;

    const redisUrl = buildRedisUrl();
    if (!redisUrl) {
        console.log("Realtime synapse: Redis is not configured, running in single-node mode.");
        return { enabled: false };
    }

    try {
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();
        redisWriteClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect(), redisWriteClient.connect()]);

        io.adapter(createAdapter(pubClient, subClient));
        console.log("Realtime synapse: Redis adapter connected for cross-node alignment.");

        return { enabled: true };
    } catch (error) {
        console.error("Realtime synapse: failed to initialize Redis adapter, falling back to single-node mode.", error.message);
        redisWriteClient = null;
        return { enabled: false, error: error.message };
    }
};

export const publishCursorTelemetry = async ({ roomId, userId, username, x, y, createdAt }) => {
    if (!redisWriteClient || !roomId || !userId) {
        return;
    }

    const key = `synapse:cursor:${toSafeString(roomId)}:${toSafeString(userId)}`;
    const payload = JSON.stringify({
        roomId: toSafeString(roomId),
        userId: toSafeString(userId),
        username: toSafeString(username, "Guest"),
        x: Number.isFinite(Number(x)) ? Number(x) : 0,
        y: Number.isFinite(Number(y)) ? Number(y) : 0,
        createdAt: createdAt || new Date().toISOString(),
    });

    try {
        await redisWriteClient.set(key, payload, { EX: CURSOR_TTL_SECONDS });
    } catch (error) {
        console.warn("Realtime synapse: failed to persist cursor telemetry.", error.message);
    }
};

export const publishDecayTelemetry = async ({ projectId, linkId, status, reason, trigger, userId, createdAt }) => {
    const payload = {
        projectId: toSafeString(projectId),
        linkId: toSafeString(linkId),
        status: toSafeString(status),
        reason: toSafeString(reason),
        trigger: toSafeString(trigger),
        userId: toSafeString(userId),
        createdAt: createdAt || new Date().toISOString(),
    };

    if (ioRef && payload.projectId) {
        ioRef.to(payload.projectId).emit("decay:signal", payload);
    }

    if (!redisWriteClient || !payload.projectId || !payload.linkId) {
        return;
    }

    const key = `synapse:decay:${payload.projectId}:${payload.linkId}`;

    try {
        await redisWriteClient.set(key, JSON.stringify(payload), { EX: DECAY_TTL_SECONDS });
    } catch (error) {
        console.warn("Realtime synapse: failed to persist decay telemetry.", error.message);
    }
};