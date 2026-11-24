"use strict";

const crypto = require("crypto");
const {
  TICK_RATE,
  PROPS,
  ZONES,
  TERMINALS,
  EXIT_GATES,
  ROLES,
  getRoleDistribution,
  isBlocked,
  hasLineOfSight
} = require("../packages/shared/constants");
const { PHASE } = require("../packages/shared/protocol");
const { commitMatchReward } = require("./db");
const { handlePlayerAction } = require("./gameCombat");

const BOT_NAMES = ["Rani", "Dimas", "Sekar", "Bayu", "Putri", "Raka", "Laras", "Eko", "Nina", "Fajar", "Tari", "Yoga"];

class GameEngine {
  constructor(io, room, onMatchFinished) {
    this.io = io;
    this.room = room;
    this.onMatchFinished = onMatchFinished;
    this.matchId = `m_${room.code}_${crypto.randomBytes(4).toString("hex")}`;
    this.phase = PHASE.PREPARATION;
    this.tickCount = 0;
    this.elapsed = 0;
    this.limit = 270;
    this.grace = 15;
    this.players = new Map();
    this.props = [];
    this.terminals = [];
    this.progress = 0;
    this.quota = 4;
    this.gatesOpen = false;
    this.sabCount = 0;
    this.clues = [];
    this.meeting = null;
    this.meetingsUsed = 0;
    this.lastMeetingAt = -60;
    this.interval = null;
  }

  start(fillWithBots) {
    const participants = [];
    this.room.members.forEach((m) => {
      if (m.connected) {
        participants.push({
          id: m.telegramId,
          userId: m.userId,
          name: m.name,
          avatar: m.avatar,
          isBot: false,
          socketId: m.socketId
        });
      }
    });

    let botIdx = 0;
    while (fillWithBots && participants.length < 6) {
      const bName = BOT_NAMES[botIdx % BOT_NAMES.length];
      participants.push({
        id: `bot_${botIdx++}`,
        userId: null,
        name: bName,
        avatar: { g: botIdx % 2 ? "f" : "m", skin: botIdx % 6, hair: botIdx % 8, hairC: botIdx % 6, shirt: botIdx % 6, shirtC: botIdx % 8, bot: botIdx % 5, botC: (botIdx + 2) % 8, acc: 0 },
        isBot: true,
        socketId: null
      });
    }

    const shuffled = participants.sort(() => Math.random() - 0.5);
    const dist = getRoleDistribution(shuffled.length, this.room.mode);
    const rolePool = [];
    for (let i = 0; i < dist.guards; i++) rolePool.push("SATPAM");
    for (let i = 0; i < dist.traitors; i++) rolePool.push("CEPU");
    for (let i = 0; i < dist.neutrals; i++) rolePool.push("BADUT");
    const civSpecials = ["TEKNISI", "PENYUSUP", "DOKTER"];
    for (let i = 0; i < dist.civilians; i++) {
      rolePool.push(i < civSpecials.length && shuffled.length >= 6 ? civSpecials[i] : "WARGA");
    }

    this.quota = Math.max(3, Math.min(6, dist.civilians + dist.traitors));

    shuffled.forEach((p, idx) => {
      const roleKey = rolePool[idx] || "WARGA";
      const roleInfo = ROLES[roleKey];
      const isGuard = roleInfo.team === "GUARD";
      this.players.set(p.id, {
        ...p,
        role: roleKey,
        team: roleInfo.team,
        x: isGuard ? 3.5 + (idx % 3) : 6 + (idx % 5) * 0.8,
        z: isGuard ? 39 : 37 + (idx % 3) * 0.8,
        dir: 0,
        ix: 0,
        iy: 0,
        aim: 0,
        hp: isGuard ? 99 : 2,
        alive: true,
        escaped: false,
        disguised: false,
        propType: null,
        anonPropId: `p_${crypto.randomBytes(3).toString("hex")}`,
        sprintUntil: 0,
        sprintCdUntil: 0,
        abilityCdUntil: 0,
        scanUntil: 0,
        stunUntil: 0,
        tasksDone: 0,
        disconnectedAt: null,
        botTimer: 1 + Math.random() * 2
      });
    });

    ZONES.forEach((z) => {
      if (!z.props.length) return;
      for (let i = 0; i < 7; i++) {
        const type = z.props[i % z.props.length];
        const px = z.x + 1.5 + Math.random() * (z.w - 3);
        const pz = z.y + 1.5 + Math.random() * (z.h - 3);
        if (!isBlocked(px, pz)) {
          this.props.push({ id: `static_${this.props.length}`, type, x: px, z: pz, hits: PROPS[type].hits, broken: false });
        }
      }
    });

    this.terminals = TERMINALS.map((t) => ({ ...t, done: false, sabotaged: false }));

    this.players.forEach((pl) => {
      if (!pl.isBot && pl.socketId) {
        this.io.to(pl.socketId).emit("role:assigned", {
          matchId: this.matchId,
          role: pl.role,
          roleInfo: ROLES[pl.role],
          quota: this.quota
        });
      }
    });

    const dt = 1 / TICK_RATE;
    this.interval = setInterval(() => this.tick(dt), 1000 / TICK_RATE);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  setPlayerInput(tgId, input) {
    const pl = this.players.get(tgId);
    if (!pl || !pl.alive || pl.escaped) return;
    pl.ix = input.ix;
    pl.iy = input.iy;
    pl.aim = input.aim;
  }

  handleAction(tgId, action, payload) {
    handlePlayerAction(this, tgId, action, payload);
  }

  tick(dt) {
    if (this.phase === PHASE.RESULT || this.phase === PHASE.MEETING) return;
    this.tickCount++;
    this.elapsed += dt;

    if (this.phase === PHASE.PREPARATION && this.elapsed >= this.grace) {
      this.phase = PHASE.ACTIVE;
      this.io.to(this.room.code).emit("game:toast", { text: "SATPAM MULAI PATROLI!", type: "b" });
    }

    let livingCivilians = 0;
    let escapedCivilians = 0;

    this.players.forEach((pl) => {
      if (!pl.alive || pl.escaped) {
        if (pl.escaped && pl.team === "CIVILIAN") escapedCivilians++;
        return;
      }
      if (pl.team === "CIVILIAN" || pl.team === "TRAITOR") livingCivilians++;
      if (pl.isBot) this.stepBotAI(pl, dt);
      if (pl.team === "GUARD" && this.elapsed < this.grace) return;
      if (this.elapsed < pl.stunUntil) return;

      const isSprinting = this.elapsed < pl.sprintUntil;
      const propMult = pl.disguised && pl.propType ? PROPS[pl.propType].speedMult : 1;
      const speed = (pl.team === "GUARD" ? 4.3 : 4.0) * (isSprinting ? 1.6 : 1) * propMult * dt;

      if (Math.hypot(pl.ix, pl.iy) > 0.1) {
        const nx = pl.x + pl.ix * speed;
        const nz = pl.z + pl.iy * speed;
        if (!isBlocked(nx, pl.z)) pl.x = nx;
        if (!isBlocked(pl.x, nz)) pl.z = nz;
        pl.dir = Math.abs(pl.ix) > Math.abs(pl.iy) ? (pl.ix > 0 ? 2 : 3) : pl.iy > 0 ? 0 : 1;
      }

      if (this.gatesOpen && pl.team !== "GUARD" && !pl.disguised) {
        for (const gate of EXIT_GATES) {
          if (Math.hypot(gate.x - pl.x, gate.z - pl.z) < 1.8) {
            pl.escaped = true;
            if (pl.team === "CIVILIAN") escapedCivilians++;
            this.io.to(this.room.code).emit("game:toast", { text: `${pl.name.toUpperCase()} BERHASIL KABUR!`, type: "g" });
            break;
          }
        }
      }
    });

    if (escapedCivilians > 0 && livingCivilians === 0) return this.finishMatch("CIVILIAN", "Warga berhasil menyelesaikan tugas dan kabur!");
    if (livingCivilians === 0 && escapedCivilians === 0) return this.finishMatch("GUARD", "Semua warga berhasil ditangkap Satpam!");
    if (this.elapsed >= this.limit) {
      return escapedCivilians > 0
        ? this.finishMatch("CIVILIAN", "Waktu habis, sebagian warga selamat kabur!")
        : this.finishMatch("GUARD", "Waktu habis sebelum warga berhasil kabur!");
    }

    if (this.tickCount % 2 === 0) this.broadcastFilteredSnapshots();
  }

  stepBotAI(bot, dt) {
    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = 1.5 + Math.random() * 2.5;
      if (bot.team !== "GUARD" && this.elapsed > 4 && !bot.disguised && Math.random() < 0.7) {
        this.handleAction(bot.id, "DISGUISE");
        bot.ix = bot.iy = 0;
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      bot.ix = Math.cos(angle);
      bot.iy = Math.sin(angle);
      bot.aim = angle;
    }
    if (bot.team === "GUARD" && this.elapsed >= this.grace && Math.random() < 0.05) {
      this.handleAction(bot.id, "ATTACK");
    }
  }

  broadcastFilteredSnapshots() {
    const baseState = {
      matchId: this.matchId,
      tick: this.tickCount,
      phase: this.phase,
      timeLeft: Math.max(0, Math.ceil(this.limit - this.elapsed)),
      graceLeft: Math.max(0, Math.ceil(this.grace - this.elapsed)),
      progress: this.progress,
      quota: this.quota,
      gatesOpen: this.gatesOpen,
      sabCount: this.sabCount,
      terminals: this.terminals
    };

    this.players.forEach((viewer) => {
      if (viewer.isBot || !viewer.socketId) return;
      const visibleEntities = [];
      const viewRange = viewer.team === "GUARD" ? 13 : 16;

      this.players.forEach((other) => {
        if (!other.alive || other.escaped) return;
        const isSelf = other.id === viewer.id;
        const dist = Math.hypot(other.x - viewer.x, other.z - viewer.z);
        const canScan = viewer.scanUntil > this.elapsed && other.team === "GUARD";
        if (!isSelf && !canScan && (dist > viewRange || !hasLineOfSight(viewer.x, viewer.z, other.x, other.z))) return;

        if (other.disguised && !isSelf && viewer.team === "GUARD") {
          visibleEntities.push({ id: other.anonPropId, isAnonProp: true, propType: other.propType, x: other.x, z: other.z });
        } else {
          visibleEntities.push({
            id: other.id,
            name: other.name,
            avatar: other.avatar,
            team: isSelf || viewer.team === other.team ? other.team : "UNKNOWN",
            x: other.x,
            z: other.z,
            dir: other.dir,
            aim: other.aim,
            hp: other.hp,
            disguised: other.disguised,
            propType: other.propType,
            moving: Math.hypot(other.ix, other.iy) > 0.1
          });
        }
      });

      this.io.to(viewer.socketId).emit("match:snapshot", {
        ...baseState,
        you: {
          id: viewer.id,
          role: viewer.role,
          team: viewer.team,
          hp: viewer.hp,
          alive: viewer.alive,
          escaped: viewer.escaped,
          disguised: viewer.disguised,
          sprintCd: Math.max(0, Math.ceil(viewer.sprintCdUntil - this.elapsed)),
          abilityCd: Math.max(0, Math.ceil(viewer.abilityCdUntil - this.elapsed))
        },
        entities: visibleEntities,
        props: this.props
      });
    });
  }

  async finishMatch(winningTeam, reason) {
    if (this.phase === PHASE.RESULT) return;
    this.phase = PHASE.RESULT;
    this.stop();

    const summary = [];
    for (const pl of this.players.values()) {
      const won =
        (winningTeam === "CIVILIAN" && pl.team === "CIVILIAN") ||
        (winningTeam === "GUARD" && (pl.team === "GUARD" || pl.team === "TRAITOR")) ||
        (winningTeam === "BADUT" && pl.role === "BADUT");

      const coins = (won ? 35 : 10) + pl.tasksDone * 5 + (pl.escaped ? 15 : 0);
      const xp = (won ? 80 : 30) + pl.tasksDone * 12;

      summary.push({ id: pl.id, name: pl.name, role: pl.role, team: pl.team, won, escaped: pl.escaped, tasksDone: pl.tasksDone, coins, xp });

      if (!pl.isBot && pl.userId) {
        await commitMatchReward(this.matchId, pl.userId, { coins, xp, win: won, tasksDone: pl.tasksDone, escapeSec: pl.escaped ? this.elapsed : 0 });
      }
    }

    this.io.to(this.room.code).emit("match:result", { matchId: this.matchId, winningTeam, reason, players: summary });
    setTimeout(() => this.onMatchFinished({ winningTeam, reason, players: summary }), 10000);
  }

  onPlayerDisconnect(tgId, permanent) {
    const pl = this.players.get(tgId);
    if (!pl) return;
    pl.ix = pl.iy = 0;
    pl.disconnectedAt = Date.now();
    if (permanent) pl.alive = false;
  }

  onPlayerReconnect(tgId, socket) {
    const pl = this.players.get(tgId);
    if (!pl) return;
    pl.disconnectedAt = null;
    pl.socketId = socket ? socket.id : null;
    if (socket) {
      socket.emit("role:assigned", { matchId: this.matchId, role: pl.role, roleInfo: ROLES[pl.role], quota: this.quota });
    }
  }
}

module.exports = { GameEngine };
