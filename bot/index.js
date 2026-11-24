"use strict";

const { Bot, InlineKeyboard } = require("grammy");
const { PHASE } = require("../packages/shared/protocol");
const { upsertUser, getLeaderboard, checkRateLimit } = require("../server/db");
const { registerAdminCommands } = require("./admin");

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const BOT_USERNAME = process.env.BOT_USERNAME || "";
const APP_SHORT_NAME = process.env.APP_SHORT_NAME || "play";
const WEBAPP_URL = process.env.WEBAPP_URL || "";

// Debounce timer per chatId agar tidak terkena rate limit Telegram editMessageText
const editTimers = new Map();

function buildMiniAppLink(startParam = "") {
  if (BOT_USERNAME && APP_SHORT_NAME) {
    return startParam
      ? `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${encodeURIComponent(startParam)}`
      : `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`;
  }
  return WEBAPP_URL || "https://t.me";
}

function createTelegramBot(roomManager, io) {
  if (!BOT_TOKEN) {
    console.warn("[Bot] BOT_TOKEN kosong, fitur bot Telegram dinonaktifkan.");
    return null;
  }

  const bot = new Bot(BOT_TOKEN);

  // Daftarkan semua perintah khusus Admin (/admin, /givecoin, /broadcast, /closeroom, /ban, /unban)
  registerAdminCommands(bot, roomManager, io);

  // /start [room_CODE]
  bot.command("start", async (ctx) => {
    const payload = String(ctx.match || "").trim();
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    if (isGroup) {
      return ctx.reply(
        "🔦 *MIDNIGHT SHIFT*\nPasar malam telah tutup. Gunakan /play untuk membuka lobi grup!",
        { parse_mode: "Markdown" }
      );
    }

    const startParam = payload.startsWith("room_") ? payload : "";
    const kb = new InlineKeyboard().webApp(
      startParam ? "🚪 GABUNG ROOM SEKARANG" : "🎮 MAIN MIDNIGHT SHIFT",
      startParam ? `${WEBAPP_URL}?startapp=${encodeURIComponent(startParam)}` : WEBAPP_URL
    );

    await ctx.reply(
      "🌃 *MIDNIGHT SHIFT*\nSembunyi jadi benda, kerjakan tugas, atau sabotase sebagai Cepu!\n\nTekan tombol di bawah untuk membuka Mini App:",
      { parse_mode: "Markdown", reply_markup: kb }
    );
  });

  // /play atau /room — Buat atau tampilkan lobby grup aktif
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
    const kb = new InlineKeyboard()
      .url("🎮 GABUNG LOBI (MINI APP)", buildMiniAppLink(`room_${room.code}`))
      .row()
      .callback("🔄 REFRESH", `refresh_${room.code}`);

    const sent = await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
    room.groupMessageId = sent.message_id;
    if (reused) {
      await ctx.reply(`ℹ️ Lobi grup #${room.code} sudah aktif di atas!`);
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

  // /profile — Cek statistik & koin pemain
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

  // /rank — Top 10 Leaderboard
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

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📖 *PERINTAH MIDNIGHT SHIFT*\n" +
        "• `/play` — Buat / buka lobi grup\n" +
        "• `/join KODE` — Gabung ke room tertentu\n" +
        "• `/profile` — Lihat koin, level & statistik\n" +
        "• `/rank` — Papan peringkat pemain\n\n" +
        "*Cara Main:*\n" +
        "Warga menyamar jadi benda & menyelesaikan tugas sebelum waktu habis. Satpam mencari penyamar dengan senter. Cepu menyabotase tugas dari dalam!",
      { parse_mode: "Markdown" }
    );
  });

  // Callback tombol refresh pada kartu lobi grup
  bot.callbackQuery(/^refresh_([A-Z0-9]{4,8})$/, async (ctx) => {
    const code = ctx.match[1];
    const room = roomManager.rooms.get(code);
    if (!room) {
      return ctx.answerCallbackQuery({ text: "Lobi sudah berakhir.", show_alert: true });
    }
    await updateGroupCardNow(bot, room, null);
    await ctx.answerCallbackQuery({ text: "Status diperbarui!" });
  });

  bot.catch((err) => {
    console.error("[Grammy Bot Error]", err.message);
  });

  return bot;
}

function formatLobbyCardText(room, matchResult = null) {
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
      `Lobi kembali terbuka untuk ronde berikutnya!`
    );
  }

  if (room.phase !== PHASE.WAITING) {
    return (
      `🚨 *MIDNIGHT SHIFT — #${room.code}*\n` +
      `Status: *SEDANG BERLANGSUNG*\n` +
      `Pemain Aktif: *${room.members.size}/20*\n\n` +
      `_Peran disembunyikan selama pertandingan berlangsung._`
    );
  }

  const names = [];
  let readyCount = 0;
  room.members.forEach((m) => {
    if (m.ready) readyCount++;
    names.push(`${m.ready ? "✅" : "⏳"} ${m.name}${m.isHost ? " 👑" : ""}`);
  });

  return (
    `🌃 *MIDNIGHT SHIFT — LOBI #${room.code}*\n` +
    `Mode: *${room.mode}* · Pemain: *${room.members.size}/20* (Siap: ${readyCount})\n\n` +
    `${names.length ? names.join("\n") : "_Menunggu pemain masuk..._"}\n\n` +
    `Tekan tombol di bawah untuk masuk ke jalan kota:`
  );
}

/**
 * Update Kartu Lobi Grup dengan Debounce 1.5 detik (Anti-Spam & Anti-429 Telegram)
 */
function scheduleGroupCardUpdate(bot, room, matchResult = null) {
  if (!bot || !room.chatId || !room.groupMessageId) return;

  if (editTimers.has(room.chatId)) {
    clearTimeout(editTimers.get(room.chatId));
  }

  const timer = setTimeout(() => {
    editTimers.delete(room.chatId);
    updateGroupCardNow(bot, room, matchResult);
  }, matchResult ? 200 : 1500);

  editTimers.set(room.chatId, timer);
}

async function updateGroupCardNow(bot, room, matchResult) {
  if (!bot || !room.chatId || !room.groupMessageId) return;
  try {
    const text = formatLobbyCardText(room, matchResult);
    const kb = new InlineKeyboard().url(
      room.phase === PHASE.WAITING ? "🎮 GABUNG LOBI (MINI APP)" : "👀 BUKA MINI APP",
      buildMiniAppLink(`room_${room.code}`)
    );
    if (room.phase === PHASE.WAITING) {
      kb.row().callback("🔄 REFRESH", `refresh_${room.code}`);
    }

    await bot.api.editMessageText(room.chatId, room.groupMessageId, text, {
      parse_mode: "Markdown",
      reply_markup: kb
    });
  } catch (err) {
    if (!String(err.message).includes("message is not modified")) {
      console.warn("[Group Card Edit]", err.message);
    }
  }
}

module.exports = { createTelegramBot, scheduleGroupCardUpdate };
