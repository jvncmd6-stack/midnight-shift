"use strict";

const { PROPS, EMERGENCY_BUTTON } = require("../packages/shared/constants");
const { PHASE } = require("../packages/shared/protocol");

/**
 * Menangani aksi pemain (Disguise, Sprint, Attack, Task, Ability, Meeting & Voting)
 */
function handlePlayerAction(engine, tgId, action, payload = {}) {
  const pl = engine.players.get(tgId);
  if (!pl || !pl.alive || pl.escaped || engine.phase === PHASE.RESULT) return;
  const now = engine.elapsed;

  // 1. Voting saat Rapat Darurat
  if (engine.phase === PHASE.MEETING) {
    if (action === "VOTE" && engine.meeting && pl.team !== "GUARD") {
      if (engine.meeting.votes.has(tgId)) return;
      const targetId = payload.targetId || "SKIP";
      if (targetId === tgId) return;
      engine.meeting.votes.set(tgId, targetId);
      broadcastMeeting(engine);
      if (engine.meeting.votes.size >= engine.meeting.eligibleIds.length) {
        resolveMeeting(engine);
      }
    }
    return;
  }

  // 2. Nyamar / Buka Samaran Prop
  if (action === "DISGUISE" && pl.team !== "GUARD") {
    if (pl.disguised) {
      pl.disguised = false;
      pl.propType = null;
    } else {
      let nearest = "cone";
      let bestDist = 3.5;
      engine.props.forEach((pr) => {
        if (!pr.broken) {
          const d = Math.hypot(pr.x - pl.x, pr.z - pl.z);
          if (d < bestDist) {
            bestDist = d;
            nearest = pr.type;
          }
        }
      });
      pl.disguised = true;
      pl.propType = nearest;
      pl.hp = PROPS[nearest].hits;
    }
    return;
  }

  // 3. Lari Cepat (Sprint)
  if (action === "SPRINT" && now >= pl.sprintCdUntil) {
    if (pl.disguised) pl.disguised = false;
    const isPenyusup = pl.role === "PENYUSUP";
    pl.sprintUntil = now + (isPenyusup ? 4.5 : 3.0);
    pl.sprintCdUntil = now + (isPenyusup ? 10 : 12);
    return;
  }

  // 4. Serangan Satpam
  if (action === "ATTACK" && pl.team === "GUARD" && now >= engine.grace && now >= pl.stunUntil) {
    if (now < pl.abilityCdUntil) return;
    pl.abilityCdUntil = now + 1.2;
    performGuardAttack(engine, pl);
    return;
  }

  // 5. Penyelesaian Tugas (Validasi jarak server-side)
  if (action === "COMPLETE_TASK" && pl.team !== "GUARD") {
    const term = engine.terminals.find((t) => t.id === Number(payload.termId) && !t.done);
    if (!term || Math.hypot(term.x - pl.x, term.z - pl.z) > 2.8) return;
    term.done = true;
    term.sabotaged = false;
    pl.tasksDone++;
    engine.progress++;
    engine.io.to(engine.room.code).emit("game:toast", {
      text: `${term.name.toUpperCase()} SELESAI! (${engine.progress}/${engine.quota})`,
      type: "g"
    });
    if (engine.progress >= engine.quota && !engine.gatesOpen) {
      engine.gatesOpen = true;
      engine.phase = PHASE.FINAL_ESCAPE;
      engine.limit = Math.min(engine.limit, engine.elapsed + 35);
      engine.io.to(engine.room.code).emit("game:toast", {
        text: "ALARM! PINTU DARURAT KANAN TERBUKA 35 DETIK!",
        type: "g"
      });
    }
    return;
  }

  // 6. Skill Spesial Peran
  if (action === "ABILITY" && now >= engine.grace && now >= pl.abilityCdUntil) {
    if (pl.role === "TEKNISI") {
      pl.scanUntil = now + 6;
      pl.abilityCdUntil = now + 25;
    } else if (pl.role === "DOKTER") {
      for (const other of engine.players.values()) {
        if (other.id !== pl.id && other.alive && other.team === "CIVILIAN" && other.hp < 2) {
          if (Math.hypot(other.x - pl.x, other.z - pl.z) < 2.5) {
            other.hp = 2;
            pl.abilityCdUntil = now + 25;
            break;
          }
        }
      }
    } else if (pl.role === "CEPU" && engine.sabCount < 4) {
      const doneTerm = engine.terminals.find((t) => t.done);
      if (doneTerm) {
        doneTerm.done = false;
        doneTerm.sabotaged = true;
        engine.progress = Math.max(0, engine.progress - 1);
        engine.sabCount++;
        pl.abilityCdUntil = now + 30;
        engine.clues.push({ termName: doneTerm.name, suspect: pl.name });
        engine.io.to(engine.room.code).emit("game:toast", {
          text: `PERINGATAN! ${doneTerm.name.toUpperCase()} DISABOTASE! (${engine.sabCount}/4)`,
          type: "b"
        });
        if (engine.sabCount >= 4) {
          engine.finishMatch("GUARD", "Sabotase Cepu menghancurkan sistem gedung!");
        }
      }
    }
    return;
  }

  // 7. Panggil Rapat Darurat
  if (
    action === "CALL_MEETING" &&
    pl.team !== "GUARD" &&
    engine.room.mode !== "QUICK" &&
    now >= engine.grace &&
    engine.meetingsUsed < 2 &&
    now - engine.lastMeetingAt > 45 &&
    Math.hypot(EMERGENCY_BUTTON.x - pl.x, EMERGENCY_BUTTON.z - pl.z) < 2.6
  ) {
    startMeeting(engine, pl);
  }
}

function performGuardAttack(engine, guard) {
  const reach = 1.9;
  const gx = guard.x + Math.cos(guard.aim) * 1.1;
  const gz = guard.z + Math.sin(guard.aim) * 1.1;

  for (const target of engine.players.values()) {
    if (!target.alive || target.escaped || target.team === "GUARD") continue;
    if (Math.hypot(target.x - gx, target.z - gz) <= reach) {
      target.hp -= 1;
      target.disguised = false;
      if (target.hp <= 0) {
        target.alive = false;
        engine.io.to(engine.room.code).emit("game:toast", {
          text: `${target.name.toUpperCase()} TERTANGKAP SATPAM!`,
          type: "b"
        });
      } else if (target.socketId) {
        engine.io.to(target.socketId).emit("game:toast", {
          text: "KENA PUKUL! NYAWA TERSISA 1",
          type: "b"
        });
      }
      return;
    }
  }

  for (const pr of engine.props) {
    if (!pr.broken && Math.hypot(pr.x - gx, pr.z - gz) <= reach) {
      guard.stunUntil = engine.elapsed + 1.5;
      if (guard.socketId) {
        engine.io.to(guard.socketId).emit("game:toast", {
          text: "SALAH PUKUL BENDA ASLI! STUN 1.5D",
          type: "b"
        });
      }
      return;
    }
  }
}

function startMeeting(engine, caller) {
  engine.phase = PHASE.MEETING;
  engine.meetingsUsed++;
  engine.lastMeetingAt = engine.elapsed;

  const eligible = [];
  engine.players.forEach((p) => {
    if (p.alive && !p.escaped && p.team !== "GUARD") {
      p.disguised = false;
      eligible.push({ id: p.id, name: p.name, avatar: p.avatar });
    }
  });

  engine.meeting = {
    callerName: caller.name,
    endTime: Date.now() + 25000,
    eligible,
    eligibleIds: eligible.map((e) => e.id),
    votes: new Map()
  };

  setTimeout(() => {
    if (engine.phase !== PHASE.MEETING || !engine.meeting) return;
    eligible.forEach((e) => {
      const pl = engine.players.get(e.id);
      if (pl && pl.isBot && !engine.meeting.votes.has(pl.id)) {
        const candidates = eligible.filter((c) => c.id !== pl.id);
        const pick = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].id : "SKIP";
        engine.meeting.votes.set(pl.id, pick);
      }
    });
    broadcastMeeting(engine);
  }, 3000);

  broadcastMeeting(engine);
  setTimeout(() => {
    if (engine.phase === PHASE.MEETING) resolveMeeting(engine);
  }, 25000);
}

function broadcastMeeting(engine) {
  if (!engine.meeting) return;
  engine.io.to(engine.room.code).emit("meeting:update", {
    callerName: engine.meeting.callerName,
    endTime: engine.meeting.endTime,
    eligible: engine.meeting.eligible,
    votedCount: engine.meeting.votes.size,
    totalVoters: engine.meeting.eligibleIds.length,
    clues: engine.clues.slice(-3)
  });
}

function resolveMeeting(engine) {
  if (!engine.meeting) return;
  const tally = new Map();
  engine.meeting.votes.forEach((targetId) => {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  });

  let topId = null;
  let topVotes = 0;
  let tie = false;
  tally.forEach((count, id) => {
    if (count > topVotes) {
      topVotes = count;
      topId = id;
      tie = false;
    } else if (count === topVotes) {
      tie = true;
    }
  });

  engine.meeting = null;
  engine.phase = engine.gatesOpen ? PHASE.FINAL_ESCAPE : PHASE.ACTIVE;

  if (!topId || topId === "SKIP" || tie) {
    engine.io.to(engine.room.code).emit("meeting:result", {
      ejectedName: null,
      message: "Suara seri atau dilewati. Tidak ada yang diusir."
    });
    return;
  }

  const ejected = engine.players.get(topId);
  if (ejected) {
    ejected.alive = false;
    const isBadut = ejected.role === "BADUT";
    const isCepu = ejected.role === "CEPU";
    engine.io.to(engine.room.code).emit("meeting:result", {
      ejectedName: ejected.name,
      roleRevealed: ejected.role,
      message: isBadut
        ? `${ejected.name} adalah BADUT! Badut memenangkan permainan!`
        : isCepu
          ? `${ejected.name} adalah CEPU! Sabotase berhasil dihentikan!`
          : `${ejected.name} ternyata BUKAN Cepu (${ejected.role})!`
    });

    if (isBadut) {
      engine.finishMatch("BADUT", `${ejected.name} berhasil menipu semua orang sebagai Badut!`);
    }
  }
}

module.exports = { handlePlayerAction };
