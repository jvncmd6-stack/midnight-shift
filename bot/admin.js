"use strict";

const {
  getServerStats,
  adminGiveCoins,
  setUserBanned,
  getAllUserTelegramIds
} = require("../server/db");

// Ambil daftar Telegram ID Admin dari ENV (contoh: ADMIN_IDS=123456789,987654321)
function getAdminIds() {
  return String(process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function isAdmin(telegramId) {
  const admins = getAdminIds();
  return admins.includes(String(telegramId));
}

function registerAdminCommands(bot, roomManager, io) {
  // Middleware pengecekan admin
  const guard = async (ctx, next) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      return; // Abaikan diam-diam jika bukan admin
    }
    return next();
  };

  // /admin — Dashboard ringkas server & daftar perintah
  bot.command("admin", guard, async (ctx) => {
    const stats = await getServerStats();
    const activeRooms = roomManager.rooms.size;
    const onlinePlayers = roomManager.userRoom.size;

    const roomList = [];
    roomManager.rooms.forEach((r) => {
      roomList.push(`• \`#${r.code}\` [${r.mode}] — ${r.members.size}/20 (${r.phase})`);
    });

    await ctx.reply(
      `🛡️ *PANEL ADMIN — MIDNIGHT SHIFT*\n\n` +
        `👥 Total Akun: *${stats.totalUsers}*\n` +
        `🚫 Akun Dibanned: *${stats.bannedUsers}*\n` +
        `🟢 Pemain di Room: *${onlinePlayers}*\n` +
        `🏠 Room Aktif: *${activeRooms}*\n` +
        `${roomList.length ? `\n*Daftar Room:*\n${roomList.join("\n")}\n` : ""}\n` +
        `*Perintah Admin:*\n` +
        `• \`/givecoin <tg_id> <jumlah>\`\n` +
        `• \`/broadcast <pesan>\`\n` +
        `• \`/closeroom <KODE>\`\n` +
        `• \`/ban <tg_id>\` | \`/unban <tg_id>\``,
      { parse_mode: "Markdown" }
    );
  });

  // /givecoin <tg_id> <jumlah> — Tambah koin ke pemain
  bot.command("givecoin", guard, async (ctx) => {
    const args = String(ctx.match || "").trim().split(/\s+/);
    const targetTgId = args[0];
    const amount = parseInt(args[1], 10);

    if (!targetTgId || !Number.isFinite(amount) || amount === 0) {
      return ctx.reply("Format salah. Contoh: `/givecoin 123456789 500`", { parse_mode: "Markdown" });
    }

    const updated = await adminGiveCoins(targetTgId, amount);
    if (!updated) {
      return ctx.reply(`❌ Pemain dengan ID \`${targetTgId}\` tidak ditemukan di database.`, { parse_mode: "Markdown" });
    }

    // Kirim notif ke pemain jika sedang online di socket
    io.emit("game:toast", {
      text: `ADMIN MENGIRIM +${amount} KOIN KE ${updated.display_name.toUpperCase()}!`,
      type: "g"
    });

    await ctx.reply(
      `✅ Berhasil mengirim *${amount} Koin* ke *${updated.display_name}* (\`${targetTgId}\`).\nSaldo sekarang: *${updated.coins} Koin*`,
      { parse_mode: "Markdown" }
    );
  });

  // /broadcast <pesan> — Kirim pengumuman ke semua room aktif & chat bot user
  bot.command("broadcast", guard, async (ctx) => {
    const msg = String(ctx.match || "").trim();
    if (!msg) {
      return ctx.reply("Format: `/broadcast Server akan maintenance 5 menit lagi!`", { parse_mode: "Markdown" });
    }

    // 1. Kirim langsung ke layar pemain yang sedang in-game / di lobi
    io.emit("game:toast", {
      text: `[ADMIN] ${msg}`,
      type: "i"
    });

    // 2. Kirim ke DM Telegram semua pemain terdaftar (dengan jeda aman rate-limit)
    const userIds = await getAllUserTelegramIds();
    let sentCount = 0;

    await ctx.reply(`📣 Mengirim pengumuman ke *${roomManager.rooms.size} room aktif* dan *${userIds.length} pengguna*...`, {
      parse_mode: "Markdown"
    });

    for (const tgId of userIds) {
      if (tgId.startsWith("g_")) continue; // Lewati ID guest dev
      try {
        await bot.api.sendMessage(tgId, `📢 *PENGUMUMAN MIDNIGHT SHIFT*\n\n${msg}`, {
          parse_mode: "Markdown"
        });
        sentCount++;
        await new Promise((r) => setTimeout(r, 40)); // Jeda 40ms anti-spam Telegram
      } catch (e) {
        // Abaikan jika user memblokir bot
      }
    }

    await ctx.reply(`✅ Pengumuman selesai dikirim ke *${sentCount}* chat pribadi.`, { parse_mode: "Markdown" });
  });

  // /closeroom <KODE> — Tutup paksa room bermasalah
  bot.command("closeroom", guard, async (ctx) => {
    const code = String(ctx.match || "").toUpperCase().trim();
    if (!roomManager.rooms.has(code)) {
      return ctx.reply(`❌ Room \`#${code}\` tidak ditemukan.`, { parse_mode: "Markdown" });
    }

    io.to(code).emit("game:toast", {
      text: "ROOM DITUTUP OLEH ADMIN.",
      type: "b"
    });
    roomManager.destroyRoom(code);

    await ctx.reply(`✅ Room \`#${code}\` berhasil ditutup paksa.`, { parse_mode: "Markdown" });
  });

  // /ban <tg_id> — Blokir pemain
  bot.command("ban", guard, async (ctx) => {
    const targetTgId = String(ctx.match || "").trim();
    if (!targetTgId) return ctx.reply("Format: `/ban 123456789`", { parse_mode: "Markdown" });
    if (isAdmin(targetTgId)) return ctx.reply("❌ Tidak bisa memblokir sesama Admin.");

    const ok = await setUserBanned(targetTgId, true);
    if (!ok) return ctx.reply("❌ User tidak ditemukan.");

    // Keluarkan langsung jika sedang ada di dalam room
    roomManager.leaveRoom(targetTgId);
    await ctx.reply(`🚫 Akun \`${targetTgId}\` telah diblokir dari permainan.`, { parse_mode: "Markdown" });
  });

  // /unban <tg_id> — Buka blokir pemain
  bot.command("unban", guard, async (ctx) => {
    const targetTgId = String(ctx.match || "").trim();
    if (!targetTgId) return ctx.reply("Format: `/unban 123456789`", { parse_mode: "Markdown" });

    const ok = await setUserBanned(targetTgId, false);
    if (!ok) return ctx.reply("❌ User tidak ditemukan.");

    await ctx.reply(`✅ Blokir akun \`${targetTgId}\` telah dicabut.`, { parse_mode: "Markdown" });
  });
}

module.exports = { registerAdminCommands, isAdmin };
