"use strict";

require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const { verifyTelegramInitData } = require("./auth/telegram");
const { createMatch, stepMatch, applyPlayerInput, applyPlayerAction, buildPlayerSnapshot } = require("./game/match");
const { startTelegramBot, notifyRoomUpdated } = require("./bot/index");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

const users = new Map();
const rooms = new Map();
const matches = new Map();

function getOrCreateUser(tgId, firstName = "Pemain") {
  const id = String(tgId);
  if (!users.has(id)) {
    users.set(id, {
      tgId: id,
      displayName: String(firstName).slice(0, 12) || "Pemain",
      coins: 150,
      xp: 0,
      games: 0,
      wins: 0,
      tasks: 0,
      unlockedItems: [],
      avatar: { g: "f", skin: 1, hair: 1, hairC: 0, shirt: 0, shirtC: 1, bot: 1, botC: 7, acc: 0 }
    });
  }
  return users.get(id);
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostTgId: String(room.hostTgId),
    hostName: room.hostName,
    mode: room.mode,
    isPublic: room.isPublic,
    phase: room.phase,
    members: room.members.map((m) => ({
      tgId: String(m.tgId),
      name: m.name,
      ready: !!m.ready,
      avatar: m.avatar,
      x: m.x || 24,
      z: m.z || 13
    }))
  };
}

function createRoomRecord({ hostTgId, hostName, mode = "CLASSIC", isPublic = true, chatId = null }) {
  const code = makeRoomCode();
  const room = {
    code,
    hostTgId: String(hostTgId),
    hostName: String(hostName || "Host").slice(0, 12),
    mode,
    isPublic,
    phase: "LOBBY",
    chatId,
    messageId: null,
    members: []
  };
  rooms.set(code, room);
  return room;
}

function joinRoomMember(room, user, socketId = null) {
  const id = String(user.tgId);
  let member = room.members.find((m) => String(m.tgId) === id);
  if (!member) {
    if (room.members.length >= 20) return null;
    member = {
      tgId: id,
      name: user.displayName,
      avatar: user.avatar,
      ready: String(room.hostTgId) === id,
      socketId,
      x: 22 + Math.random() * 4,
      z: 12 + Math.random() * 2
    };
    room.members.push(member);
  } else {
    member.name = user.displayName;
    member.avatar = user.avatar;
    if (socketId) member.socketId = socketId;
  }
  return member;
}

/* ---------- Socket.IO Multiplayer Handlers ---------- */
io.on("connection", (socket) => {
  socket.on("auth:hello", ({ initData, displayName, avatar } = {}, cb) => {
    const verified = verifyTelegramInitData(initData, process.env.BOT_TOKEN);
    if (!verified) {
      if (typeof cb === "function") cb({ ok: false, error: "Autentikasi Telegram tidak valid" });
      return;
    }
    const user = getOrCreateUser(verified.tgId, displayName || verified.firstName);
    if (displayName) user.displayName = String(displayName).slice(0, 12);
    if (avatar && typeof avatar === "object") user.avatar = avatar;

    socket.data.tgId = String(user.tgId);
    if (typeof cb === "function") cb({ ok: true, user });
  });

  socket.on("user:customize", ({ displayName, avatar, buyItemKey, price } = {}, cb) => {
    const user = users.get(socket.data.tgId);
    if (!user) return typeof cb === "function" && cb({ error: "Belum login" });

    if (buyItemKey && price) {
      if (user.coins < price) return typeof cb === "function" && cb({ error: "Koin tidak cukup" });
      if (!user.unlockedItems.includes(buyItemKey)) {
        user.coins -= price;
        user.unlockedItems.push(buyItemKey);
      }
    }
    if (displayName) user.displayName = String(displayName).slice(0, 12);
    if (avatar && typeof avatar === "object") user.avatar = avatar;

    const room = rooms.get(socket.data.roomCode);
    if (room) {
      const m = room.members.find((x) => String(x.tgId) === user.tgId);
      if (m) {
        m.name = user.displayName;
        m.avatar = user.avatar;
        io.to(room.code).emit("room:updated", serializeRoom(room));
      }
    }
    if (typeof cb === "function") cb({ ok: true, user });
  });

  socket.on("room:create", ({ mode = "CLASSIC", isPublic = true } = {}, cb) => {
    const user = users.get(socket.data.tgId);
    if (!user) return typeof cb === "function" && cb({ error: "Belum login" });

    const room = createRoomRecord({ hostTgId: user.tgId, hostName: user.displayName, mode, isPublic });
    joinRoomMember(room, user, socket.id);
    socket.data.roomCode = room.code;
    socket.join(room.code);

    const payload = serializeRoom(room);
    if (typeof cb === "function") cb({ ok: true, room: payload });
    io.to(room.code).emit("room:updated", payload);
  });

  socket.on("room:join", ({ code } = {}, cb) => {
    const user = users.get(socket.data.tgId);
    if (!user) return typeof cb === "function" && cb({ error: "Belum login" });

    const room = rooms.get(String(code || "").toUpperCase().trim());
    if (!room) return typeof cb === "function" && cb({ error: "Kode room tidak ditemukan" });
    if (room.phase !== "LOBBY") return typeof cb === "function" && cb({ error: "Permainan sedang berlangsung" });

    const m = joinRoomMember(room, user, socket.id);
    if (!m) return typeof cb === "function" && cb({ error: "Room sudah penuh (20/20)" });

    socket.data.roomCode = room.code;
    socket.join(room.code);

    const payload = serializeRoom(room);
    if (typeof cb === "function") cb({ ok: true, room: payload });
    io.to(room.code).emit("room:updated", payload);
    notifyRoomUpdated(room);
  });

  socket.on("room:list", (_data, cb) => {
    const list = [];
    for (const r of rooms.values()) {
      if (r.isPublic && r.phase === "LOBBY") {
        list.push({ code: r.code, hostName: r.hostName, mode: r.mode, count: r.members.length, max: 20 });
      }
    }
    if (typeof cb === "function") cb({ rooms: list });
  });

  socket.on("room:leave", ({ code } = {}) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room) return;
    room.members = room.members.filter((m) => String(m.tgId) !== socket.data.tgId);
    socket.leave(room.code);
    socket.data.roomCode = null;

    if (room.members.length === 0) {
      rooms.delete(room.code);
      matches.delete(room.code);
    } else {
      if (String(room.hostTgId) === socket.data.tgId) {
        room.hostTgId = String(room.members[0].tgId);
        room.hostName = room.members[0].name;
      }
      io.to(room.code).emit("room:updated", serializeRoom(room));
      notifyRoomUpdated(room);
    }
  });

  socket.on("room:ready", ({ code } = {}) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room) return;
    const m = room.members.find((x) => String(x.tgId) === socket.data.tgId);
    if (m) {
      m.ready = !m.ready;
      io.to(room.code).emit("room:updated", serializeRoom(room));
    }
  });

  socket.on("room:settings", ({ code, mode } = {}) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room || String(room.hostTgId) !== socket.data.tgId) return;
    if (mode) room.mode = mode;
    io.to(room.code).emit("room:updated", serializeRoom(room));
  });

  socket.on("room:chat", ({ code, text, quickIdx } = {}) => {
    const room = rooms.get(code || socket.data.roomCode);
    const user = users.get(socket.data.tgId);
    if (!room || !user) return;
    const QUICK = ["Halo semua!", "Siap main!", "Ayo mulai!", "Gas terus!", "Aku bukan Cepu!", "Hati-hati Satpam!", "Kumpul di tengah!", "GG mantap!"];
    const msg = typeof quickIdx === "number" && QUICK[quickIdx] ? QUICK[quickIdx] : String(text || "").replace(/[<>]/g, "").trim().slice(0, 80);
    if (msg) io.to(room.code).emit("room:chat_msg", { name: user.displayName, text: msg });
  });

  socket.on("lobby:move", ({ code, x, z, dir, em, jy } = {}) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room || room.phase !== "LOBBY") return;
    const m = room.members.find((u) => String(u.tgId) === socket.data.tgId);
    if (m) {
      m.x = x;
      m.z = z;
    }
    socket.to(room.code).emit("lobby:peer_move", { tgId: socket.data.tgId, x, z, dir, em, jy });
  });

  socket.on("match:start", ({ code, fillWithBots = true } = {}, cb) => {
    const room = rooms.get(code || socket.data.roomCode);
    if (!room) return typeof cb === "function" && cb({ error: "Room tidak ditemukan" });
    if (String(room.hostTgId) !== socket.data.tgId) return typeof cb === "function" && cb({ error: "Hanya host yang bisa memulai" });
    if (!fillWithBots && room.members.length < 3) {
      return typeof cb === "function" && cb({ error: "Minimal 3 pemain jika Bot mati" });
    }

    room.phase = "PLAYING";
    const match = createMatch(room, { fillWithBots, minPlayers: fillWithBots ? 6 : room.members.length });
    matches.set(room.code, match);

    io.to(room.code).emit("room:updated", serializeRoom(room));
    notifyRoomUpdated(room);

    for (const m of room.members) {
      const p = match.players.get(String(m.tgId));
      if (p && m.socketId) {
        io.to(m.socketId).emit("match:started", {
          role: p.role,
          roleName: p.roleName,
          team: p.team
        });
        io.to(m.socketId).emit("match:snapshot", buildPlayerSnapshot(match, String(m.tgId)));
      }
    }
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("match:input", ({ code, seq, ix, iy, angle } = {}) => {
    const match = matches.get(code || socket.data.roomCode);
    if (!match) return;
    applyPlayerInput(match, socket.data.tgId, { seq, ix, iy, angle });
  });

  socket.on("match:action", ({ code, action, ...data } = {}) => {
    const match = matches.get(code || socket.data.roomCode);
    if (!match) return;
    const events = applyPlayerAction(match, socket.data.tgId, action, data);
    if (Array.isArray(events)) {
      events.forEach((ev) => io.to(match.code).emit("match:event", ev));
    }
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    room.members = room.members.filter((m) => String(m.tgId) !== socket.data.tgId);
    if (room.members.length === 0) {
      rooms.delete(room.code);
      matches.delete(room.code);
    } else {
      if (String(room.hostTgId) === socket.data.tgId) {
        room.hostTgId = String(room.members[0].tgId);
        room.hostName = room.members[0].name;
      }
      io.to(room.code).emit("room:updated", serializeRoom(room));
      notifyRoomUpdated(room);
    }
  });
});

/* ---------- Game Simulation Loop (20 Tick/Detik) ---------- */
setInterval(() => {
  const dt = 0.05;
  for (const [code, match] of matches.entries()) {
    const room = rooms.get(code);
    if (!room) {
      matches.delete(code);
      continue;
    }

    const result = stepMatch(match, dt);
    if (result && result.meetingUpdate) {
      io.to(code).emit("match:meeting", result.meetingUpdate);
    }

    if (result && result.ended) {
      room.phase = "LOBBY";
      matches.delete(code);
      io.to(code).emit("room:updated", serializeRoom(room));
      notifyRoomUpdated(room);

      for (const m of room.members) {
        const p = match.players.get(String(m.tgId));
        const u = users.get(String(m.tgId));
        const won = p ? result.winningTeams.includes(p.team) : false;
        const reward = { win: won, coins: won ? 45 : 15, xp: won ? 60 : 25 };
        if (u) {
          u.coins += reward.coins;
          u.xp += reward.xp;
          u.games += 1;
          if (won) u.wins += 1;
        }
        if (m.socketId) {
          io.to(m.socketId).emit("match:ended", {
            reason: result.reason,
            players: result.summary,
            yourReward: reward
          });
        }
      }
      continue;
    }

    for (const m of room.members) {
      if (m.socketId) {
        io.to(m.socketId).emit("match:snapshot", buildPlayerSnapshot(match, String(m.tgId)));
      }
    }
  }
}, 50);

startTelegramBot({
  rooms,
  getOrCreateUser,
  createRoomRecord,
  joinRoomMember,
  serializeRoom
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Midnight Shift server running on port ${PORT}`));
