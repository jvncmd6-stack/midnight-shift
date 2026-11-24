"use strict";

const path = require("path");
const Fastify = require("fastify");
const fastifyStatic = require("@fastify/static");
const fastifyCors = require("@fastify/cors");
const fastifyRateLimit = require("@fastify/rate-limit");
const { Server } = require("socket.io");

const {
  verifyTelegramInitData,
  signSessionToken,
  verifySessionToken,
  createGuestIdentity
} = require("./auth");
const {
  initDatabases,
  upsertUser,
  updateUserCustomization,
  getLeaderboard,
  checkRateLimit
} = require("./db");
const { RoomManager } = require("./roomManager");
const { createTelegramBot, scheduleGroupCardUpdate } = require("../bot/index");
const { validateMoveInput, sanitizeText, QUICK_CHATS } = require("../packages/shared/protocol");

const PORT = Number(process.env.PORT || 3000);
const rawWebappUrl = String(process.env.WEBAPP_URL || "").trim().replace(/\/$/, "");
const WEBAPP_URL = rawWebappUrl
  ? (rawWebappUrl.startsWith("http") ? rawWebappUrl : `https://${rawWebappUrl}`)
  : "";

async function bootstrap() {
  await initDatabases();

  const fastify = Fastify({ logger: false, trustProxy: true });

  await fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === "production" && WEBAPP_URL ? [WEBAPP_URL, "https://web.telegram.org"] : true
  });

  await fastify.register(fastifyRateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/"
  });

  fastify.get("/health", async () => ({ ok: true, ts: Date.now() }));

  const io = new Server(fastify.server, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 15000
  });

  let bot = null;
  const roomManager = new RoomManager(io, (room, matchResult) => {
    scheduleGroupCardUpdate(bot, room, matchResult);
  });

  bot = createTelegramBot(roomManager, io);

  fastify.post("/api/auth", async (req, reply) => {
    const body = req.body || {};
    let identity = verifyTelegramInitData(body.initData);

    if (!identity && process.env.NODE_ENV !== "production") {
      identity = createGuestIdentity(body.guestId, body.guestName);
    }

    if (!identity) {
      return reply.code(401).send({ error: "INVALID_SESSION", message: "Autentikasi Telegram gagal." });
    }

    const user = await upsertUser(identity);

    if (user.isBanned) {
      return reply.code(403).send({
        error: "BANNED",
        message: "Akun kamu telah diblokir oleh Admin."
      });
    }

    const token = signSessionToken(user);

    return {
      token,
      user,
      startParam: identity.startParam,
      publicRooms: roomManager.getPublicRooms()
    };
  });

  fastify.post("/api/customize", async (req, reply) => {
    const authHeader = req.headers.authorization || "";
    const session = verifySessionToken(authHeader.replace("Bearer ", ""));
    if (!session) return reply.code(401).send({ error: "UNAUTHORIZED" });

    const body = req.body || {};
    const result = await updateUserCustomization(session.uid, {
      displayName: body.displayName,
      avatar: body.avatar,
      buyItemKey: body.buyItemKey,
      price: body.price
    });

    if (!result) return reply.code(400).send({ error: "UPDATE_FAILED" });
    return result;
  });

  fastify.get("/api/rooms", async () => ({ rooms: roomManager.getPublicRooms() }));
  fastify.get("/api/leaderboard", async () => ({ leaderboard: await getLeaderboard(10) }));

  io.use(async (socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const session = verifySessionToken(token);
    if (!session) return next(new Error("INVALID_SESSION"));

    const user = await upsertUser({
      telegramId: session.tgId,
      displayName: session.name
    });
    if (user.isBanned) return next(new Error("BANNED"));

    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const tgId = user.telegramId;

    const activeCode = roomManager.userRoom.get(tgId);
    if (activeCode) {
      roomManager.joinRoom(activeCode, user, socket);
    }

    socket.on("room:create", async (payload = {}, cb) => {
      if (!(await checkRateLimit(`rc:${tgId}`, 5, 30))) return;
      const res = roomManager.createRoom({
        hostUser: user,
        mode: payload.mode || "CLASSIC",
        isPublic: payload.isPublic !== false
      });
      roomManager.joinRoom(res.room.code, user, socket);
      if (cb) cb({ ok: true, code: res.room.code });
    });

    socket.on("room:join", async (payload = {}, cb) => {
      if (!(await checkRateLimit(`rj:${tgId}`, 10, 30))) return;
      const res = roomManager.joinRoom(payload.code, user, socket);
      if (cb) cb(res.error ? { ok: false, error: res.error, message: res.message } : { ok: true, code: res.room.code });
    });

    socket.on("room:leave", () => {
      roomManager.leaveRoom(tgId, socket);
    });

    socket.on("room:ready", () => {
      roomManager.toggleReady(tgId);
    });

    socket.on("room:settings", (payload = {}) => {
      roomManager.updateSettings(tgId, payload);
    });

    socket.on("room:start", (payload = {}, cb) => {
      const res = roomManager.startMatch(tgId, payload.fillWithBots !== false);
      if (cb) cb(res);
    });

    socket.on("lobby:move", (payload = {}) => {
      if (Number.isFinite(payload.x) && Number.isFinite(payload.z)) {
        roomManager.moveInLobby(tgId, payload.x, payload.z, payload.dir);
        const code = socket.data.roomCode;
        if (code) {
          socket.to(code).emit("lobby:peerMove", {
            tgId,
            x: payload.x,
            z: payload.z,
            dir: payload.dir || 0,
            em: payload.em || 0,
            jy: payload.jy || 0
          });
        }
      }
    });

    socket.on("chat:send", async (payload = {}) => {
      const code = socket.data.roomCode;
      if (!code) return;
      if (!(await checkRateLimit(`chat:${tgId}`, 4, 5))) return;

      let text = "";
      if (typeof payload.quickIdx === "number" && QUICK_CHATS[payload.quickIdx]) {
        text = QUICK_CHATS[payload.quickIdx];
      } else {
        text = sanitizeText(payload.text, 140);
      }
      if (!text) return;

      io.to(code).emit("chat:message", {
        tgId,
        name: user.displayName,
        text,
        ts: Date.now()
      });
    });

    socket.on("player:input", (payload) => {
      const code = socket.data.roomCode;
      const room = code ? roomManager.rooms.get(code) : null;
      if (!room || !room.engine) return;
      const valid = validateMoveInput(payload);
      if (valid) room.engine.setPlayerInput(tgId, valid);
    });

    socket.on("player:action", (payload = {}) => {
      const code = socket.data.roomCode;
      const room = code ? roomManager.rooms.get(code) : null;
      if (!room || !room.engine || typeof payload.type !== "string") return;
      room.engine.handleAction(tgId, payload.type, payload);
    });

    socket.on("disconnect", () => {
      roomManager.handleSocketDisconnect(tgId);
    });
  });

  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[Server] Midnight Shift berjalan di port ${PORT}`);

  // Jalankan Bot Telegram dengan Long Polling (Anti-Gagal Webhook)
  if (bot) {
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      if (WEBAPP_URL) {
        await bot.api.setChatMenuButton({
          menu_button: {
            type: "web_app",
            text: "Main Game",
            web_app: { url: WEBAPP_URL }
          }
        });
      }
      bot.start({
        onStart: (botInfo) => {
          console.log(`[Bot] @${botInfo.username} aktif (Polling Mode)!`);
        }
      });
    } catch (err) {
      console.error("[Bot Setup Error]", err.message);
    }
  }
}

bootstrap().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
