(function (W) {
  "use strict";
  const { $, PG, saveCfg, toast, openSheet, closeSheet, vib } = W.MS_CFG;
  const { drawMinimap } = W.MS_WORLD;
  const { MU } = W.MS_AUDIO;

  let myVote = null;
  let meetTimer = null;

  function onMatchStarted(NET, showScene, info) {
    closeSheet();
    if (W.MS_ESCAPE_FX) W.MS_ESCAPE_FX.resetEscapeState();
    showScene("hud");

    const roleUpper = info.roleName.toUpperCase();
    $("role").textContent = `${roleUpper} ⓘ`;
    $("role").style.cursor = "pointer";
    $("role").onclick = () => {
      if (W.MS_ROLE_FX) W.MS_ROLE_FX.showRoleCard(roleUpper);
    };

    $("bDis").classList.toggle("hide", info.team === "GUARD");
    if (W.MS_ROLE_FX) {
      W.MS_ROLE_FX.showRoleCard(roleUpper);
    } else {
      toast(`PERAN KAMU: ${roleUpper}`, info.team === "GUARD" ? "b" : "g");
    }
    vib(25);
  }

  function onMeetingUpdate(NET, m) {
    if (!m.active) return;
    if (!document.getElementById("vl")) myVote = null;

    const myId = String(m.myId || NET.getMyTgId() || "");
    const candidates = (m.candidates || []).filter((c) => String(c.id) !== myId);

    const rows = candidates.map((c) => {
      const picked = String(myVote) === String(c.id);
      return (
        `<div class="vr" data-vid="${c.id}" style="justify-content:space-between;border:2px solid ${picked ? "#22c55e" : "#334155"};` +
        `background:${picked ? "#14532d" : "#1e1b4b"};color:${picked ? "#facc15" : "#fff"};margin-bottom:5px">` +
        `<span>${picked ? "✓ " : "👤 "}${c.name}</span>` +
        `<span style="font-size:8px;padding:2px 6px;background:${picked ? "#22c55e" : "#0f172a"};color:${picked ? "#050914" : "#94a3b8"}">${picked ? "TERPILIH" : "VOTE"}</span>` +
        `</div>`
      );
    }).join("");

    const skipPicked = myVote === "SKIP";
    const clueHtml = (m.clues && m.clues.length)
      ? `<div style="background:#17133b;border-left:3px solid #facc15;padding:5px 7px;margin-bottom:8px;font-size:8px;text-align:left;color:#fde047;line-height:1.4">` +
        `🔍 JEJAK SABOTASE: ${m.clues.map((cl) => `${cl.termName} (Suspect: ${cl.suspect})`).join(" · ")}</div>`
      : "";

    const quickAccuse = ["Aku di terminal!", "Siapa dekat panel?", "Ada yang nyamar!", "Skip dulu aja"]
      .map((q) => `<button class="chip" data-qa="${q}" style="font-size:7.5px;padding:4px 6px">${q}</button>`)
      .join("");

    const secsLeft = Math.max(0, Math.ceil((m.endTime - Date.now()) / 1000));
    openSheet(
      `<div style="border:2px solid #ef4444;background:#0d091f;padding:8px">` +
      `<h2 style="color:#facc15;margin-bottom:4px">🚨 RAPAT DARURAT (<span id="mSec">${secsLeft}</span>D)</h2>` +
      `<p style="font-size:8.5px;margin-bottom:6px;color:#cbd5e1">${m.callerName} memanggil rapat · Suara: <b style="color:#22c55e">${m.votedCount}/${m.totalVoters}</b></p>` +
      clueHtml +
      `<div id="vl" style="max-height:160px;overflow-y:auto;margin-bottom:6px">${rows}</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-bottom:8px">${quickAccuse}</div>` +
      `<button class="pb ${skipPicked ? "g" : "d"}" id="vSkip">${skipPicked ? "✓ LEWATI VOTE DIPILIH" : "LEWATI VOTE"}</button>` +
      `</div>`
    );

    if (meetTimer) clearInterval(meetTimer);
    meetTimer = setInterval(() => {
      const el = document.getElementById("mSec");
      if (!el) return clearInterval(meetTimer);
      el.textContent = Math.max(0, Math.ceil((m.endTime - Date.now()) / 1000));
    }, 400);

    document.querySelectorAll("#vl .vr").forEach((el) => {
      el.onclick = () => {
        if (myVote) return toast("Kamu sudah memilih!", "i");
        myVote = el.dataset.vid;
        vib(15);
        NET.sendPlayerAction("VOTE", { targetId: myVote });
        toast("SUARA TERKIRIM!", "g");
        onMeetingUpdate(NET, { ...m, votedCount: Math.min(m.totalVoters, (m.votedCount || 0) + 1) });
      };
    });

    document.querySelectorAll("#box .chip[data-qa]").forEach((b) => {
      b.onclick = () => {
        NET.sendChat(`[RAPAT] ${b.dataset.qa}`);
        toast("Pesan rapat terkirim!", "i");
      };
    });

    $("vSkip").onclick = () => {
      if (myVote) return toast("Kamu sudah memilih!", "i");
      myVote = "SKIP";
      vib(12);
      NET.sendPlayerAction("VOTE", { targetId: "SKIP" });
      toast("MEMILIH LEWATI", "i");
      onMeetingUpdate(NET, { ...m, votedCount: Math.min(m.totalVoters, (m.votedCount || 0) + 1) });
    };
  }

  function onMatchResult(showScene, res) {
    if (meetTimer) clearInterval(meetTimer);
    if (W.MS_ESCAPE_FX) W.MS_ESCAPE_FX.ensureControls(false);
    PG.coins += res.yourReward.coins;
    PG.xp += res.yourReward.xp;
    saveCfg();
    const list = res.players.map((p) => `${p.won ? "🏆" : "•"} ${p.name} (${p.role})`).join("<br>");
    openSheet(
      `<h2>${res.yourReward.win ? "TIM KAMU MENANG!" : "RONDE SELESAI"}</h2>` +
      `<div style="line-height:1.8;margin-bottom:8px">${res.reason}<br><br>${list}<br><br>` +
      `<span style="color:var(--ac)">+${res.yourReward.coins} KOIN · +${res.yourReward.xp} XP</span></div>` +
      `<button class="pb g" id="bBackLobby">KEMBALI KE LOBI</button>`
    );
    $("bBackLobby").onclick = () => { closeSheet(); showScene("lobby"); };
  }

  function updateHud(snap) {
    const m = Math.max(0, Math.ceil(snap.timeLeft));
    const ents = snap.entities || [];
    const aliveCivs = ents.filter((e) => !e.dead && !e.escaped && e.team !== "GUARD").length;
    const totalCivs = ents.filter((e) => e.team !== "GUARD").length;
    const me = snap.you;

    // Timer + Sisa Penyintas + Indikator HP / Status Kabur
    const hpHearts = me.team === "GUARD" ? "🛡️" : me.escaped ? "🏃" : me.dead ? "👻" : "❤️".repeat(Math.max(1, me.hp || 1));
    $("tm").textContent = `${Math.floor(m / 60)}:${("0" + (m % 60)).slice(-2)} · 👥${aliveCivs}/${totalCivs} ${hpHearts}`;

    // Status 1 baris rapi agar tidak turun menabrak minimap
    $("tl").textContent = snap.gatesOpen ? "🚨 EXIT KANAN!" : `TUGAS ${snap.prog}/${snap.need}`;
    $("tb").style.width = `${Math.min(100, (snap.prog / snap.need) * 100)}%`;

    // Sembunyikan tombol kontrol jika sudah berhasil kabur / mati
    const locked = Boolean(me.escaped || me.dead);
    $("bDis").classList.toggle("hide", me.team === "GUARD" || locked);
    $("bSpr").classList.toggle("hide", locked);
    $("bAct").classList.toggle("hide", locked);

    $("bDis").textContent = me.disguised ? "BUKA" : "NYAMAR";
    $("bSpr").classList.toggle("off", me.sprintCd > 0);
    $("bSpr").textContent = me.sprintCd > 0 ? `${Math.ceil(me.sprintCd)}S` : "LARI";

    if (me.team !== "GUARD" && !locked) {
      const guards = ents.filter((e) => e.team === "GUARD" && !e.dead);
      const minDist = guards.length ? Math.min(...guards.map((g) => Math.hypot(g.x - me.x, g.z - me.z))) : 99;
      const desiredMode = minDist < 9 ? "chase" : "hud";
      if (MU.mode !== desiredMode) { MU.mode = desiredMode; MU.force = 1; }
    }

    const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - me.x, t.z - me.z) < 2.6);
    const nearBtn = Math.hypot(32 - me.x, 22 - me.z) < 2.5;
    const baseLabel = W.MS_ROLE_FX
      ? W.MS_ROLE_FX.getActionButtonLabel(me, snap, nearTerm, nearBtn)
      : me.team === "GUARD" ? "PUKUL" : nearTerm ? "TUGAS" : nearBtn ? "RAPAT" : "SKILL";

    const onCd = me.team === "GUARD" ? me.stun > 0 : (!nearTerm && !nearBtn && me.abCd > 0);
    $("bAct").textContent = (!nearTerm && !nearBtn && me.abCd > 0) ? `${Math.ceil(me.abCd)}S` : baseLabel;
    $("bAct").classList.toggle("off", onCd);

    drawMinimap(snap);
  }

  function drawExitCompass(ctx, VW, VH, snap, tclock) {
    if (!snap || !snap.gatesOpen || !snap.you || snap.you.team === "GUARD" || snap.you.escaped || snap.you.dead) return;
    const dx = 62.5 - snap.you.x;
    const dz = 22 - snap.you.z;
    const ang = Math.atan2(dz, dx);
    const cx = Math.round(VW / 2 + Math.cos(ang) * 38);
    const cy = Math.round(VH / 2 + Math.sin(ang) * 28);
    const pulse = Math.sin(tclock * 10) > 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    // Panah piksel mengarah ke Pintu Darurat Kanan
    ctx.fillStyle = pulse ? "#22c55e" : "#facc15";
    ctx.fillRect(-6, -3, 8, 6);
    ctx.fillRect(2, -5, 3, 10);
    ctx.fillRect(5, -2, 3, 4);
    ctx.restore();

    ctx.font = "bold 6px monospace";
    ctx.fillStyle = pulse ? "#bbf7d0" : "#fef08a";
    ctx.fillText("EXIT", cx - 8, cy - 8);
  }

  W.MS_HUD = { onMatchStarted, onMeetingUpdate, onMatchResult, updateHud, drawExitCompass };
})(window);
