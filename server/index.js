"use strict";

try { require("dotenv").config(); } catch (_) {}

const path = require("path");
const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const fastifyStatic = require("@fastify/static");
const fastifyRateLimit = require("@fastify/rate-limit");
const { Server } = require("socket.io");

const { verifyInitData } = require("./auth");
const { initDb, upsertUser, updateUserCustomization, checkRateLimit } = require("./db");
const { RoomManager } = require("./roomManager");
const { createTelegramBot, scheduleGroupCardUpdate } = require("../bot/index");
const { sanitizeAvatar, sanitizeName } = require("../packages/shared/protocol");

const fastify = Fastify({ logger: false });

async function boot() {
  if (typeof initDb === "function") {
    await initDb().catch((err) => console.warn("[DB]", err.message));
  }

  await fastify.register(fastifyCors, { origin: "*" });
  await fastify.register(fastifyRateLimit, { max: 250, timeWindow: "1 minute" });
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "..", "public"),
    prefix: "/"
  });

  fastify.get("/health", async () => ({ ok: true, time: Date.now() }));

  const io = new Server(fastify.server, { cors: { origin: "*" } });

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
        let tgUser = null;
        if (typeof initData === "string" && initData.startsWith("dev:")) {
          const devId = initData.slice(4).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "guest";
          tgUser = { id: devId, username: "", first_name: displayName || "Pemain" };
        } else {
          const verified = verifyInitData(initData, process.env.BOT_TOKEN);
          if (!verified) {
            return typeof cb === "function" && cb({ ok: false, error: "Autentikasi Telegram tidak valid" });
          }
          tgUser = verified.user || verified;
        }

        const user = await upsertUser({
          telegramId: String(tgUser.id || tgUser.tgId),
          username: tgUser.username || "",
          displayName: sanitizeName(displayName || tgUser.first_name || "Pemain")
        });

        if (user.isBanned) {
          return typeof cb === "function" && cb({ ok: false, error: "Akun kamu diblokir Admin" });
        }

        if (avatar && typeof avatar === "object") {
          user.avatar = sanitizeAvatar(avatar);
        }

        socket.data.tgId = String(user.telegramId);
        socket.data.user = user;

        if (typeof cb === "function") {
          cb({
            ok: true,
            user: {
              tgId: String(user.telegramId),
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
        console.error("[auth:hello]", err.message);
        if (typeof cb === "function") cb({ ok: false, error: "Gagal autentikasi" });
      }
    });

    socket.on("user:customize", async ({ displayName, avatar, buyItemKey, price } = {}, cb) => {
      const tgId = socket.data.tgId;
      const user = socket.data.user;
      if (!tgId || !user) return typeof cb === "function" && cb({ error: "Belum login" });

      try {
        const updated = await updateUserCustomization(tgId, {
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
      if (!(await checkRateLimit(`chat:${tgId}`, 8, 10))) return;

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
