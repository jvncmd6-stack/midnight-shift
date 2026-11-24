const { Telegraf, Markup } = require('telegraf');
const crypto = require('crypto');

function setupBot(botToken, webAppUrl, botUsername, appShortName, roomManager) {
  const bot = new Telegraf(botToken);

  // Helper untuk format teks kartu lobi di grup
  function formatLobbyCard(room) {
    const playerList = room.players.length
      ? room.players.map((p, i) => `${i + 1}. ${p.name}${p.isHost ? ' 👑' : ''}`).join('\n')
      : '_Belum ada yang masuk..._';

    return (
      `🌃 *MIDNIGHT SHIFT — LOBI #${room.code}*\n` +
      `Mode: *${room.mode}* | Pemain: *${room.players.length}/${room.maxPlayers}*\n\n` +
      `*Daftar Pemain:*\n${playerList}\n\n` +
      `_Klik tombol di bawah untuk masuk ke jalan kota!_`
    );
  }

  // Helper tombol inline (beda perlakuan antara Private Chat dan Grup)
  function getLobbyKeyboard(roomCode, isGroup) {
    if (isGroup) {
      // Di grup wajib pakai URL deep-link dengan startapp agar terkirim initData start_param
      const deepLink = `https://t.me/${botUsername}/${appShortName}?startapp=room_${roomCode}`;
      return Markup.inlineKeyboard([
        [Markup.button.url('🚪 GABUNG LOBI GRUP', deepLink)]
      ]);
    }
    return Markup.inlineKeyboard([
      [Markup.button.webApp('🎮 MAIN SEKARANG', webAppUrl)]
    ]);
  }

  // Command /start (Private Chat & Grup)
  bot.command('start', (ctx) => {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    if (isGroup) {
      return ctx.reply(
        '🌃 *MIDNIGHT SHIFT*\nGunakan perintah `/play` di grup ini untuk membuka lobi mabar!',
        { parse_mode: 'Markdown' }
      );
    }
    return ctx.reply(
      '🌃 *MIDNIGHT SHIFT*\nPasar malam sudah tutup. Sembunyi, nyamar jadi galon, dan selesaikan tugas sebelum Satpam menangkapmu!',
      {
        parse_mode: 'Markdown',
        ...getLobbyKeyboard(null, false)
      }
    );
  });

  // Command /play (Buat atau pakai ulang lobi aktif di grup)
  bot.command('play', async (ctx) => {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    if (!isGroup) {
      return ctx.reply(
        'Perintah `/play` dipakai di dalam Grup Telegram untuk mabar bareng. Di chat pribadi, klik tombol di bawah:',
        { parse_mode: 'Markdown', ...getLobbyKeyboard(null, false) }
      );
    }

    const chatId = String(ctx.chat.id);
    let room = roomManager.getRoomByGroup(chatId);

    // Jika grup belum punya lobi aktif, buat baru
    if (!room) {
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      room = roomManager.createRoom({
        code,
        groupId: chatId,
        groupTitle: ctx.chat.title || 'Grup Mabar'
      });
    }

    const sentMsg = await ctx.reply(formatLobbyCard(room), {
      parse_mode: 'Markdown',
      ...getLobbyKeyboard(room.code, true)
    });

    // Simpan message_id agar kartu bisa di-edit otomatis saat ada pemain masuk/keluar
    roomManager.attachCardMessage(room.code, chatId, sentMsg.message_id);
  });

  // Listener dari roomManager untuk memperbarui kartu lobi di grup secara real-time (dengan debounce)
  const editTimers = new Map();
  roomManager.on('room:changed', (room) => {
    if (!room.groupId || !room.cardMessageId) return;

    if (editTimers.has(room.code)) clearTimeout(editTimers.get(room.code));
    editTimers.set(
      room.code,
      setTimeout(async () => {
        editTimers.delete(room.code);
        try {
          let text = '';
          let extra = { parse_mode: 'Markdown' };

          if (room.status === 'ACTIVE') {
            text =
              `🚨 *MIDNIGHT SHIFT — #${room.code} SEDANG BERLANGSUNG!*\n` +
              `Pemain aktif: *${room.players.length} orang*\n` +
              `_Sssst... Satpam sedang berpatroli!_`;
          } else if (room.status === 'RESULT') {
            text =
              `🏆 *HASIL RONDE — #${room.code}*\n` +
              `Pemenang: *${room.lastWinner || 'Warga'}*\n` +
              `Ketik \`/play\` untuk main ronde berikutnya!`;
          } else {
            text = formatLobbyCard(room);
            extra = { ...extra, ...getLobbyKeyboard(room.code, true) };
          }

          await bot.telegram.editMessageText(
            room.groupId,
            room.cardMessageId,
            undefined,
            text,
            extra
          );
        } catch (err) {
          // Abaikan error "message is not modified" dari Telegram API
          if (!String(err.message).includes('message is not modified')) {
            console.error('Gagal update kartu grup:', err.message);
          }
        }
      }, 1200) // Debounce 1.2 detik agar aman dari rate-limit Telegram
    );
  });

  return bot;
}

module.exports = { setupBot };
