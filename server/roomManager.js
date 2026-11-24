"use strict";

const crypto = require("crypto");
const { PHASE, ERROR_CODES, sanitizeAvatar, sanitizeName } = require("../packages/shared/protocol");
const { GameEngine } = require("./gameEngine");

// Karakter kode room tanpa huruf/angka ambigu (O, 0, I, 1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

class RoomManager {
  constructor(io, onGroupCardUpdate) {
    this.io = io;
    this.onGroupCardUpdate = onGroupCardUpdate || (() => {});
    this.rooms = new Map(); // code -> Room
    this.userRoom = new Map(); // telegramId -> roomCode
    this.groupRoom = new Map(); // chatId -> roomCode

    // Pembersih room kosong & grace period disconnect setiap 5 detik
    this.gcInterval = setInterval(() => this.cleanup(), 5000);
  }

  generateCode() {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = "";
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      }
      if (!this.rooms.has(code)) return code;
    }
    return crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  createRoom({ hostUser, mode = "CLASSIC", isPublic = true, chatId = null, groupTitle = "" }) {
    // Jika dari grup dan sudah ada lobby aktif di grup itu, kembalikan lobby tersebut
    if (chatId) {
      const existingCode = this.groupRoom.get(String(chatId));
      const existing = existingCode ? this.rooms.get(existingCode) : null;
      if (existing && existing.phase === PHASE.WAITING) {
        return { room: existing, reused: true };
      }
    }

    const code = this.generateCode();
    const validModes = ["QUICK", "CLASSIC", "CHAOS"];
    const cleanMode = validModes.includes(mode) ? mode : "CLASSIC";

    const room = {
      code,
      hostTgId: hostUser.telegramId,
      mode: cleanMode,
      isPublic: Boolean(isPublic) && !chatId,
      chatId: chatId ? String(chatId) : null,
      groupTitle: groupTitle ? String(groupTitle).slice(0, 64) : "",
      groupMessageId: null,
      phase: PHASE.WAITING,
      members: new Map(), // telegramId -> Member
      engine: null,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.rooms.set(code, room);
    if (room.chatId) {
      this.groupRoom.set(room.chatId, code);
    }

    this.joinRoom(code, hostUser, null);
    return { room, reused: false };
  }

  joinRoom(code, user, socket) {
    const cleanCode = String(code || "").toUpperCase().trim();
    const room = this.rooms.get(cleanCode);
    if (!room) return { error: "ROOM_NOT_FOUND", message: ERROR_CODES.ROOM_NOT_FOUND };

    // Cek apakah pemain sudah berada di dalam room ini (Reconnect!)
    const existingMember = room.members.get(user.telegramId);
    if (existingMember) {
      existingMember.connected = true;
      existingMember.disconnectedAt = null;
      existingMember.socketId = socket ? socket.id : null;
      existingMember.name = sanitizeName(user.displayName);
      existingMember.avatar = sanitizeAvatar(user.avatar);
      this.userRoom.set(user.telegramId, cleanCode);

      if (socket) {
        socket.join(cleanCode);
        socket.data.roomCode = cleanCode;
      }
      if (room.engine) {
        room.engine.onPlayerReconnect(user.telegramId, socket);
      }
      this.broadcastRoomState(room);
      return { room, reconnected: true };
    }

    // Jika sedang match berjalan, tolak join baru
    if (room.phase !== PHASE.WAITING) {
      return { error: "MATCH_IN_PROGRESS", message: ERROR_CODES.MATCH_IN_PROGRESS };
    }

    if (room.members.size >= 20) {
      return { error: "ROOM_FULL", message: ERROR_CODES.ROOM_FULL };
    }

    // Keluarkan dari room lama jika pindah room
    const prevCode = this.userRoom.get(user.telegramId);
    if (prevCode && prevCode !== cleanCode) {
      this.leaveRoom(user.telegramId);
    }

    const member = {
      userId: user.id,
      telegramId: user.telegramId,
      name: sanitizeName(user.displayName),
      avatar: sanitizeAvatar(user.avatar),
      ready: room.members.size === 0, // Host otomatis ready
      connected: true,
      disconnectedAt: null,
      socketId: socket ? socket.id : null,
      x: 24 + (Math.random() - 0.5) * 6,
      z: 13 + (Math.random() - 0.5) * 2,
      dir: 0
    };

    room.members.set(user.telegramId, member);
    room.lastActivity = Date.now();
    this.userRoom.set(user.telegramId, cleanCode);

    if (socket) {
      socket.join(cleanCode);
      socket.data.roomCode = cleanCode;
    }

    this.broadcastRoomState(room);
    this.triggerGroupUpdate(room);
    return { room, reconnected: false };
  }

  leaveRoom(telegramId, socket = null) {
    const code = this.userRoom.get(telegramId);
    if (!code) return;
    const room = this.rooms.get(code);
    this.userRoom.delete(telegramId);

    if (socket) {
      socket.leave(code);
      socket.data.roomCode = null;
    }
    if (!room) return;

    if (room.phase === PHASE.WAITING) {
      room.members.delete(telegramId);
      if (room.members.size === 0) {
        this.destroyRoom(code);
        return;
      }
      // Migrasi Host otomatis jika host keluar
      if (room.hostTgId === telegramId) {
        const nextHost = room.members.values().next().value;
        room.hostTgId = nextHost.telegramId;
        nextHost.ready = true;
      }
      this.broadcastRoomState(room);
      this.triggerGroupUpdate(room);
    } else if (room.engine) {
      room.engine.onPlayerDisconnect(telegramId, true);
    }
  }

  handleSocketDisconnect(telegramId) {
    const code = this.userRoom.get(telegramId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;

    const member = room.members.get(telegramId);
    if (!member) return;

    member.connected = false;
    member.disconnectedAt = Date.now();
    member.socketId = null;

    if (room.phase === PHASE.WAITING) {
      // Beri waktu 15 detik di lobby sebelum dihapus (antisipasi refresh WebView)
      setTimeout(() => {
        const m = room.members.get(telegramId);
        if (m && !m.connected && room.phase === PHASE.WAITING) {
          this.leaveRoom(telegramId);
        }
      }, 15000);
      this.broadcastRoomState(room);
    } else if (room.engine) {
      room.engine.onPlayerDisconnect(telegramId, false);
    }
  }

  toggleReady(telegramId) {
    const code = this.userRoom.get(telegramId);
    const room = code ? this.rooms.get(code) : null;
    if (!room || room.phase !== PHASE.WAITING) return;
    const m = room.members.get(telegramId);
    if (!m) return;
    m.ready = !m.ready;
    room.lastActivity = Date.now();
    this.broadcastRoomState(room);
    this.triggerGroupUpdate(room);
  }

  updateSettings(telegramId, { mode, isPublic }) {
    const code = this.userRoom.get(telegramId);
    const room = code ? this.rooms.get(code) : null;
    if (!room || room.phase !== PHASE.WAITING || room.hostTgId !== telegramId) return;

    if (["QUICK", "CLASSIC", "CHAOS"].includes(mode)) {
      room.mode = mode;
    }
    if (typeof isPublic === "boolean" && !room.chatId) {
      room.isPublic = isPublic;
    }
    // Reset ready selain host saat pengaturan berubah
    room.members.forEach((m) => {
      if (m.telegramId !== room.hostTgId) m.ready = false;
    });
    this.broadcastRoomState(room);
    this.triggerGroupUpdate(room);
  }

  moveInLobby(telegramId, x, z, dir) {
    const code = this.userRoom.get(telegramId);
    const room = code ? this.rooms.get(code) : null;
    if (!room || room.phase !== PHASE.WAITING) return;
    const m = room.members.get(telegramId);
    if (!m) return;
    m.x = Math.max(1.5, Math.min(46.5, x));
    m.z = Math.max(10.9, Math.min(29.3, z));
    m.dir = [0, 1, 2, 3].includes(dir) ? dir : 0;
  }

  startMatch(telegramId, fillWithBots = true) {
    const code = this.userRoom.get(telegramId);
    const room = code ? this.rooms.get(code) : null;
    if (!room || room.phase !== PHASE.WAITING || room.hostTgId !== telegramId) {
      return { error: "ACTION_DENIED", message: "Hanya host yang bisa memulai permainan." };
    }

    const activeMembers = Array.from(room.members.values()).filter((m) => m.connected);
    if (!fillWithBots && activeMembers.length < 4) {
      return { error: "ACTION_DENIED", message: "Minimal 4 pemain untuk mode tanpa bot." };
    }

    room.phase = PHASE.PREPARATION;
    room.engine = new GameEngine(this.io, room, (summary) => {
      room.phase = PHASE.WAITING;
      room.engine = null;
      this.broadcastRoomState(room);
      this.triggerGroupUpdate(room, summary);
    });

    room.engine.start(fillWithBots);
    this.triggerGroupUpdate(room);
    return { ok: true };
  }

  getPublicRooms() {
    const list = [];
    this.rooms.forEach((r) => {
      if (r.isPublic && r.phase === PHASE.WAITING && r.members.size < 20) {
        const host = r.members.get(r.hostTgId);
        list.push({
          code: r.code,
          hostName: host ? host.name : "Host",
          mode: r.mode,
          count: r.members.size,
          max: 20
        });
      }
    });
    return list.slice(0, 15);
  }

  serializeRoom(room) {
    const members = [];
    room.members.forEach((m) => {
      members.push({
        tgId: m.telegramId,
        name: m.name,
        avatar: m.avatar,
        ready: m.ready,
        connected: m.connected,
        isHost: m.telegramId === room.hostTgId,
        x: m.x,
        z: m.z,
        dir: m.dir
      });
    });
    return {
      code: room.code,
      hostTgId: room.hostTgId,
      mode: room.mode,
      isPublic: room.isPublic,
      chatId: room.chatId,
      groupTitle: room.groupTitle,
      phase: room.phase,
      members
    };
  }

  broadcastRoomState(room) {
    this.io.to(room.code).emit("room:update", this.serializeRoom(room));
  }

  triggerGroupUpdate(room, matchResult = null) {
    if (room.chatId) {
      this.onGroupCardUpdate(room, matchResult);
    }
  }

  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.engine) room.engine.stop();
    if (room.chatId && this.groupRoom.get(room.chatId) === code) {
      this.groupRoom.delete(room.chatId);
    }
    room.members.forEach((_, tgId) => {
      if (this.userRoom.get(tgId) === code) this.userRoom.delete(tgId);
    });
    this.rooms.delete(code);
  }

  cleanup() {
    const now = Date.now();
    this.rooms.forEach((room, code) => {
      if (room.phase === PHASE.WAITING && now - room.lastActivity > 15 * 60 * 1000) {
        this.destroyRoom(code);
      }
    });
  }
}

module.exports = { RoomManager };
