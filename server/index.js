require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { verifyTelegramWebAppData } = require('./auth');
const roomManager = require('./roomManager');
const { setupBot } = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Healthcheck endpoint untuk Railway
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: roomManager.rooms.size });
});

// Endpoint validasi sesi & sinkronisasi profil/koin pemain
app.post('/api/sync', (req, res) => {
  const { initData } = req.body;
  const verified = verifyTelegramWebAppData(initData, process.env.BOT_TOKEN);

  // Izinkan mode dev lokal jika BOT_TOKEN belum diisi, tolak di production jika invalid
  if (!verified && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ ok: false, error: 'INVALID_SESSION' });
  }

  const tgUser = verified ? verified.user : { id: 'local_dev', first_name: 'Pemain' };
  res.json({
    ok: true,
    userId: String(tgUser.id),
    startParam: verified ? verified.startParam : ''
  });
});

// Manajemen koneksi multiplayer real-time (Lobi & Active Match)
io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('room:join', ({ roomCode, initData, name, av }) => {
    const code = String(roomCode || 'PUBLIC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PUBLIC';
    const verified = verifyTelegramWebAppData(initData, process.env.BOT_TOKEN);

    if (!verified && process.env.NODE_ENV === 'production') {
      socket.emit('system:error', { code: 'INVALID_SESSION', message: 'Sesi Telegram tidak valid.' });
      return;
    }

    const tgUser = verified && verified.user ? verified.user : null;
    const telegramId = tgUser ? String(tgUser.id) : `guest_${socket.id}`;
    const safeName = String(name || (tgUser && tgUser.first_name) || 'Pemain')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 8) || 'Pemain';

    const result = roomManager.joinRoom(code, {
      socketId: socket.id,
      telegramId,
      name: safeName,
      av: av || null
    });

    if (result.error) {
      socket.emit('system:error', { code: result.error, message: 'Lobi sudah penuh!' });
      return;
    }

    currentRoom = code;
    socket.join(code);

    // Kirim state lengkap room ke seluruh anggota lobi
    io.to(code).emit('room:update', {
      code: result.room.code,
      groupTitle: result.room.groupTitle,
      status: result.room.status,
      players: result.room.players
    });
  });

  // Update posisi & avatar di lobi maupun saat match berlangsung
  socket.on('player:state', (data) => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room) return;

    const p = room.players.find((x) => x.socketId === socket.id);
    if (!p) return;

    p.x = Number(data.x) || p.x;
    p.z = Number(data.z) || p.z;
    p.dir = Number(data.dir) || 0;
    p.dis = Boolean(data.dis);
    p.type = data.type || null;
    p.dead = Boolean(data.dead);
    if (data.av) p.av = data.av;
    if (data.name) p.name = String(data.name).slice(0, 8);

    socket.to(currentRoom).emit('player:moved', {
      socketId: socket.id,
      x: p.x,
      z: p.z,
      dir: p.dir,
      dis: p.dis,
      type: p.type,
      dead: p.dead,
      em: data.em || 0,
      jy: Number(data.jy) || 0
    });
  });

  // Host memulai pertandingan untuk semua pemain di room
  socket.on('match:start', ({ totalBots }) => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room) return;

    const sender = room.players.find((x) => x.socketId === socket.id);
    if (!sender || !sender.isHost) return;

    roomManager.setRoomStatus(currentRoom, 'ACTIVE');
    io.to(currentRoom).emit('match:started', {
      seed: Math.floor(Math.random() * 1000000),
      totalPlayers: Math.max(room.players.length, Number(totalBots) || 6),
      players: room.players
    });
  });

  // Laporan akhir ronde untuk memperbarui kartu grup Telegram
  socket.on('match:end', ({ winner }) => {
    if (!currentRoom) return;
    const room = roomManager.getRoom(currentRoom);
    if (!room || room.status === 'RESULT') return;

    roomManager.setRoomStatus(currentRoom, 'RESULT', {
      lastWinner: String(winner || 'Warga').slice(0, 24)
    });
    io.to(currentRoom).emit('match:ended', { winner: room.lastWinner });
  });

  socket.on('disconnect', () => {
    const room = roomManager.leaveRoom(socket.id);
    if (room) {
      io.to(room.code).emit('room:update', {
        code: room.code,
        groupTitle: room.groupTitle,
        status: room.status,
        players: room.players
      });
    }
  });
});

// Jalankan Bot Telegram
if (process.env.BOT_TOKEN) {
  const bot = setupBot(
    process.env.BOT_TOKEN,
    process.env.WEBAPP_URL,
    process.env.BOT_USERNAME,
    process.env.APP_SHORT_NAME,
    roomManager
  );

  bot.launch().then(() => console.log('Telegram Bot aktif (Polling)'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('PERINGATAN: BOT_TOKEN belum diatur. Bot Telegram tidak dijalankan.');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Midnight Shift Server berjalan di port ${PORT}`);
});
