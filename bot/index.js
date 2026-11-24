"use strict";

const { Bot, InlineKeyboard } = require("grammy");
const { PHASE } = require("../packages/shared/protocol");
const { upsertUser, getLeaderboard, checkRateLimit } = require("../server/db");
const { registerAdminCommands } = require("./admin");
const {
  buildWelcomeText,
  buildGroupWelcomeText,
  buildGuideKeyboard,
  formatGuidePage,
  registerGuideHandlers
} = require("./guide");

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const BOT_USERNAME = process.env.BOT_USERNAME || "";
const APP_SHORT_NAME = process.env.APP_SHORT_NAME || "play";
const rawWebappUrl = String(process.env.WEBAPP_URL || "").trim().replace(/\/$/, "");
const WEBAPP_URL = rawWebappUrl
  ? (rawWebappUrl.startsWith("http") ? rawWebappUrl : `https://${rawWebappUrl}`)
  : "";

const editTimers = new Map();

function buildMiniAppLink(startParam = "") {
  if (BOT_USERNAME && APP_SHORT_NAME) {
    return startParam
      ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${encodeURIComponent(startParam)}`
      : `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`;
  }
  return WEBAPP_URL || "https://t.me";
}

function buildLobbyKeyboard(room) {
  const kb = new InlineKeyboard();
  if (room.phase === PHASE.WAITING) {
    kb.callback("✋ IKUT MAIN", `reg_${room.code}`)
      .callback("❌ BATAL", `unreg_${room.code}`)
      .row()
      .url("🎮 BUKA MINI APP", buildMiniAppLink(`room_${room.code}`))
      .row()
      .callback("🚀 MULAI GAME (HOST)", `start_${room.code}`);
  } else {
    kb.url("🎮 MASUK KE ARENA GAME", buildMiniAppLink(`room_${room.code}`));
  }
  return kb;
}

function createTelegramBot(roomManager, io) {
  if (!BOT_TOKEN) {
    console.warn("[Bot] BOT_TOKEN kosong, fitur bot Telegram dinonaktifkan.");
    return null;
  }

  const bot = new Bot(BOT_TOKEN);
  registerAdminCommands(bot, roomManager, io);
  registerGuideHandlers(bot, WEBAPP_URL);

  // /start [room_CODE]
  bot.command("start", async (ctx) => {
    const payload = String(ctx.match || "").trim();
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    if (isGroup) {
      return ctx.reply(buildGroupWelcomeText(), { parse_mode: "Markdown" });
    }

    const startParam = payload.startsWith("room_") ? payload : "";
    const kb = new InlineKeyboard()
      .webApp(
        startParam ? "🚪 GABUNG ROOM SEKARANG" : "🎮 MAIN MIDNIGHT SHIFT",
        startParam ? `${WEBAPP_URL}?startapp=${encodeURIComponent(startParam)}` : WEBAPP_URL
      )
      .row()
      .callback("📖 BUKU PANDUAN & PERAN", "guide_flow");

    await ctx.reply(buildWelcomeText(ctx.from?.first_name || "Pemain"), {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  });

  // /play atau /room — Buka pendaftaran lobi grup
  bot.command(["play", "room"], async (ctx) => {
    const allowed = await checkRateLimit(`bot_cmd:${ctx.from.id}`, 6, 30);
    if (!allowed) return;

    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    const user = await upsertUser({
      telegramId: String(ctx.from.id),
      username: ctx.from.username || "",
      displayName: ctx.from.first_name || "Pemain"
    });

    if (user.isBanned) {
      return ctx.reply("🚫 Akun kamu telah diblokir oleh Admin.");
    }

    if (!isGroup) {
      const { room } = roomManager.createRoom({ hostUser: user, mode: "CLASSIC", isPublic: false });
      const kb = new InlineKeyboard().webApp(
        `🎮 MASUK LOBI #${room.code}`,
        `${WEBAPP_URL}?startapp=room_${room.code}`
      );
      return ctx.reply(
        `🔑 *LOBI PRIBADI DIBUAT*\nKode Room: \`${room.code}\`\nBagikan kode ini ke teman atau buka lewat tombol:`,
        { parse_mode: "Markdown", reply_markup: kb }
      );
    }

    const { room, reused } = roomManager.createRoom({
      hostUser: user,
      mode: "CLASSIC",
      isPublic: false,
      chatId: String(ctx.chat.id),
      groupTitle: ctx.chat.title || "Grup"
    });

    const text = formatLobbyCardText(room);
    const sent = await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: buildLobbyKeyboard(room)
    });
    room.groupMessageId = sent.message_id;

    if (reused) {
      await ctx.reply(`ℹ️ Lobi grup #${room.code} masih terbuka! Klik *✋ IKUT MAIN* di pesan lobi.`);
    }
  });

  // /leave — Batal ikut mabar dari lobi grup
  bot.command("leave", async (ctx) => {
    const left = roomManager.leaveRoom(String(ctx.from.id));
    if (left) {
      await ctx.reply(`👋 *${ctx.from.first_name}* keluar dari daftar pemain.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply("Kamu sedang tidak terdaftar di lobi mana pun.");
    }
  });

  // /kick — Keluarkan pemain dari lobi grup (reply pesan pemain target, khusus Host)
  bot.command("kick", async (ctx) => {
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    if (!isGroup || !ctx.message.reply_to_message) {
      return ctx.reply("Balas (reply) pesan pemain yang ingin dikeluarkan lalu ketik `/kick`.", { parse_mode: "Markdown" });
    }
    const roomCode = roomManager.groupRoom.get(String(ctx.chat.id));
    const room = roomCode ? roomManager.rooms.get(roomCode) : null;
    if (!room || room.hostTgId !== String(ctx.from.id)) {
      return ctx.reply("Hanya pembuat lobi (Host) yang bisa mengeluarkan pemain.");
    }
    const target = ctx.message.reply_to_message.from;
    if (target && roomManager.leaveRoom(String(target.id))) {
      await ctx.reply(`👢 *${target.first_name}* dikeluarkan dari lobi.`, { parse_mode: "Markdown" });
    }
  });

  // /join <KODE>
  bot.command("join", async (ctx) => {
    const code = String(ctx.match || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length < 4) {
      return ctx.reply("Format: `/join KODE` (contoh: `/join MX7K2P`)", { parse_mode: "Markdown" });
    }
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
    const kb = isGroup
      ? new InlineKeyboard().url(`🚪 GABUNG #${code}`, buildMiniAppLink(`room_${code}`))
      : new InlineKeyboard().webApp(`🚪 GABUNG #${code}`, `${WEBAPP_URL}?startapp=room_${code}`);

    await ctx.reply(`Klik tombol di bawah untuk masuk ke Room *#${code}*:`, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  });

  // /profile
  bot.command("profile", async (ctx) => {
    const allowed = await checkRateLimit(`bot_prof:${ctx.from.id}`, 5, 30);
    if (!allowed) return;
    const u = await upsertUser({
      telegramId: String(ctx.from.id),
      username: ctx.from.username || "",
      displayName: ctx.from.first_name || "Pemain"
    });
    const level = Math.min(100, Math.floor(u.xp / 100) + 1);
    await ctx.reply(
      `🪪 *PROFIL — ${u.displayName}*\n` +
        `⭐ Level: *${level}* (${u.xp} XP)\n` +
        `🪙 Koin: *${u.coins}*\n` +
        `🎮 Main: *${u.gamesPlayed}* · Menang: *${u.wins}*\n` +
        `🛠 Tugas Selesai: *${u.tasksDone}*`,
      { parse_mode: "Markdown" }
    );
  });

  // /rank
  bot.command("rank", async (ctx) => {
    const allowed = await checkRateLimit(`bot_rank:${ctx.chat.id}`, 4, 30);
    if (!allowed) return;
    const rows = await getLeaderboard(10);
    if (!rows.length) {
      return ctx.reply("🏆 Belum ada data peringkat. Jadilah pemenang pertama!");
    }
    const lines = rows.map(
      (r, i) => `${i + 1}. *${r.display_name}* — ${r.wins} Menang (${r.xp} XP)`
    );
    await ctx.reply(`🏆 *TOP 10 MIDNIGHT SHIFT*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  });

  // /help — Buku panduan interaktif 4 halaman
  bot.command("help", async (ctx) => {
    const kb = buildGuideKeyboard("flow");
    if (ctx.chat.type === "private" && WEBAPP_URL) {
      kb.row().webApp("🎮 LANGSUNG MAIN SEKARANG", WEBAPP_URL);
    }
    await ctx.reply(formatGuidePage("flow"), {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  });

  // Tombol ✋ IKUT MAIN langsung di chat grup
  bot.callbackQuery(/^reg_([A-Z0-9]{4,8})$/, async (ctx) => {
    const code = ctx.match[1];
    const room = roomManager.rooms.get(code);
    if (!room) {
      return ctx.answerCallbackQuery({ text: "Lobi sudah ditutup.", show_alert: true });
    }

    const user = await upsertUser({
      telegramId: String(ctx.from.id),
      username: ctx.from.username || "",
      displayName: ctx.from.first_name || "Pemain"
    });
    if (user.isBanned) {
      return ctx.answerCallbackQuery({ text: "Akun kamu diblokir Admin.", show_alert: true });
    }

    const res = roomManager.joinRoom(code, user, null, true);
    if (res.error) {
      return ctx.answerCallbackQuery({ text: res.message, show_alert: true });
    }

    await ctx.answerCallbackQuery({
      text: res.reconnected ? "Kamu sudah terdaftar di lobi ini!" : "✅ Berhasil mendaftar! Klik BUKA MINI APP untuk bersiap."
    });
  });

  // Tombol ❌ BATAL langsung di chat grup
  bot.callbackQuery(/^unreg_([A-Z0-9]{4,8})$/, async (ctx) => {
    const code = ctx.match[1];
    const room = roomManager.rooms.get(code);
    if (!room || !room.members.has(String(ctx.from.id))) {
      return ctx.answerCallbackQuery({ text: "Kamu belum terdaftar di lobi ini." });
    }
    roomManager.leaveRoom(String(ctx.from.id));
    await ctx.answerCallbackQuery({ text: "❌ Pendaftaran dibatalkan." });
  });

  // Tombol 🚀 MULAI GAME (HOST) langsung di chat grup
  bot.callbackQuery(/^start_([A-Z0-9]{4,8})$/, async (ctx) => {
    const code = ctx.match[1];
    const room = roomManager.rooms.get(code);
    if (!room) {
      return ctx.answerCallbackQuery({ text: "Lobi tidak ditemukan.", show_alert: true });
    }
    if (room.hostTgId !== String(ctx.from.id)) {
      return ctx.answerCallbackQuery({ text: "Hanya pembuat lobi (Host) yang bisa memulai game!", show_alert: true });
    }

    const res = roomManager.startMatch(String(ctx.from.id), true);
    if (res.error) {
      return ctx.answerCallbackQuery({ text: res.message, show_alert: true });
    }
    await ctx.answerCallbackQuery({ text: "🚀 Game dimulai! Semua pemain segera masuk ke Mini App!" });
  });

  bot.catch((err) => {
    console.error("[Grammy Bot Error]", err.message);
  });

  return bot;
}

function formatLobbyCardText(room, matchResult = null) {
  if (matchResult && matchResult.closed) {
    return `🛑 *LOBI #${room.code} DITUTUP*\nSemua pemain telah keluar atau waktu tunggu habis.\nKetik /play untuk membuka lobi baru.`;
  }

  if (matchResult) {
    const winnerLabel =
      matchResult.winningTeam === "CIVILIAN"
        ? "🎉 WARGA BERHASIL KABUR!"
        : matchResult.winningTeam === "BADUT"
          ? "🤡 BADUT MENANG VOTING!"
          : "🔦 SATPAM MENANG!";
    const topPlayers = (matchResult.players || [])
      .slice(0, 6)
      .map((p) => `${p.won ? "🏅" : "•"} ${p.name} (${p.role})`)
      .join("\n");

    return (
      `🏁 *HASIL RONDE — #${room.code}*\n` +
      `*${winnerLabel}*\n_${matchResult.reason}_\n\n` +
      `${topPlayers}\n\n` +
      `Pendaftaran ronde berikutnya kembali dibuka! Klik *✋ IKUT MAIN*:`
    );
  }

  if (room.phase !== PHASE.WAITING) {
    return (
      `🚨 *MIDNIGHT SHIFT — #${room.code}*\n` +
      `Status: *PERMAINAN SEDANG BERLANGSUNG!*\n` +
      `Pemain Aktif: *${room.members.size}/20*\n\n` +
      `Segera klik tombol di bawah untuk masuk ke arena:`
    );
  }

  const names = [];
  let idx = 1;
  room.members.forEach((m) => {
    names.push(`${idx++}. ✅ ${m.name}${m.telegramId === room.hostTgId ? " 👑" : ""}`);
  });

  return (
    `🌃 *MIDNIGHT SHIFT — LOBI #${room.code}*\n` +
    `Mode: *${room.mode}* · Terdaftar: *${room.members.size}/20 Pemain*\n\n` +
    `*Daftar Pemain:*\n` +
    `${names.length ? names.join("\n") : "_Belum ada pemain. Klik IKUT MAIN di bawah!_"}\n\n` +
    `Klik *✋ IKUT MAIN* untuk mendaftar, lalu tekan *🎮 BUKA MINI APP*:`
  );
}

function scheduleGroupCardUpdate(bot, room, matchResult = null) {
  if (!bot || !room.chatId || !room.groupMessageId) return;

  if (editTimers.has(room.chatId)) {
    clearTimeout(editTimers.get(room.chatId));
  }

  const timer = setTimeout(() => {
    editTimers.delete(room.chatId);
    updateGroupCardNow(bot, room, matchResult);
  }, matchResult ? 200 : 1200);

  editTimers.set(room.chatId, timer);
}

async function updateGroupCardNow(bot, room, matchResult) {
  if (!bot || !room.chatId || !room.groupMessageId) return;
  try {
    const text = formatLobbyCardText(room, matchResult);
    const options = { parse_mode: "Markdown" };
    if (!matchResult || !matchResult.closed) {
      options.reply_markup = buildLobbyKeyboard(room);
    }

    await bot.api.editMessageText(room.chatId, room.groupMessageId, text, options);
  } catch (err) {
    if (!String(err.message).includes("message is not modified")) {
      console.warn("[Group Card Edit]", err.message);
    }
  }
}

module.exports = { createTelegramBot, scheduleGroupCardUpdate };
