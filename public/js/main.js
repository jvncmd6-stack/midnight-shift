(function (W) {
  "use strict";
  const { $, R, rnd, cl, vib, tgw, getUN, setUN, CFG, PG, saveCfg, T, MW, MH, SKIN, HAIR, CLR, CAT, LOCK, ME, PRE, QUICK_CHATS, ok, owned, audioOn, beep, MU, toast, openSheet, closeSheet, fmt } = W.MS_CFG;
  const { spr } = W.MS_SPR;
  const { wc, lc, LW, LH, drawSky, drawAvatarLabel, drawPropSprite, drawMinimap } = W.MS_WORLD;
  const NET = W.MS_NET;
  const { openTaskModal } = W.MS_TASKS;

  const cv = $("c"), ctx = cv.getContext("2d");
  const dm = document.createElement("canvas"), dx = dm.getContext("2d");
  let VW = 300, VH = 170, SC = 3, scene = "splash", tclock = 0;
  let jx = 0, jy = 0, keys = {}, inputSeq = 0, lastInputSent = 0;
  let fillBots = true;

  // State karakter lokal di lobi jalan kota
  const LM = { x: 24, z: 13, dir: 0, jy: 0, vy: 0, em: 0, et: 0, mv: false, lastSend: 0 };

  function resize() {
    const pt = innerHeight > innerWidth;
    SC = pt ? Math.max(2, Math.round(innerWidth / 140)) : Math.max(2, Math.min(Math.round(innerWidth / 300), Math.round(innerHeight / 150)));
    VW = Math.ceil(innerWidth / SC);
    VH = Math.ceil(innerHeight / SC);
    cv.width = dm.width = VW;
    cv.height = dm.height = VH;
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener("resize", resize);
  resize();

  function show(id) {
    ["splash", "creator", "lobby", "hud"].forEach((s) => $(s).classList.toggle("hide", s !== id));
    scene = id;
    W.MS_SCENE = id;
    document.body.className = id;
  }

  /* ---------- Splash & Menu ---------- */
  let ld = 0;
  const ldi = setInterval(() => {
    ld += rnd(18, 30);
    $("ldb").style.width = Math.min(100, ld) + "%";
    if (ld >= 100) clearInterval(ldi);
  }, 150);

  NET.authenticate().then((okAuth) => {
    $("ldw").classList.add("hide");
    $("sp2").classList.add("hide");
    if (okAuth) $("menu").classList.remove("hide");
  });

  $("mCreate").onclick = () => {
    audioOn();
    openSheet(`<h2>BUAT ROOM BARU</h2>
      <div class="lab">MODE PERMAINAN</div>
      <div class="rw">
        <button class="pb g" id="cClassic">CLASSIC (CEPU)</button>
        <button class="pb d" id="cQuick">QUICK HUNT</button>
        <button class="pb d" id="cChaos">CHAOS (BADUT)</button>
      </div>
      <button class="pb d" id="cBack">BATAL</button>`);
    $("cClassic").onclick = () => { closeSheet(); NET.createRoom("CLASSIC", true); };
    $("cQuick").onclick = () => { closeSheet(); NET.createRoom("QUICK", true); };
    $("cChaos").onclick = () => { closeSheet(); NET.createRoom("CHAOS", true); };
    $("cBack").onclick = closeSheet;
  };

  $("mJoin").onclick = async () => {
    audioOn();
    const rooms = await NET.fetchPublicRooms();
    const listHtml = rooms.length
      ? rooms.map((r) => `<div class="rrow"><span>#${r.code} · ${r.hostName} (${r.count}/${r.max})</span><button class="pb g" data-jc="${r.code}" style="padding:6px 8px;margin:0;font-size:7px">MASUK</button></div>`).join("")
      : '<div style="opacity:.6;margin:8px 0">Belum ada room publik aktif.</div>';

    openSheet(`<h2>GABUNG ROOM</h2>
      <div class="rw"><input class="ni" id="jCode" maxlength="6" placeholder="KODE ROOM" style="text-transform:uppercase"></div>
      <button class="pb g" id="jGo">GABUNG KODE</button>
      <div class="lab">ROOM PUBLIK TERBUKA</div>
      <div>${listHtml}</div>
      <button class="pb d" id="jBack">BATAL</button>`);

    $("jGo").onclick = () => { const c = $("jCode").value.trim(); if (c) { closeSheet(); NET.joinRoom(c); } };
    $("jBack").onclick = closeSheet;
    $("box").onclick = (e) => {
      const b = e.target.closest("button[data-jc]");
      if (b) { closeSheet(); NET.joinRoom(b.dataset.jc); }
    };
  };

  $("mAv").onclick = () => { audioOn(); openCreator("splash"); };
  $("mStat").onclick = () => {
    audioOn();
    openSheet(`<h2>STATISTIK KAMU</h2><div style="line-height:2;text-align:left;margin-bottom:8px">
      NAMA: ${getUN()}<br>KOIN: ${PG.coins} · XP: ${PG.xp}<br>MAIN: ${PG.games} · MENANG: ${PG.wins}<br>TUGAS SELESAI: ${PG.tasks}</div>
      <button class="pb g" id="skClose">TUTUP</button>`);
    $("skClose").onclick = closeSheet;
  };
  $("mSet").onclick = () => { audioOn(); openSettings(); };
  $("mHow").onclick = () => {
    audioOn();
    openSheet(`<h2>CARA MAIN</h2><div style="line-height:2;text-align:left;margin-bottom:8px">
      1. Warga menyamar jadi benda (NYAMAR) & kerjakan TUGAS.<br>
      2. Satpam mencari penyamar memakai senter & tombol SERANG.<br>
      3. Cepu menyabotase tugas & menipu saat Rapat Darurat.<br>
      4. Pintu darurat kanan terbuka saat kuota tugas selesai!</div>
      <button class="pb g" id="hwClose">MENGERTI</button>`);
    $("hwClose").onclick = closeSheet;
  };

  /* ---------- Avatar Creator ---------- */
  const TABS = ["Gaya", "Kulit", "Rambut", "Baju", "Bawah", "Aksesori"];
  let tab = 0, pdir = 0, creatorReturn = "splash";

  function openCreator(ret) {
    creatorReturn = ret;
    show("creator");
    drawCreatorOpts();
  }

  function drawCreatorOpts() {
    $("coin").textContent = "KOIN: " + PG.coins;
    $("tabs").innerHTML = TABS.map((t, i) => `<button class="tab${i === tab ? " on" : ""}" data-t="${i}">${t}</button>`).join("");
    const sw = (arr, k) => arr.map((c, i) => `<button class="sw${ME[k] === i ? " on" : ""}" style="background:${c}" data-k="${k}" data-v="${i}"></button>`).join("");
    const ch = (cat, k) => CAT[cat].map((n, i) => ok(n[1]) ? `<button class="chip${ME[k] === i ? " on" : ""}" data-k="${k}" data-v="${i}">${n[0]}${owned(cat, i) ? "" : " $" + LOCK[cat][i]}</button>` : "").join("");

    let h = "";
    if (tab === 0) h = `<button class="chip${ME.g === "f" ? " on" : ""}" data-g="f">♀ CEWE</button><button class="chip${ME.g === "m" ? " on" : ""}" data-g="m">♂ COWO</button><div class="lab">NAMA TAMPILAN</div><div class="rw"><input class="ni" id="cn" maxlength="10" value="${getUN()}"></div>`;
    if (tab === 1) h = `<div class="rw">${sw(SKIN, "skin")}</div>`;
    if (tab === 2) h = `<div class="rw">${ch("hair", "hair")}</div><div class="rw">${sw(HAIR, "hairC")}</div>`;
    if (tab === 3) h = `<div class="rw">${ch("shirt", "shirt")}</div><div class="rw">${sw(CLR, "shirtC")}</div>`;
    if (tab === 4) h = `<div class="rw">${ch("bot", "bot")}</div><div class="rw">${sw(CLR, "botC")}</div>`;
    if (tab === 5) h = `<div class="rw">${ch("acc", "acc")}</div>`;
    $("opts").innerHTML = h;
  }

  $("creator").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.t !== undefined) { tab = +b.dataset.t; drawCreatorOpts(); }
    else if (b.dataset.g) { Object.assign(ME, PRE[b.dataset.g]); ME.sp = {}; drawCreatorOpts(); }
    else if (b.dataset.k) {
      const k = b.dataset.k, v = +b.dataset.v, price = (LOCK[k] || {})[v];
      if (price && !owned(k, v)) {
        const res = await NET.saveCustomizationServer({ buyItemKey: `${k}:${v}`, price });
        if (!res || res.error) { toast("KOIN KURANG!", "b"); return; }
        PG.coins = res.user.coins;
        PG.unl = res.user.unlockedItems;
        toast("ITEM DIBELI!", "g");
      }
      ME[k] = v;
      ME.sp = {};
      drawCreatorOpts();
    }
  });

  $("rl").onclick = () => { pdir = (pdir + 3) % 4; };
  $("rr").onclick = () => { pdir = (pdir + 1) % 4; };
  $("rz").onclick = () => {
    ME.skin = Math.floor(R() * 6);
    ME.hairC = Math.floor(R() * 6);
    ME.shirtC = Math.floor(R() * 8);
    ME.botC = Math.floor(R() * 8);
    ME.sp = {};
  };
  $("ok").onclick = async () => {
    const inp = $("cn");
    const newName = inp ? inp.value.trim() : getUN();
    if (newName) setUN(newName);
    await NET.saveCustomizationServer({ displayName: getUN(), avatar: ME });
    show(creatorReturn);
  };

  /* ---------- Settings ---------- */
  function openSettings() {
    const chp = (key, arr) => arr.map((l, i) => `<button class="chip${CFG[key] === i ? " on" : ""}" data-s="${key}" data-v="${i}">${l}</button>`).join("");
    $("sb").innerHTML = `
      <div class="lab">GETAR</div><div class="rw">${chp("vib", ["MATI", "NYALA"])}</div>
      <div class="lab">EFEK SUARA</div><div class="rw">${chp("sfx", ["MATI", "PELAN", "SEDANG", "KERAS"])}</div>
      <div class="lab">MUSIK</div><div class="rw">${chp("mus", ["MATI", "PELAN", "SEDANG", "KERAS"])}</div>
      <div class="lab">KECERAHAN MAP</div><div class="rw">${chp("br", ["NORMAL", "TERANG", "SANGAT TERANG"])}</div>`;
    $("set").classList.remove("hide");
  }
  $("set").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b) return;
    CFG[b.dataset.s] = +b.dataset.v;
    MU.force = 1;
    saveCfg();
    openSettings();
  });
  $("sx").onclick = () => $("set").classList.add("hide");
  $("stg").onclick = openSettings;
  $("hs").onclick = openSettings;

  /* ---------- Lobby Multiplayer Handlers ---------- */
  function onRoomUpdated(room) {
    if (room.phase === "WAITING" && scene !== "creator") {
      show("lobby");
    }
    $("lCode").textContent = `ROOM #${room.code}`;
    $("lMode").textContent = `${room.mode} · ${room.members.length}/20 PEMAIN`;
    $("cnt").textContent = `${room.members.length}/20`;

    const isHost = room.hostTgId === NET.getMyTgId();
    $("hostBar").classList.toggle("hide", !isHost);
    $("bMode").textContent = `MODE: ${room.mode}`;

    const meMember = room.members.find((m) => m.tgId === NET.getMyTgId());
    if (meMember) {
      $("bReady").textContent = meMember.ready ? "BATAL SIAP" : "SIAP (READY)";
      $("bReady").className = meMember.ready ? "pb d" : "pb g";
    }
  }

  $("bLeave").onclick = () => { NET.leaveRoom(); show("splash"); };
  $("bReady").onclick = () => NET.toggleReady();
  $("ed").onclick = () => openCreator("lobby");
  $("bMode").onclick = () => {
    const r = NET.getRoom();
    if (!r) return;
    const order = ["CLASSIC", "QUICK", "CHAOS"];
    const next = order[(order.indexOf(r.mode) + 1) % order.length];
    NET.updateRoomSettings({ mode: next });
  };
  $("bBotFill").onclick = () => {
    fillBots = !fillBots;
    $("bBotFill").textContent = `BOT: ${fillBots ? "NYALA" : "MATI"}`;
  };
  $("go").onclick = () => NET.startMatch(fillBots);

  $("bShare").onclick = () => {
    const r = NET.getRoom();
    if (!r) return;
    const shareText = `Ayo mabar Midnight Shift di Room #${r.code}!`;
    if (tgw && tgw.openTelegramLink) {
      tgw.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(location.origin)}&text=${encodeURIComponent(shareText)}`);
    } else {
      navigator.clipboard && navigator.clipboard.writeText(r.code);
      toast(`KODE #${r.code} DISALIN!`, "g");
    }
  };

  $("bSendChat").onclick = () => {
    const inp = $("chatInp");
    if (inp && inp.value.trim()) {
      NET.sendChat(inp.value.trim());
      inp.value = "";
    }
  };
  $("bQChat").onclick = () => {
    const btns = QUICK_CHATS.map((q, i) => `<button class="chip" data-qi="${i}">${q}</button>`).join("");
    openSheet(`<h2>QUICK CHAT</h2><div class="opts">${btns}</div><button class="pb d" id="qcClose">TUTUP</button>`);
    $("qcClose").onclick = closeSheet;
    $("box").onclick = (e) => {
      const b = e.target.closest("button[data-qi]");
      if (b) { NET.sendChat("", +b.dataset.qi); closeSheet(); }
    };
  };

  $("lj").onclick = () => { if (LM.jy <= 0) { LM.vy = 95; LM.jy = 0.01; vib(8); } };
  $("e1").onclick = () => { LM.em = 1; LM.et = 0; };
  $("e2").onclick = () => { LM.em = 2; LM.et = 0; };
  $("e3").onclick = () => { LM.em = 3; LM.et = 0; };

  /* ---------- Match & HUD Handlers ---------- */
  function onMatchStarted(roleData) {
    closeSheet();
    show("hud");
    $("role").textContent = roleData.role;
    $("bDis").classList.toggle("hide", roleData.role === "SATPAM");
    toast(`PERAN KAMU: ${roleData.role} — ${roleData.roleInfo.desc}`);
    vib(25);
  }

  function onMeetingUpdate(m) {
    const rows = m.eligible.map((p) => `<div class="vr" data-vid="${p.id}"><span>${p.name}</span></div>`).join("");
    openSheet(`<h2>RAPAT DARURAT</h2>
      <div style="margin-bottom:6px">Dipanggil oleh ${m.callerName} (${m.votedCount}/${m.totalVoters} suara)</div>
      <div id="vList">${rows}</div>
      <button class="pb d" id="vSkip">LEWATI VOTE</button>`);
    $("vSkip").onclick = () => { NET.sendPlayerAction("VOTE", { targetId: "SKIP" }); toast("MEMILIH LEWATI"); };
    $("vList").onclick = (e) => {
      const r = e.target.closest(".vr[data-vid]");
      if (r) {
        NET.sendPlayerAction("VOTE", { targetId: r.dataset.vid });
        toast("SUARA TERKIRIM!");
      }
    };
  }

  function onMatchResult(res) {
    const rows = res.players.map((p) => `<div class="rrow"><span>${p.won ? "🏅" : "•"} ${p.name} (${p.role})</span><span>+${p.coins}🪙</span></div>`).join("");
    openSheet(`<h2>${res.winningTeam === "CIVILIAN" ? "WARGA MENANG!" : res.winningTeam === "BADUT" ? "BADUT MENANG!" : "SATPAM MENANG!"}</h2>
      <div style="margin-bottom:8px">${res.reason}</div>
      <div>${rows}</div>
      <div style="opacity:.7;margin-top:8px">Kembali ke lobi dalam 10 detik...</div>`);
  }

  $("bDis").onclick = () => NET.sendPlayerAction("DISGUISE");
  $("bSpr").onclick = () => NET.sendPlayerAction("SPRINT");
  $("bAct").onclick = () => {
    const snap = NET.getSnapshot();
    if (!snap) return;
    if (snap.you.team === "GUARD") {
      NET.sendPlayerAction("ATTACK");
      return;
    }
    const meEnt = snap.entities.find((e) => e.id === snap.you.id);
    if (!meEnt) return;

    // Cek terminal tugas terdekat
    const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - meEnt.x, t.z - meEnt.z) < 2.4);
    if (nearTerm) {
      openTaskModal(nearTerm, snap.you.role);
      return;
    }
    // Cek tombol rapat tengah
    if (Math.hypot(32 - meEnt.x, 22 - meEnt.z) < 2.4 && snap.graceLeft <= 0) {
      NET.sendPlayerAction("CALL_MEETING");
      return;
    }
    NET.sendPlayerAction("ABILITY");
  };

  /* ---------- Joystick & Keyboard ---------- */
  const st = $("stick");
  let sid = null;
  function moveStick(e) {
    const r = st.getBoundingClientRect();
    const dx2 = e.clientX - (r.left + r.width / 2);
    const dy2 = e.clientY - (r.top + r.height / 2);
    const m = r.width / 2 - 6, d = Math.hypot(dx2, dy2) || 1, f = Math.min(1, d / m);
    jx = (dx2 / d) * f;
    jy = (dy2 / d) * f;
    $("knob").style.transform = `translate(${jx * m}px,${jy * m}px)`;
  }
  st.addEventListener("pointerdown", (e) => { sid = e.pointerId; st.setPointerCapture(sid); moveStick(e); });
  st.addEventListener("pointermove", (e) => { if (e.pointerId === sid) moveStick(e); });
  const endStick = (e) => { if (e.pointerId === sid) { sid = null; jx = jy = 0; $("knob").style.transform = ""; } };
  st.addEventListener("pointerup", endStick);
  st.addEventListener("pointercancel", endStick);

  addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    const q = e.key.toLowerCase();
    if ("wasd".includes(q)) keys[q] = 1;
    if (q === "arrowup") keys.w = 1;
    if (q === "arrowdown") keys.s = 1;
    if (q === "arrowleft") keys.a = 1;
    if (q === "arrowright") keys.d = 1;
    if (q === " " || q === "e") $("bDis").click();
    if (q === "shift") $("bSpr").click();
    if (q === "f") $("bAct").click();
  });
  addEventListener("keyup", (e) => {
    const q = e.key.toLowerCase();
    delete keys[q];
    if (q === "arrowup") delete keys.w;
    if (q === "arrowdown") delete keys.s;
    if (q === "arrowleft") delete keys.a;
    if (q === "arrowright") delete keys.d;
  });

  /* ---------- Main Loop 60 FPS ---------- */
  const pcv = $("pv").getContext("2d");
  let last = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tclock += dt;

    if (scene === "splash" || scene === "creator") {
      drawSky(ctx, VW, VH, tclock);
      if (scene === "creator") {
        pcv.clearRect(0, 0, 20, 30);
        pcv.drawImage(spr(ME, pdir, [0, 1, 0, 2][Math.floor(tclock * 4) % 4]), 0, 0);
      }
      return;
    }

    const ix = cl(jx + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), -1, 1);
    const iy = cl(jy + (keys.s ? 1 : 0) - (keys.w ? 1 : 0), -1, 1);

    // Render Lobby Jalan Kota
    if (scene === "lobby") {
      if (Math.hypot(ix, iy) > 0.12) {
        LM.x = cl(LM.x + ix * 4.2 * dt, 1.5, 46.5);
        LM.z = cl(LM.z + iy * 4.2 * dt, 10.9, 29.3);
        LM.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 2 : 3) : iy > 0 ? 0 : 1;
        LM.mv = true;
      } else {
        LM.mv = false;
      }
      if (LM.jy > 0) { LM.vy -= 300 * dt; LM.jy = Math.max(0, LM.jy + LM.vy * dt); }
      if (LM.em) { LM.et += dt; if (LM.et > 2.2) LM.em = 0; }

      if (tclock - LM.lastSend > 0.08) {
        LM.lastSend = tclock;
        NET.sendLobbyMove(LM.x, LM.z, LM.dir, LM.em, LM.jy);
      }

      const camX = Math.round(cl(LM.x * T - VW / 2, 0, Math.max(0, LW - VW)));
      const camY = Math.round(cl(LM.z * T - VH / 2, 0, Math.max(0, LH - VH)));
      ctx.fillStyle = "#0b0716";
      ctx.fillRect(0, 0, VW, VH);
      ctx.drawImage(lc, -camX, -camY);

      const wf = Math.floor(tclock * 8) % 2 + 1;
      NET.lobbyPeers.forEach((p) => {
        p.x += (p.tx - p.x) * Math.min(1, dt * 10);
        p.z += (p.tz - p.z) * Math.min(1, dt * 10);
        drawAvatarLabel(ctx, p.avatar, p.x * T - camX, p.z * T - camY, p.dir, 0, p.name, "#fff", p.jy);
      });
      drawAvatarLabel(ctx, ME, LM.x * T - camX, LM.z * T - camY, LM.dir, LM.mv ? wf : 0, getUN(), "#ffd23f", LM.jy);
      return;
    }

    // Render Pertandingan Multiplayer (HUD)
    if (scene === "hud") {
      if (now - lastInputSent >= 50) {
        lastInputSent = now;
        const aim = Math.hypot(ix, iy) > 0.1 ? Math.atan2(iy, ix) : 0;
        NET.sendPlayerInput(++inputSeq, ix, iy, aim);
      }

      const snap = NET.getSnapshot();
      if (!snap) return;

      $("tm").textContent = fmt(snap.timeLeft);
      $("tl").textContent = `TUGAS ${snap.progress}/${snap.quota}`;
      $("tb").style.width = Math.min(100, (snap.progress / snap.quota) * 100) + "%";
      $("bDis").textContent = snap.you.disguised ? "BUKA" : "NYAMAR";
      $("bSpr").textContent = snap.you.sprintCd > 0 ? snap.you.sprintCd + "S" : "LARI";
      $("bAct").textContent = snap.you.team === "GUARD" ? "SERANG" : (snap.you.abilityCd > 0 ? snap.you.abilityCd + "S" : "AKSI");
      $("obj").textContent = snap.graceLeft > 0
        ? `SEMBUNYI! SATPAM KELUAR ${snap.graceLeft}D`
        : snap.gatesOpen
          ? "LARI KE PINTU DARURAT KANAN!"
          : `HP: ${snap.you.hp} · KERJAKAN TUGAS`;

      const meEnt = snap.entities.find((e) => e.id === snap.you.id) || { x: 10, z: 22 };
      const camX = Math.round(cl(meEnt.x * T - VW / 2, 0, MW * T - VW));
      const camY = Math.round(cl(meEnt.z * T - VH / 2, 0, MH * T - VH));

      ctx.fillStyle = "#0b0716";
      ctx.fillRect(0, 0, VW, VH);
      ctx.drawImage(wc, -camX, -camY);

      const drawList = [];
      (snap.props || []).forEach((pr) => {
        if (!pr.broken) drawList.push({ y: pr.z, f: () => drawPropSprite(ctx, pr.type, pr.x * T - camX, pr.z * T - camY) });
      });

      const wf = Math.floor(tclock * 8) % 2 + 1;
      (snap.entities || []).forEach((ent) => {
        drawList.push({
          y: ent.z,
          f: () => {
            const px = ent.x * T - camX, py = ent.z * T - camY;
            if (ent.isAnonProp || ent.disguised) {
              drawPropSprite(ctx, ent.propType || "cone", px, py);
              if (ent.id === snap.you.id) {
                ctx.fillStyle = "#ffd23f";
                ctx.fillRect(Math.round(px - 2), Math.round(py - 24), 4, 4);
              }
            } else {
              drawAvatarLabel(ctx, ent.avatar, px, py, ent.dir || 0, ent.moving ? wf : 0, ent.name, ent.team === "GUARD" ? "#ff5d6c" : "#fff");
            }
          }
        });
      });

      drawList.sort((a, b) => a.y - b.y);
      drawList.forEach((o) => o.f());

      // Efek gelap malam & jarak pandang
      const px2 = meEnt.x * T - camX, py2 = meEnt.z * T - camY - 6;
      dx.globalCompositeOperation = "source-over";
      dx.clearRect(0, 0, VW, VH);
      dx.fillStyle = `rgba(4,6,20,${[0.82, 0.65, 0.45][CFG.br]})`;
      dx.fillRect(0, 0, VW, VH);
      dx.globalCompositeOperation = "destination-out";
      dx.fillStyle = "rgba(0,0,0,0.85)";
      dx.beginPath();
      dx.arc(px2, py2, snap.you.team === "GUARD" ? 44 : 58, 0, Math.PI * 2);
      dx.fill();
      ctx.drawImage(dm, 0, 0);

      drawMinimap(snap);
    }
  }

  W.MS_APP = { onRoomUpdated, onMatchStarted, onMeetingUpdate, onMatchResult };
  requestAnimationFrame(loop);
})(window);
