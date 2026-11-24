"use strict";

try { require("dotenv").config(); } catch (_) {}

const path = require("path");
const crypto = require("crypto");
const Fastify = require("fastify");
const fastifyCors = require("@fastify/cors");
const fastifyStatic = require("@fastify/static");
const fastifyRateLimit = require("@fastify/rate-limit");
const { Server } = require("socket.io");
const { Bot, InlineKeyboard } = require("grammy");

const fastify = Fastify({ logger: false });

const users = new Map();
const rooms = new Map();
const matches = new Map();

/* ==========================================================================
   1. AUTENTIKASI TELEGRAM MINI APP (HMAC-SHA256)
   ========================================================================== */
function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== "string") return null;

  // Mode browser / testing luar Telegram
  if (initData.startsWith("dev:")) {
    const devId = initData.slice(4).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "guest";
    return { tgId: devId, firstName: "Pemain" };
  }

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

    return {
      tgId: String(userObj.id),
      firstName: userObj.first_name || userObj.username || "Pemain"
    };
  } catch (_) {
    return null;
  }
}

/* ==========================================================================
   2. MANAJEMEN USER & ROOM
   ========================================================================== */
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

/* ==========================================================================
   3. GAME SIMULATION ENGINE (PROP HUNT & SOCIAL DEDUCTION)
   ========================================================================== */
const SOLID_BOXES = [
  [41, 2, 18, 3], [36, 29, 5, 2], [44, 29, 5, 2],
  [16, 29, 4, 2], [23, 29, 4, 2], [5, 6, 4, 2],
  [14, 11, 4, 2], [9, 14, 4, 2], [19, 5, 3, 2], [2, 34, 6, 2],
  [19.65, 19.05, 0.7, 0.55], [43.65, 19.05, 0.7, 0.55],
  [19.65, 24.15, 0.7, 0.55], [43.65, 24.15, 0.7, 0.55],
  [9.65, 21.55, 0.7, 0.55], [53.65, 21.55, 0.7, 0.55]
];

const PROP_TYPES = ["cone", "galon", "pot", "drum", "speaker", "palet"];
const TASK_TYPES = ["wiring", "keypad", "slider"];
const BOT_NAMES = ["Budi", "Siti", "Andi", "Rina", "Dedi", "Tono", "Maya", "Eko", "Lina", "Agus"];

function isBlockedPos(match, x, z) {
  if (x < 1.4 || x > 62.6 || z < 1.6 || z > 42.6) return true;
  for (let i = 0; i < SOLID_BOXES.length; i++) {
    const s = SOLID_BOXES[i];
    if (x > s[0] - 0.35 && x < s[0] + s[2] + 0.35 && z > s[1] - 0.15 && z < s[1] + s[3] + 0.35) {
      return true;
    }
  }
  for (let i = 0; i < match.props.length; i++) {
    const p = match.props[i];
    if (Math.hypot(x - p.x, z - p.z) < 0.65) return true;
  }
  return false;
}

function createMatch(room, { fillWithBots = true, minPlayers = 6 } = {}) {
  const participants = room.members.map((m) => ({
    id: String(m.tgId),
    name: m.name,
    avatar: m.avatar,
    isBot: false
  }));

  if (fillWithBots) {
    let bIdx = 0;
    while (participants.length < minPlayers) {
      const bName = BOT_NAMES[bIdx % BOT_NAMES.length] + (bIdx >= BOT_NAMES.length ? bIdx : "");
      participants.push({
        id: "bot_" + bIdx,
        name: bName,
        isBot: true,
        avatar: {
          g: bIdx % 2 ? "m" : "f",
          skin: bIdx % 6,
          hair: (bIdx * 3) % 18,
          hairC: bIdx % 8,
          shirt: (bIdx * 5) % 18,
          shirtC: (bIdx + 2) % 8,
          bot: (bIdx * 2) % 18,
          botC: (bIdx + 4) % 8,
          acc: bIdx % 18
        }
      });
      bIdx++;
    }
  }

  // Acak peserta untuk pembagian peran (1 Satpam, 1 Cepu jika >=4 pemain, sisanya Karyawan/Teknisi)
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const players = new Map();

  shuffled.forEach((pt, idx) => {
    let role = "WORKER";
    let roleName = "Karyawan";
    let team = "CREW";

    if (idx === 0) {
      role = "GUARD";
      roleName = "Satpam Malam";
      team = "GUARD";
    } else if (idx === 1 && shuffled.length >= 4) {
      role = "TRAITOR";
      roleName = "Cepu";
      team = "TRAITOR";
    } else if (idx === 2) {
      role = "TECHNICIAN";
      roleName = "Teknisi";
      team = "CREW";
    }

    const spawnX = team === "GUARD" ? 6 : 26 + (idx % 6) * 2;
    const spawnZ = team === "GUARD" ? 37 : 20 + ((idx >> 1) % 3) * 1.5;

    players.set(pt.id, {
      id: pt.id,
      name: pt.name,
      avatar: pt.avatar,
      isBot: pt.isBot,
      role,
      roleName,
      team,
      x: spawnX,
      z: spawnZ,
      dir: 0,
      ix: 0,
      iy: 0,
      dead: false,
      escaped: false,
      disguised: false,
      propType: PROP_TYPES[idx % PROP_TYPES.length],
      sprintCd: 0,
      sprintTime: 0,
      abCd: 0,
      stun: 0,
      aiTimer: 0
    });
  });

  const termCoords = [
    [10, 4], [18, 9], [16, 35], [27, 35], [40, 35], [48, 35], [45, 10], [56, 12]
  ];
  const need = room.mode === "QUICK" ? 4 : 6;
  const terminals = termCoords.slice(0, need + 1).map((c, idx) => ({
    idx,
    x: c[0],
    z: c[1],
    type: TASK_TYPES[idx % TASK_TYPES.length],
    done: false
  }));

  const propCoords = [
    [4, 18], [13, 18], [22, 16], [35, 18], [50, 18],
    [12, 30], [31, 32], [35, 39], [52, 38], [59, 26],
    [8, 10], [21, 10], [42, 12], [58, 8], [15, 24], [48, 24]
  ];
  const props = propCoords.map((c, i) => ({
    x: c[0],
    z: c[1],
    type: PROP_TYPES[i % PROP_TYPES.length]
  }));

  return {
    code: room.code,
    mode: room.mode,
    timeLeft: room.mode === "QUICK" ? 150 : 210,
    prog: 0,
    need,
    gatesOpen: false,
    players,
    terminals,
    props,
    meeting: {
      active: false,
      timeLeft: 0,
      callerName: "",
      votes: new Map()
    }
  };
}

function applyPlayerInput(match, tgId, { ix = 0, iy = 0 } = {}) {
  const p = match.players.get(String(tgId));
  if (!p || p.dead || p.escaped || match.meeting.active) return;
  p.ix = Math.max(-1, Math.min(1, Number(ix) || 0));
  p.iy = Math.max(-1, Math.min(1, Number(iy) || 0));
}

function applyPlayerAction(match, tgId, action, data = {}) {
  const p = match.players.get(String(tgId));
  if (!p || p.dead || p.escaped) return [];
  const events = [];

  if (action === "VOTE" && match.meeting.active) {
    match.meeting.votes.set(p.id, String(data.targetId || "SKIP"));
    return events;
  }

  if (match.meeting.active) return events;

  if (action === "DISGUISE" && p.team !== "GUARD") {
    p.disguised = !p.disguised;
    if (p.disguised) {
      p.propType = PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
    }
  } else if (action === "SPRINT") {
    if (p.sprintCd <= 0) {
      p.sprintTime = 2.5;
      p.sprintCd = 9;
    }
  } else if (action === "ATTACK" && p.team === "GUARD" && p.stun <= 0) {
    let hitAny = false;
    for (const target of match.players.values()) {
      if (target.id === p.id || target.dead || target.escaped || target.team === "GUARD") continue;
      if (Math.hypot(target.x - p.x, target.z - p.z) < 1.8) {
        target.dead = true;
        hitAny = true;
        events.push({ msg: `🚨 ${target.name} tertangkap Satpam!`, type: "b" });
      }
    }
    if (!hitAny) {
      p.stun = 1.5;
    }
  } else if (action === "TASK_DONE" && p.team === "CREW") {
    const term = match.terminals.find((t) => t.idx === Number(data.termIdx));
    if (term && !term.done && Math.hypot(term.x - p.x, term.z - p.z) < 2.6) {
      term.done = true;
      match.prog = Math.min(match.need, match.prog + 1);
      events.push({ msg: `✅ Tugas selesai (${match.prog}/${match.need})`, type: "g" });
      if (match.prog >= match.need && !match.gatesOpen) {
        match.gatesOpen = true;
        events.push({ msg: "🚪 SEMUA TUGAS SELESAI! LARI KE PINTU DARURAT KANAN!", type: "g" });
      }
    }
  } else if (action === "SABOTAGE" && p.team === "TRAITOR") {
    const term = match.terminals.find((t) => t.idx === Number(data.termIdx));
    if (term && !term.done && p.abCd <= 0 && Math.hypot(term.x - p.x, term.z - p.z) < 2.6) {
      p.abCd = 12;
      match.timeLeft = Math.max(15, match.timeLeft - 10);
      events.push({ msg: "⚠️ TERMINAL DISABOTASE! WAKTU BERKURANG 10 DETIK!", type: "b" });
    }
  } else if (action === "MEETING" && p.team !== "GUARD") {
    if (Math.hypot(32 - p.x, 22 - p.z) < 2.8 && p.abCd <= 0) {
      p.abCd = 20;
      match.meeting.active = true;
      match.meeting.timeLeft = 20;
      match.meeting.callerName = p.name;
      match.meeting.votes.clear();
      events.push({ msg: `📢 ${p.name} MEMANGGIL RAPAT DARURAT!`, type: "b" });
    }
  } else if (action === "ABILITY" && p.abCd <= 0) {
    p.abCd = 15;
    p.sprintTime = 3.0;
    events.push({ msg: "⚡ Skill kecepatan aktif!", type: "i" });
  }

  return events;
}

function stepMatch(match, dt) {
  // Handle Rapat Darurat & Voting
  if (match.meeting.active) {
    match.meeting.timeLeft -= dt;
    const aliveList = Array.from(match.players.values()).filter((p) => !p.dead && !p.escaped);
    const humansAlive = aliveList.filter((p) => !p.isBot);

    if (match.meeting.timeLeft <= 0 || match.meeting.votes.size >= humansAlive.length) {
      match.meeting.active = false;
      const tally = new Map();
      for (const v of match.meeting.votes.values()) {
        tally.set(v, (tally.get(v) || 0) + 1);
      }
      let topId = "SKIP";
      let topCount = 0;
      for (const [k, v] of tally.entries()) {
        if (v > topCount) {
          topCount = v;
          topId = k;
        }
      }
      if (topId !== "SKIP") {
        const ejected = match.players.get(topId);
        if (ejected) ejected.dead = true;
      }
    } else {
      return {
        meetingUpdate: {
          active: true,
          timeLeft: Math.ceil(match.meeting.timeLeft),
          callerName: match.meeting.callerName,
          candidates: aliveList.map((c) => ({ id: c.id, name: c.name }))
        }
      };
    }
  }

  match.timeLeft -= dt;

  // Gerakkan Pemain & AI Bot
  for (const p of match.players.values()) {
    if (p.dead || p.escaped) continue;
    if (p.sprintCd > 0) p.sprintCd = Math.max(0, p.sprintCd - dt);
    if (p.sprintTime > 0) p.sprintTime = Math.max(0, p.sprintTime - dt);
    if (p.abCd > 0) p.abCd = Math.max(0, p.abCd - dt);
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);

    if (p.isBot) {
      p.aiTimer -= dt;
      if (p.team === "GUARD") {
        // Satpam mengejar target terdekat yang tidak menyamar
        let nearest = null;
        let minD = 999;
        for (const t of match.players.values()) {
          if (t.dead || t.escaped || t.team === "GUARD") continue;
          const d = Math.hypot(t.x - p.x, t.z - p.z);
          const detectRange = t.disguised ? 2.5 : 14;
          if (d < detectRange && d < minD) {
            minD = d;
            nearest = t;
          }
        }
        if (nearest) {
          const d = Math.hypot(nearest.x - p.x, nearest.z - p.z) || 1;
          p.ix = (nearest.x - p.x) / d;
          p.iy = (nearest.z - p.z) / d;
          if (d < 1.5 && p.stun <= 0) {
            nearest.dead = true;
          }
        } else if (p.aiTimer <= 0) {
          p.aiTimer = 1.5 + Math.random() * 2;
          const ang = Math.random() * Math.PI * 2;
          p.ix = Math.cos(ang);
          p.iy = Math.sin(ang);
        }
      } else {
        if (match.gatesOpen) {
          const d = Math.hypot(62.5 - p.x, 12.5 - p.z) || 1;
          p.ix = (62.5 - p.x) / d;
          p.iy = (12.5 - p.z) / d;
        } else if (p.aiTimer <= 0) {
          p.aiTimer = 1.2 + Math.random() * 2.2;
          const ang = Math.random() * Math.PI * 2;
          p.ix = Math.cos(ang);
          p.iy = Math.sin(ang);
          if (Math.random() < 0.25) p.disguised = !p.disguised;
        }
      }
    }

    const len = Math.hypot(p.ix, p.iy);
    if (len > 0.1 && p.stun <= 0) {
      const baseSpeed = p.team === "GUARD" ? 4.6 : 4.3;
      const spd = baseSpeed * (p.sprintTime > 0 ? 1.45 : 1);
      const nx = p.x + (p.ix / len) * spd * dt;
      const nz = p.z + (p.iy / len) * spd * dt;
      if (!isBlockedPos(match, nx, p.z)) p.x = nx;
      if (!isBlockedPos(match, p.x, nz)) p.z = nz;
      p.dir = Math.abs(p.ix) > Math.abs(p.iy) ? (p.ix > 0 ? 2 : 3) : (p.iy > 0 ? 0 : 1);
    }

    // Cek Evakuasi Pintu Darurat Kanan saat terbuka
    if (match.gatesOpen && p.team !== "GUARD" && p.x > 61.5 && ((p.z >= 10.5 && p.z <= 14.5) || (p.z >= 29.5 && p.z <= 33.5))) {
      p.escaped = true;
    }
  }

  // Cek Kondisi Kemenangan
  const nonGuards = Array.from(match.players.values()).filter((p) => p.team !== "GUARD");
  const aliveNonGuards = nonGuards.filter((p) => !p.dead && !p.escaped);
  const escapedCount = nonGuards.filter((p) => p.escaped).length;

  if (escapedCount > 0 && aliveNonGuards.length === 0) {
    return buildEndResult(match, "Karyawan berhasil kabur lewat pintu darurat!", ["CREW"]);
  }
  if (aliveNonGuards.length === 0 && escapedCount === 0) {
    return buildEndResult(match, "Satpam & Cepu berhasil menangkap semua karyawan!", ["GUARD", "TRAITOR"]);
  }
  if (match.timeLeft <= 0) {
    return buildEndResult(match, "Waktu shift malam habis!", ["GUARD", "TRAITOR"]);
  }

  return null;
}

function buildEndResult(match, reason, winningTeams) {
  const summary = Array.from(match.players.values()).map((p) => ({
    name: p.name,
    role: p.roleName,
    won: winningTeams.includes(p.team)
  }));
  return { ended: true, reason, winningTeams, summary };
}

function buildPlayerSnapshot(match, tgId) {
  const you = match.players.get(String(tgId));
  return {
    timeLeft: match.timeLeft,
    prog: match.prog,
    need: match.need,
    gatesOpen: match.gatesOpen,
    you: you || null,
    entities: Array.from(match.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      team: p.team,
      x: p.x,
      z: p.z,
      dir: p.dir,
      dead: p.dead || p.escaped,
      disguised: p.disguised,
      propType: p.propType
    })),
    terminals: match.terminals,
    props: match.props
  };
}

/* ==========================================================================
   4. TELEGRAM BOT (GRAMMY)
   ========================================================================== */
let botInstance = null;

function buildLobbyText(room) {
  const list = room.members.map((m, i) => `${i + 1}. ${m.name} ${m.ready ? "✅" : "⏳"}`).join("\n") || "-";
  return (
    `🔦 <b>MIDNIGHT SHIFT — LOBI MABAR</b>\n` +
    `Kode Room: <code>${room.code}</code>\n` +
    `Host: <b>${room.hostName}</b> · Mode: <b>${room.mode}</b>\n` +
    `Status: <b>${room.phase}</b> (${room.members.length}/20)\n\n` +
    `<b>Pemain di Lobi:</b>\n${list}`
  );
}

function buildLobbyKeyboard(room) {
  const botUser = (process.env.BOT_USERNAME || "").replace("@", "").trim();
  const kb = new InlineKeyboard().text("➕ Gabung Lobi", `join_${room.code}`);
  if (botUser) {
    kb.url("🎮 BUKA MINI APP", `https://t.me/${botUser}?startapp=room_${room.code}`);
  }
  return kb;
}

async function notifyRoomUpdated(room) {
  if (!botInstance || !room.chatId || !room.messageId) return;
  try {
    await botInstance.api.editMessageText(room.chatId, room.messageId, buildLobbyText(room), {
      parse_mode: "HTML",
      reply_markup: buildLobbyKeyboard(room)
    });
  } catch (_) {}
}

function startTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log("BOT_TOKEN tidak diset, bot Telegram dilewati.");
    return;
  }

  const bot = new Bot(token);
  botInstance = bot;

  bot.command("start", async (ctx) => {
    const botUser = (process.env.BOT_USERNAME || "").replace("@", "").trim();
    const kb = new InlineKeyboard();
    if (botUser) kb.url("🎮 MAIN SEKARANG", `https://t.me/${botUser}?startapp=lobby`);
    await ctx.reply(
      "🔦 <b>Selamat datang di Midnight Shift!</b>\nKetik <code>/buatroom</code> di grup atau klik tombol di bawah untuk mulai bermain.",
      { parse_mode: "HTML", reply_markup: kb }
    );
  });

  bot.command("buatroom", async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const user = getOrCreateUser(from.id, from.first_name);
    const room = createRoomRecord({
      hostTgId: user.tgId,
      hostName: user.displayName,
      chatId: ctx.chat.id
    });
    joinRoomMember(room, user);

    const sent = await ctx.reply(buildLobbyText(room), {
      parse_mode: "HTML",
      reply_markup: buildLobbyKeyboard(room)
    });
    room.messageId = sent.message_id;
  });

  bot.command("join", async (ctx) => {
    const code = (ctx.match || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ctx.reply("❌ Kode room tidak ditemukan.");
    const user = getOrCreateUser(ctx.from.id, ctx.from.first_name);
    joinRoomMember(room, user);
    await notifyRoomUpdated(room);
    await ctx.reply(`✅ <b>${user.displayName}</b> bergabung ke room <code>${room.code}</code>!`, { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^join_([A-Z0-9]+)$/, async (ctx) => {
    const code = ctx.match[1];
    const room = rooms.get(code);
    if (!room) return ctx.answerCallbackQuery({ text: "Room sudah tutup!", show_alert: true });
    const user = getOrCreateUser(ctx.from.id, ctx.from.first_name);
    joinRoomMember(room, user);
    await notifyRoomUpdated(room);
    await ctx.answerCallbackQuery({ text: `Berhasil gabung room #${code}!` });
  });

  bot.catch((err) => console.error("Bot error:", err.message));
  bot.start().catch((err) => console.error("Bot start error:", err.message));
}

/* ==========================================================================
   5. BOOT FASTIFY & SOCKET.IO SERVER
   ========================================================================== */
async function boot() {
  await fastify.register(fastifyCors, { origin: "*" });
  await fastify.register(fastifyRateLimit, { max: 200, timeWindow: "1 minute" });
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "..", "public"),
    prefix: "/"
  });

  fastify.get("/health", async () => ({ ok: true, time: Date.now() }));

  const io = new Server(fastify.server, { cors: { origin: "*" } });

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

  startTelegramBot();

  const PORT = Number(process.env.PORT) || 3000;
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Midnight Shift Fastify server running on port ${PORT}`);
}

boot().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
