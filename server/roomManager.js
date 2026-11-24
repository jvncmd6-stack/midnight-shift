const EventEmitter = require('events');

class RoomManager extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();       // code -> room object
    this.groupToRoom = new Map(); // groupId -> code
  }

  createRoom({ code, groupId = null, groupTitle = '' }) {
    const room = {
      code,
      groupId,
      groupTitle,
      cardMessageId: null,
      mode: 'Classic Shift',
      maxPlayers: 20,
      status: 'WAITING', // WAITING | ACTIVE | RESULT
      players: [],       // { socketId, telegramId, name, av, isHost, x, z, dir, dis, type, dead }
      lastWinner: null,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    if (groupId) this.groupToRoom.set(groupId, code);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  getRoomByGroup(groupId) {
    const code = this.groupToRoom.get(String(groupId));
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room || room.status === 'RESULT') {
      this.groupToRoom.delete(String(groupId));
      return null;
    }
    return room;
  }

  attachCardMessage(code, groupId, messageId) {
    const room = this.rooms.get(code);
    if (room) {
      room.groupId = String(groupId);
      room.cardMessageId = messageId;
    }
  }

  joinRoom(code, playerData) {
    let room = this.rooms.get(code);
    if (!room) {
      room = this.createRoom({ code });
    }
    if (room.players.length >= room.maxPlayers) {
      return { error: 'ROOM_FULL' };
    }

    // Cegah duplikasi akun Telegram yang sama di 1 room
    const existingIdx = room.players.findIndex(
      (p) => p.telegramId && p.telegramId === playerData.telegramId
    );
    if (existingIdx > -1) {
      room.players.splice(existingIdx, 1);
    }

    const isHost = room.players.length === 0;
    const player = {
      ...playerData,
      isHost,
      x: 24,
      z: 12.6,
      dir: 0,
      dis: false,
      type: null,
      dead: false
    };

    room.players.push(player);
    this.emit('room:changed', room);
    return { room, player };
  }

  leaveRoom(socketId) {
    for (const [code, room] of this.rooms.entries()) {
      const idx = room.players.findIndex((p) => p.socketId === socketId);
      if (idx > -1) {
        const wasHost = room.players[idx].isHost;
        room.players.splice(idx, 1);

        if (room.players.length === 0) {
          // Hapus room kosong setelah 5 menit jika tidak ada yang masuk lagi
          setTimeout(() => {
            const r = this.rooms.get(code);
            if (r && r.players.length === 0) {
              if (r.groupId) this.groupToRoom.delete(r.groupId);
              this.rooms.delete(code);
            }
          }, 300000);
        } else if (wasHost) {
          // Host migration otomatis
          room.players[0].isHost = true;
        }

        this.emit('room:changed', room);
        return room;
      }
    }
    return null;
  }

  setRoomStatus(code, status, extra = {}) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.status = status;
    Object.assign(room, extra);
    this.emit('room:changed', room);
  }
}

module.exports = new RoomManager();
