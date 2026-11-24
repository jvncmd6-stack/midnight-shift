"use strict";

try { require("dotenv").config(); } catch (_) {}

const path = require("path");
const crypto = require("crypto");
const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const fastifyStatic = require("@fastify/static");
const fastifyRateLimit = require("@fastify/rate-limit");
const { Server } = require("socket.io");

const authMod = require("./auth");
const dbMod = require("./db");
const { RoomManager } = require("./roomManager");
const { createTelegramBot, scheduleGroupCardUpdate } = require("../bot/index");
const { sanitizeAvatar, sanitizeName } = require("../packages/shared/protocol");

const fastify = Fastify({ logger: false });
const memUsers = new Map();

/* ---------- Helper Verifikasi Telegram (Auto-detect dari ./auth + Fallback) ---------- */
function checkTelegramAuth(initData, botToken) {
  if (!initData || typeof initData !== "string") return null;

  if (initData.startsWith("dev:")) {
    const devId = initData.slice(4).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "guest";
    return { id: devId, username: "", first_name: "Pemain" };
  }

  // Coba fungsi yang ada di server/auth.js
  const fn = authMod.verifyTelegramInitData || authMod.verifyInitData || authMod.validateInitData || (typeof authMod === "function" ? authMod : null);
  if (fn) {
    try {
      const res = fn(initData, botToken);
      if (res) return res.user || res;
    } catch (_) {}
  }

  // Fallback HMAC-SHA256 bawaan jika fungsi di ./auth berbeda signature
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    const userRaw = params.get("user");
    if (!userRaw) return null;
    const userObj = JSON.parse(userRaw);

    if (botToken && hash) {
      params.delete("hash");
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
      const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
      if (computedHash !== hash) return null;
    }
    return userObj;
  } catch (_) {
    return null;
  }
}

/* ---------- Helper Database dengan Fallback Memory Anti-Hang ---------- */
async function safeUpsertUser(payload) {
  const tgId = String(payload.telegramId);
  if (typeof dbMod.upsertUser === "function") {
    try {
      const dbUser = await Promise.race([
        dbMod.upsertUser(payload),
        new Promise((_, rej) => setTimeout(() => rej(new Error("DB timeout")), 2500))
      ]);
      if (dbUser) return dbUser;
    } catch (err) {
      console.warn("[DB upsertUser fallback]", err.message);
    }
  }

  if (!memUsers.has(tgId)) {
    memUsers.set(tgId, {
      id: tgId,
      telegramId: tgId,
      username: payload.username || "",
      displayName: payload.displayName || "Pemain",
      coins: 150,
      xp: 0,
      gamesPlayed: 0,
      wins: 0,
      tasksDone: 0,
      unlockedItems: [],
      isBanned: false,
      avatar: { g: "f", skin: 1, hair: 1, hairC: 0, shirt: 0, shirtC: 1, bot: 1, botC: 7, acc: 0 }
    });
  }
  const u = memUsers.get(tgId);
  if (payload.displayName) u.displayName = payload.displayName;
  return u;
}

async function safeUpdateCustomization(tgId, data) {
  if (typeof dbMod.updateUserCustomization === "function") {
    try {
      const updated = await Promise.race([
        dbMod.updateUserCustomization(tgId, data),
        new Promise((_, rej) => setTimeout(() => rej(new Error("DB timeout")), 2500))
      ]);
      if (updated) return updated;
    } catch (_) {}
  }

  const u = await safeUpsertUser({ telegramId: tgId });
  if (data.buyItemKey && data.price) {
    if (u.coins < data.price) throw new Error("Koin tidak cukup");
    if (!u.unlockedItems.includes(data.buyItemKey)) {
      u.coins -= data.price;
      u.unlockedItems.push(data.buyItemKey);
    }
  }
  if (data.displayName) u.displayName = data.displayName;
  if (data.avatar) u.avatar = data.avatar;
  return u;
}

/* ---------- Boot Server ---------- */
async function boot() {
  const initFn = dbMod.initDb || dbMod.initDatabase || dbMod.connectDb;
  if (typeof initFn === "function") {
    await initFn().catch((err) => console.warn("[DB Init]", err.message));
  }

  await fastify.register(fastifyCors, { origin: "*" });
  await fastify.register(fastifyRateLimit, { max: 300, timeWindow: "1 minute" });
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "..", "public"),
    prefix: "/"
  });

  fastify.get("/health", async () => ({ ok: true, time: Date.now() }));

  const io = new Server(fastify.server, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"]
  });

  let bot = null;
  const roomManager = new RoomManager(io, (room, matchResult) => {
    if (bot) scheduleGroupCardUpdate(bot, room, matchResult);
  });

  bot = createTelegramBot(roomManager, io);
  if (bot) {
    bot.start().catch((err) => console.error("[Bot Start]", err.message));
  }

  io.on("connection", (socket) => {
    socket.on("auth:hello", async ({ initData, displayName, avatar } = {}, cb) => {
      try {
        const tgUser = checkTelegramAuth(initData, process.env.BOT_TOKEN);
        if (!tgUser) {
          return typeof cb === "function" && cb({ ok: false, error: "Autentikasi Telegram tidak valid" });
        }

        const rawId = tgUser.id || tgUser.tgId || tgUser.telegramId;
        const user = await safeUpsertUser({
          telegramId: String(rawId),
          username: tgUser.username || "",
          displayName: sanitizeName(displayName || tgUser.first_name || tgUser.displayName || "Pemain")
        });

        if (user.isBanned) {
          return typeof cb === "function" && cb({ ok: false, error: "Akun kamu diblokir Admin" });
        }

        if (avatar && typeof avatar === "object") {
          user.avatar = sanitizeAvatar(avatar);
        }

        const tgId = String(user.telegramId || rawId);
        user.telegramId = tgId;
        socket.data.tgId = tgId;
        socket.data.user = user;

        if (typeof cb === "function") {
          cb({
            ok: true,
            user: {
              tgId,
              displayName: user.displayName,
              coins: user.coins || 0,
              xp: user.xp || 0,
              games: user.gamesPlayed || 0,
              wins: user.wins || 0,
              tasks: user.tasksDone || 0,
              unlockedItems: user.unlockedItems || [],
              avatar: user.avatar
            }
          });
        }
      } catch (err) {
        console.error("[auth:hello]", err);
        if (typeof cb === "function") cb({ ok: false, error: "Gagal autentikasi server" });
      }
    });

    socket.on("user:customize", async ({ displayName, avatar, buyItemKey, price } = {}, cb) => {
      const tgId = socket.data.tgId;
      const user = socket.data.user;
      if (!tgId || !user) return typeof cb === "function" && cb({ error: "Belum login" });

      try {
        const updated = await safeUpdateCustomization(tgId, {
          displayName: displayName ? sanitizeName(displayName) : user.displayName,
          avatar: avatar ? sanitizeAvatar(avatar) : user.avatar,
          buyItemKey,
          price
        });
        Object.assign(user, updated);

        const code = roomManager.userRoom.get(tgId);
        const room = code ? roomManager.rooms.get(code) : null;
        if (room) {
          const m = room.members.get(tgId);
          if (m) {
            m.name = user.displayName;
            m.avatar = user.avatar;
            roomManager.broadcastRoomState(room);
          }
        }

        if (typeof cb === "function") {
          cb({
            ok: true,
            user: {
              coins: user.coins,
              unlockedItems: user.unlockedItems || [],
              displayName: user.displayName,
              avatar: user.avatar
            }
          });
        }
      } catch (err) {
        if (typeof cb === "function") cb({ error: err.message || "Gagal menyimpan karakter" });
      }
    });

    socket.on("room:create", ({ mode = "CLASSIC", isPublic = true } = {}, cb) => {
      const user = socket.data.user;
      if (!user) return typeof cb === "function" && cb({ error: "Belum login" });

      const { room } = roomManager.createRoom({ hostUser: user, mode, isPublic });
      const res = roomManager.joinRoom(room.code, user, socket, false);
      if (res.error) return typeof cb === "function" && cb({ error: res.message });

      if (typeof cb === "function") cb({ ok: true, room: roomManager.serializeRoom(res.room) });
    });

    socket.on("room:join", ({ code } = {}, cb) => {
      const user = socket.data.user;
      if (!user) return typeof cb === "function" && cb({ error: "Belum login" });

      const res = roomManager.joinRoom(code, user, socket, false);
      if (res.error) return typeof cb === "function" && cb({ error: res.message });

      if (typeof cb === "function") cb({ ok: true, room: roomManager.serializeRoom(res.room) });
    });

    socket.on("room:list", (_data, cb) => {
      if (typeof cb === "function") cb({ rooms: roomManager.getPublicRooms() });
    });

    socket.on("room:leave", () => {
      if (socket.data.tgId) roomManager.leaveRoom(socket.data.tgId, socket);
    });

    socket.on("room:ready", () => {
      if (socket.data.tgId) roomManager.toggleReady(socket.data.tgId);
    });

    socket.on("room:settings", ({ mode, isPublic } = {}) => {
      if (socket.data.tgId) roomManager.updateSettings(socket.data.tgId, { mode, isPublic });
    });

    socket.on("room:chat", async ({ text, quickIdx } = {}) => {
      const tgId = socket.data.tgId;
      const user = socket.data.user;
      if (!tgId || !user) return;
      if (typeof dbMod.checkRateLimit === "function") {
        const ok = await dbMod.checkRateLimit(`chat:${tgId}`, 8, 10).catch(() => true);
        if (!ok) return;
      }

      const code = roomManager.userRoom.get(tgId);
      if (!code) return;
      const QUICK = ["Halo semua!", "Siap main!", "Ayo mulai!", "Gas terus!", "Aku bukan Cepu!", "Hati-hati Satpam!", "Kumpul di tengah!", "GG mantap!"];
      const msg = typeof quickIdx === "number" && QUICK[quickIdx]
        ? QUICK[quickIdx]
        : String(text || "").replace(/[<>]/g, "").trim().slice(0, 80);
      if (msg) io.to(code).emit("room:chat_msg", { name: user.displayName, text: msg });
    });

    socket.on("lobby:move", ({ x, z, dir, em, jy } = {}) => {
      const tgId = socket.data.tgId;
      if (!tgId) return;
      const code = roomManager.userRoom.get(tgId);
      if (!code) return;
      roomManager.moveInLobby(tgId, x, z, dir);
      socket.to(code).emit("lobby:peer_move", { tgId, x, z, dir, em, jy });
    });

    socket.on("match:start", ({ fillWithBots = true } = {}, cb) => {
      const tgId = socket.data.tgId;
      if (!tgId) return typeof cb === "function" && cb({ error: "Belum login" });

      const res = roomManager.startMatch(tgId, fillWithBots);
      if (res.error) return typeof cb === "function" && cb({ error: res.message });
      if (typeof cb === "function") cb({ ok: true });
    });

    socket.on("match:input", ({ ix, iy, angle } = {}) => {
      const tgId = socket.data.tgId;
      const code = tgId ? roomManager.userRoom.get(tgId) : null;
      const room = code ? roomManager.rooms.get(code) : null;
      if (room && room.engine) {
        room.engine.setPlayerInput(tgId, { ix, iy, aim: angle });
      }
    });

    socket.on("match:action", ({ action, ...data } = {}) => {
      const tgId = socket.data.tgId;
      const code = tgId ? roomManager.userRoom.get(tgId) : null;
      const room = code ? roomManager.rooms.get(code) : null;
      if (room && room.engine) {
        room.engine.handleAction(tgId, action, data);
      }
    });

    socket.on("disconnect", () => {
      if (socket.data.tgId) {
        roomManager.handleSocketDisconnect(socket.data.tgId);
      }
    });
  });

  const PORT = Number(process.env.PORT) || 3000;
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Midnight Shift server running on port ${PORT}`);
}

boot().catch((err) => {
  console.error("Server boot failed:", err);
  process.exit(1);
});
