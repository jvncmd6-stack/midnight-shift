(function (W) {
  "use strict";
  const { $, R, rnd, cl, vib, tgw, getUN, setUN, CFG, PG, ME, TABS, TAB_KEYS, SKIN, HAIR, CLR, CAT, PRE, LOCK, ok, owned, rav, saveCfg, toast, openSheet, closeSheet, T, MW, MH, QUICK_CHATS } = W.MS_CFG;
  const { spr } = W.MS_SPR;
  const { wc, lc, LW, LH, GL, BULBS, blocked, drawSky, drawAvatarLabel, drawPropSprite, drawMinimap, stepStreetTraffic, renderStreetLayer, renderStreetLights } = W.MS_WORLD;
  const { openTaskModal } = W.MS_TASKS;
  const NET = W.MS_NET;

  const cv = $("c"), ctx = cv.getContext("2d");
  const dm = document.createElement("canvas"), dx = dm.getContext("2d");
  let VW = 300, VH = 170, SC = 3, scene = "splash";
  let jx = 0, jy = 0, keys = {}, camX = 0, camY = 0, pdir = 0, tclock = 0, inputSeq = 0;
  let fillWithBots = true, currentTab = 0, cmsg = "";

  const LM = { x: 24, z: 12.6, vx: 0, vz: 0, wd: 0, dir: 0, jy: 0, vy: 0, em: 0, et: 0, mv: false };
  const cam = { x: 0, y: 0, on: 0 };

  function resize() {
    const pt = innerHeight > innerWidth;
    SC = pt ? Math.max(2, Math.round(innerWidth / 140)) : Math.max(2, Math.min(Math.round(innerWidth / 300), Math.round(innerHeight / 150)));
    VW = Math.ceil(innerWidth / SC);
    VH = Math.ceil(innerHeight / SC);
    cv.width = dm.width = VW;
    cv.height = dm.height = VH;
    ctx.imageSmoothingEnabled = false;
    cam.on = 0;
  }
  addEventListener("resize", resize);
  resize();

  function show(id) {
    ["splash", "creator", "lobby", "hud"].forEach((s) => $(s).classList.toggle("hide", s !== id));
    scene = id;
    document.body.className = id;
    cam.on = 0;
  }

  /* ---------- Splash & Auth ---------- */
  $("who").textContent = tgw ? `Masuk sebagai ${getUN()}` : `Halo, ${getUN()}`;
  let ld = 0;
  const ldi = setInterval(() => {
    ld = Math.min(90, ld + rnd(12, 25));
    $("ldb").style.width = ld + "%";
  }, 150);

  NET.authenticate().then((okAuth) => {
    clearInterval(ldi);
    $("ldb").style.width = "100%";
    if (okAuth) {
      setTimeout(() => {
        $("ldw").classList.add("hide");
        $("sp2").classList.add("hide");
        $("menu").classList.remove("hide");
      }, 200);
    }
  });

  $("mCreate").onclick = () => { NET.createRoom("CLASSIC", true); vib(10); };

  $("mJoin").onclick = async () => {
    openSheet("<h2>GABUNG ROOM</h2><p>Memuat daftar room...</p>");
    const rooms = await NET.fetchPublicRooms();
    const listHtml = rooms.length
      ? rooms.map((r) => `<div class="vr" data-code="${r.code}" style="justify-content:space-between"><span><b>#${r.code}</b> · ${r.hostName}</span><span style="color:var(--gr)">${r.count}/${r.max}</span></div>`).join("")
      : `<div style="opacity:.6;margin:8px 0">Belum ada room publik. Masukkan kode di bawah:</div>`;

    openSheet(
      `<h2>GABUNG ROOM</h2>${listHtml}` +
      `<div class="lab">KODE ROOM PRIBADI / GRUP</div>` +
      `<div class="rw"><input class="ni" id="inpCode" maxlength="6" placeholder="KODE" style="text-transform:uppercase"></div>` +
      `<button class="pb g" id="bJoinGo">MASUK</button><button class="pb d" id="bJoinClose">BATAL</button>`
    );

    document.querySelectorAll("#box .vr[data-code]").forEach((el) => {
      el.onclick = () => { closeSheet(); NET.joinRoom(el.dataset.code); };
    });
    $("bJoinGo").onclick = () => {
      const c = ($("inpCode").value || "").toUpperCase().trim();
      if (c.length >= 4) { closeSheet(); NET.joinRoom(c); }
    };
    $("bJoinClose").onclick = closeSheet;
  };

  $("mAv").onclick = () => { pdir = 0; show("creator"); drawOpts(); vib(10); };
  $("mStat").onclick = () => {
    openSheet(
      `<h2>STATISTIK</h2><div style="line-height:2;text-align:left">` +
      `KOIN: ${PG.coins}<br>LEVEL: ${Math.floor(PG.xp / 100) + 1} (${PG.xp} XP)<br>` +
      `MAIN: ${PG.games} · MENANG: ${PG.wins}<br>TUGAS SELESAI: ${PG.tasks}</div>` +
      `<button class="pb g" id="sk2">OKE</button>`
    );
    $("sk2").onclick = closeSheet;
  };
  $("mSet").onclick = () => openSet();
  $("mHow").onclick = () => {
    openSheet(
      `<h2>CARA MAIN</h2><div style="line-height:1.9;text-align:left;margin-bottom:8px">` +
      `1. Sembunyi & tekan NYAMAR jadi benda<br>2. Selesaikan 6 tugas di ruangan<br>` +
      `3. Waspada CEPU yang menyabotase tugas<br>4. Tekan tombol merah di tengah untuk RAPAT<br>` +
      `5. Lari ke PINTU DARURAT kanan saat alarm!</div><button class="pb g" id="hk">OKE</button>`
    );
    $("hk").onclick = closeSheet;
  };

  /* ---------- Avatar Creator ---------- */
  function sw(arr, key) {
    return arr.map((c, i) => `<button class="sw${ME[key] === i ? " on" : ""}" style="background:${c}" data-k="${key}" data-v="${i}"></button>`).join("");
  }
  function ch(cat, key) {
    return CAT[cat].map((n, i) => ok(n[1]) ? `<button class="chip${ME[key] === i ? " on" : ""}" data-k="${key}" data-v="${i}">${n[0]}${owned(cat, i) ? "" : " $" + LOCK[cat][i]}</button>` : "").join("");
  }
  function drawOpts() {
    $("coin").textContent = `KOIN: ${PG.coins}${cmsg ? " · " + cmsg : ""}`;
    cmsg = "";
    $("tabs").innerHTML = TABS.map((t, i) => `<button class="tab${i === currentTab ? " on" : ""}" data-t="${i}">${t}</button>`).join("");
    let h = "";
    if (currentTab === 0) {
      h = `<button class="chip${ME.g === "f" ? " on" : ""}" data-g="f">♀ CEWE</button>` +
          `<button class="chip${ME.g === "m" ? " on" : ""}" data-g="m">♂ COWO</button>` +
          `<div class="lab">NAMA KARAKTER</div><div class="rw"><input class="ni" id="cn" maxlength="12" value="${getUN()}"></div>`;
    } else if (currentTab === 1) h = `<div class="lab">WARNA KULIT</div><div class="rw">${sw(SKIN, "skin")}</div>`;
    else if (currentTab === 2) h = `<div class="lab">RAMBUT</div><div class="rw">${ch("hair", "hair")}</div><div class="lab">WARNA</div><div class="rw">${sw(HAIR, "hairC")}</div>`;
    else if (currentTab === 3) h = `<div class="lab">BAJU</div><div class="rw">${ch("shirt", "shirt")}</div><div class="lab">WARNA</div><div class="rw">${sw(CLR, "shirtC")}</div>`;
    else if (currentTab === 4) h = `<div class="lab">BAWAHAN</div><div class="rw">${ch("bot", "bot")}</div><div class="lab">WARNA</div><div class="rw">${sw(CLR, "botC")}</div>`;
    else if (currentTab === 5) h = `<div class="lab">AKSESORI</div><div class="rw">${ch("acc", "acc")}</div>`;
    $("opts").innerHTML = h;
    if ($("cn")) $("cn").oninput = (e) => setUN(e.target.value);
  }

  $("creator").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.t !== undefined) { currentTab = +b.dataset.t; drawOpts(); }
    else if (b.dataset.g) { Object.assign(ME, PRE[b.dataset.g]); ME.sp = {}; drawOpts(); }
    else if (b.dataset.k) {
      const kk = b.dataset.k, vv = +b.dataset.v, lp = (LOCK[kk] || {})[vv];
      if (lp && !owned(kk, vv)) {
        const res = await NET.saveCustomizationServer({ buyItemKey: `${kk}:${vv}`, price: lp });
        if (res && res.user) { PG.coins = res.user.coins; PG.unl = res.user.unlockedItems; cmsg = `DIBELI -${lp}`; }
        else { cmsg = "KOIN KURANG"; drawOpts(); return; }
      }
      ME[kk] = vv; ME.sp = {}; saveCfg(); drawOpts();
    }
  });

  const dirOrder = [0, 2, 1, 3];
  $("rr").onclick = () => { pdir = dirOrder[(dirOrder.indexOf(pdir) + 1) % 4]; };
  $("rl").onclick = () => { pdir = dirOrder[(dirOrder.indexOf(pdir) + 3) % 4]; };
  $("rz").onclick = () => { const b = rav(); Object.assign(ME, b); TAB_KEYS.forEach((c) => { if (!owned(c, ME[c])) ME[c] = 0; }); ME.sp = {}; drawOpts(); };
  $("ok").onclick = async () => {
    saveCfg();
    const { sp, ...cleanAv } = ME;
    await NET.saveCustomizationServer({ displayName: getUN(), avatar: cleanAv });
    if (NET.getRoom()) show("lobby"); else show("splash");
  };

  /* ---------- Lobi Multiplayer & Tombol Undang ---------- */
  function onRoomUpdated(room) {
    if (scene !== "lobby") show("lobby");
    $("lCode").textContent = `ROOM #${room.code}`;
    $("lMode").textContent = `${room.mode} · ${room.phase}`;
    $("cnt").textContent = `${room.members.length}/20`;
    const isHost = room.hostTgId === NET.getMyTgId();
    $("hostBar").classList.toggle("hide", !isHost);
    $("bMode").textContent = `MODE: ${room.mode}`;
  }

  $("bShare").onclick = () => {
    const r = NET.getRoom();
    if (!r) return;
    const shareText = `🔦 Yuk mabar Midnight Shift! Kode Room: ${r.code} (atau ketik /join ${r.code} di bot)`;
    openSheet(
      `<h2>UNDANG TEMAN</h2>` +
      `<p>Bagikan kode room ini ke teman atau grup Telegram:</p>` +
      `<div class="seq" style="font-size:20px;margin:12px 0">#${r.code}</div>` +
      `<button class="pb g" id="bTgShare">KIRIM KE GRUP TELEGRAM</button>` +
      `<button class="pb" id="bCopyCode">SALIN KODE</button>` +
      `<button class="pb d" id="bCloseShare">TUTUP</button>`
    );

    $("bTgShare").onclick = () => {
      const url = `https://t.me/share/url?url=${encodeURIComponent(location.origin)}&text=${encodeURIComponent(shareText)}`;
      if (tgw && tgw.openTelegramLink) tgw.openTelegramLink(url);
      else window.open(url, "_blank");
    };
    $("bCopyCode").onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(r.code).catch(() => {});
      toast(`KODE #${r.code} DISALIN!`, "g");
    };
    $("bCloseShare").onclick = closeSheet;
  };

  $("bLeave").onclick = () => { NET.leaveRoom(); show("splash"); };
  $("bReady").onclick = () => NET.toggleReady();
  $("ed").onclick = () => { show("creator"); drawOpts(); };
  $("stg").onclick = () => openSet();
  $("hs").onclick = () => openSet();
  $("bMode").onclick = () => {
    const r = NET.getRoom();
    if (!r) return;
    const modes = ["CLASSIC", "QUICK", "CHAOS"];
    NET.updateRoomSettings({ mode: modes[(modes.indexOf(r.mode) + 1) % modes.length] });
  };
  $("bBotFill").onclick = () => { fillWithBots = !fillWithBots; $("bBotFill").textContent = `BOT: ${fillWithBots ? "NYALA" : "MATI"}`; };
  $("go").onclick = () => NET.startMatch(fillWithBots);

  $("bSendChat").onclick = () => {
    const inp = $("chatInp");
    if (inp.value.trim()) { NET.sendChat(inp.value.trim()); inp.value = ""; }
  };
  $("bQChat").onclick = () => {
    const btns = QUICK_CHATS.map((q, i) => `<button class="chip" data-qi="${i}">${q}</button>`).join("");
    openSheet(`<h2>QUICK CHAT</h2><div class="opts">${btns}</div><button class="pb d" id="qcX">TUTUP</button>`);
    document.querySelectorAll("#box .chip[data-qi]").forEach((b) => {
      b.onclick = () => { NET.sendChat("", +b.dataset.qi); closeSheet(); };
    });
    $("qcX").onclick = closeSheet;
  };

  $("lj").onclick = () => { if (LM.jy <= 0) { LM.vy = 95; LM.jy = 0.01; } };
  $("e1").onclick = () => { LM.em = 1; LM.et = 0; };
  $("e2").onclick = () => { LM.em = 2; LM.et = 0; };
  $("e3").onclick = () => { LM.em = 3; LM.et = 0; };

  /* ---------- Match Events & HUD ---------- */
  function onMatchStarted(info) {
    closeSheet();
    show("hud");
    $("role").textContent = info.roleName.toUpperCase();
    $("bDis").classList.toggle("hide", info.team === "GUARD");
    toast(`PERAN KAMU: ${info.roleName.toUpperCase()}`, info.team === "GUARD" ? "b" : "g");
  }

  function onMeetingUpdate(m) {
    if (!m.active) return;
    const rows = m.candidates.map((c) => `<div class="vr" data-vid="${c.id}"><span>${c.name}</span></div>`).join("");
    openSheet(`<h2>RAPAT DARURAT (${m.timeLeft}D)</h2><p>${m.callerName} memanggil rapat! Pilih tersangka:</p><div id="vl">${rows}</div><button class="pb d" id="vSkip">LEWATI VOTE</button>`);
    document.querySelectorAll("#vl .vr").forEach((el) => {
      el.onclick = () => { NET.sendPlayerAction("VOTE", { targetId: el.dataset.vid }); toast("SUARA DIKIRIM", "g"); };
    });
    $("vSkip").onclick = () => { NET.sendPlayerAction("VOTE", { targetId: "SKIP" }); toast("MEMILIH LEWATI", "i"); };
  }

  function onMatchResult(res) {
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
    $("bBackLobby").onclick = () => { closeSheet(); show("lobby"); };
  }

  $("bDis").onclick = () => NET.sendPlayerAction("DISGUISE");
  $("bSpr").onclick = () => NET.sendPlayerAction("SPRINT");
  $("bAct").onclick = () => {
    const snap = NET.getSnapshot();
    if (!snap) return;
    const me = snap.you;
    if (me.team === "GUARD") { NET.sendPlayerAction("ATTACK"); return; }

    const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - me.x, t.z - me.z) < 2.2);
    if (nearTerm) {
      if (me.team === "TRAITOR") NET.sendPlayerAction("SABOTAGE", { termIdx: nearTerm.idx });
      else openTaskModal(nearTerm.k, me.role === "TECHNICIAN", () => NET.sendPlayerAction("TASK_DONE", { termIdx: nearTerm.idx }));
      return;
    }
    if (Math.hypot(32 - me.x, 22 - me.z) < 2.4) { NET.sendPlayerAction("MEETING"); return; }
    NET.sendPlayerAction("ABILITY");
  };

  /* ---------- Joystick & Keyboard ---------- */
  const st = $("stick");
  let sid = null;
  function moveStick(e) {
    const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx2 = e.clientX - cx, dy = e.clientY - cy, m = r.width / 2 - 6, d = Math.hypot(dx2, dy) || 1, f = Math.min(1, d / m);
    jx = (dx2 / d) * f; jy = (dy / d) * f;
    $("knob").style.transform = `translate(${jx * m}px,${jy * m}px)`;
  }
  st.addEventListener("pointerdown", (e) => { sid = e.pointerId; st.setPointerCapture(sid); moveStick(e); });
  st.addEventListener("pointermove", (e) => { if (e.pointerId === sid) moveStick(e); });
  const endStick = (e) => { if (e.pointerId === sid) { sid = null; jx = jy = 0; $("knob").style.transform = ""; } };
  st.addEventListener("pointerup", endStick);
  st.addEventListener("pointercancel", endStick);

  const AR = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
  addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    const q = e.key.toLowerCase();
    if ("wasd".includes(q)) keys[q] = 1;
    if (AR[q]) keys[AR[q]] = 1;
    if (q === " " && scene === "lobby") $("lj").click();
    if (q === "e" && scene === "hud") $("bDis").click();
    if (q === "f" && scene === "hud") $("bAct").click();
  });
  addEventListener("keyup", (e) => { const q = e.key.toLowerCase(); delete keys[q]; if (AR[q]) delete keys[AR[q]]; });

const LV = ["MATI", "PELAN", "SEDANG", "KERAS"];
  const SGN = ["OTOMATIS", "MIDNIGHT CITY", "SEMBUNYI", "LOBI SANTAI", "KEJAR-KEJARAN"];

  function openSet() {
    W.MS_AUDIO.audioOn();
    const chp = (key, arr) =>
      arr.map((l, i) => `<button class="chip${CFG[key] === i ? " on" : ""}" data-s="${key}" data-v="${i}">${l}</button>`).join("");
    const sec = (l, x) => `<div class="lab">${l}</div><div class="rw">${x}</div>`;

    $("sb").innerHTML =
      sec("NAMA KARAKTER", `<input class="ni" id="setNm" maxlength="12" value="${getUN()}">`) +
      sec("GETAR", chp("vib", ["MATI", "NYALA"])) +
      sec("EFEK SUARA", chp("sfx", LV)) +
      sec("VOLUME MUSIK", chp("mus", LV)) +
      sec("PILIHAN LAGU", chp("song", SGN)) +
      sec("KECERAHAN MAP", chp("br", ["NORMAL", "TERANG", "SANGAT TERANG"])) +
      `<div class="kh" style="margin:8px 0">OTOMATIS: LOBI SANTAI, SEMBUNYI SAAT MAIN, KEJAR-KEJARAN SAAT SATPAM DEKAT</div>` +
      `<button class="pb d" id="sr">RESET PENGATURAN</button>`;

    $("set").classList.remove("hide");

    $("setNm").oninput = (e) => {
      setUN(e.target.value);
      $("who").textContent = tgw ? `Masuk sebagai ${getUN()}` : `Halo, ${getUN()}`;
    };

    document.querySelectorAll("#sb .chip[data-s]").forEach((b) => {
      b.onclick = () => {
        CFG[b.dataset.s] = +b.dataset.v;
        W.MS_AUDIO.applyAudioCfg();
        if (b.dataset.s === "vib") vib(60);
        if (b.dataset.s === "song" || b.dataset.s === "mus") W.MS_AUDIO.MU.force = 1;
        openSet();
      };
    });

    $("sr").onclick = () => {
      Object.assign(CFG, { vib: 1, sfx: 2, mus: 2, song: 0, br: 0 });
      W.MS_AUDIO.MU.force = 1;
      W.MS_AUDIO.applyAudioCfg();
      openSet();
    };
  }
  $("sx").onclick = () => {
    $("set").classList.add("hide");
    if ($("cn")) $("cn").value = getUN();
  };

  /* ---------- Main Loop ---------- */
  let last = performance.now(), netSendAcc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tclock += dt;

    if (scene === "splash" || scene === "creator") {
      drawSky(ctx, VW, VH, tclock);
      if (scene === "creator") {
        const pcv = $("pv").getContext("2d");
        pcv.clearRect(0, 0, 20, 30);
        pcv.drawImage(spr(ME, pdir, [0, 1, 0, 2][Math.floor(tclock * 4) % 4]), 0, 0);
      }
      return;
    }

    const ix = cl(jx + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), -1, 1);
    const iy = cl(jy + (keys.s ? 1 : 0) - (keys.w ? 1 : 0), -1, 1);

    if (scene === "lobby") {
      stepStreetTraffic(dt);
      const l = Math.hypot(ix, iy);
      LM.mv = l > 0.15;
      if (LM.mv) {
        LM.x = cl(LM.x + (ix / l) * 4.2 * dt, 1.5, 46.5);
        LM.z = cl(LM.z + (iy / l) * 4.2 * dt, 10.9, 29.3);
        LM.wd += 4.2 * dt;
        LM.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 2 : 3) : (iy > 0 ? 0 : 1);
      }
      if (LM.jy > 0) { LM.vy -= 300 * dt; LM.jy = Math.max(0, LM.jy + LM.vy * dt); }
      if (LM.em) { LM.et += dt; if (LM.et > 2.2) LM.em = 0; }

      netSendAcc += dt;
      if (netSendAcc >= 0.06) {
        netSendAcc = 0;
        NET.sendLobbyMove(LM.x, LM.z, LM.dir, LM.em, LM.jy);
      }
      renderWorld(false, LM.x, LM.z, dt);
    } else if (scene === "hud") {
      netSendAcc += dt;
      if (netSendAcc >= 0.05) {
        netSendAcc = 0;
        NET.sendPlayerInput(++inputSeq, ix, iy, Math.atan2(iy, ix));
      }
      const snap = NET.getSnapshot();
      if (snap && snap.you) {
        updateHud(snap);
        renderWorld(true, snap.you.x, snap.you.z, dt, snap);
      }
    }
  }

  function updateHud(snap) {
    const m = Math.max(0, Math.ceil(snap.timeLeft));
    $("tm").textContent = `${Math.floor(m / 60)}:${("0" + (m % 60)).slice(-2)}`;
    $("tl").textContent = `TUGAS ${snap.prog}/${snap.need}${snap.gatesOpen ? " · EXIT!" : ""}`;
    $("tb").style.width = `${Math.min(100, (snap.prog / snap.need) * 100)}%`;

    const me = snap.you;
    $("bDis").textContent = me.disguised ? "BUKA" : "NYAMAR";
    $("bSpr").classList.toggle("off", me.sprintCd > 0);
    $("bSpr").textContent = me.sprintCd > 0 ? `${Math.ceil(me.sprintCd)}S` : "LARI";

    if (me.team === "GUARD") {
      $("bAct").textContent = "PUKUL";
      $("bAct").classList.toggle("off", me.stun > 0);
    } else {
      const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - me.x, t.z - me.z) < 2.2);
      const nearBtn = Math.hypot(32 - me.x, 22 - me.z) < 2.4;
      $("bAct").textContent = nearTerm ? (me.team === "TRAITOR" ? "SABOTASE" : "TUGAS") : nearBtn ? "RAPAT" : "SKILL";
      $("bAct").classList.toggle("off", !nearTerm && !nearBtn && me.abCd > 0);
    }
    drawMinimap(snap);
  }

  function renderWorld(isGame, fx, fz, dt, snap = null) {
    const mw = isGame ? MW * T : LW, mh = isGame ? MH * T : LH;
    const ctx_ = mw <= VW ? (mw - VW) / 2 : cl(fx * T - VW / 2, 0, mw - VW);
    const cty_ = mh <= VH ? (mh - VH) / 2 : cl(fz * T - VH / 2, 0, mh - VH);
    if (!cam.on) { cam.x = ctx_; cam.y = cty_; cam.on = 1; }
    else { cam.x += (ctx_ - cam.x) * (1 - Math.exp(-dt * 10)); cam.y += (cty_ - cam.y) * (1 - Math.exp(-dt * 10)); }
    camX = Math.round(cam.x); camY = Math.round(cam.y);

    ctx.fillStyle = "#0b0716";
    ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(isGame ? wc : lc, -camX, -camY);

    const drawList = [];
    if (!isGame) {
      renderStreetLayer(ctx, camX, camY, VW, VH, tclock, drawList);
      NET.lobbyPeers.forEach((p) => {
        p.x += (p.tx - p.x) * 0.25;
        p.z += (p.tz - p.z) * 0.25;
        drawList.push({ y: p.z, f: () => drawAvatarLabel(ctx, p.avatar, p.x * T - camX, p.z * T - camY, p.dir, 0, p.name, "#fff", p.jy) });
      });
      const fr = LM.mv ? [1, 0, 2, 0][Math.floor(LM.wd * 2.2) % 4] : 0;
      drawList.push({ y: LM.z, f: () => drawAvatarLabel(ctx, ME, LM.x * T - camX, LM.z * T - camY, LM.dir, fr, getUN(), "#ffd23f", LM.jy) });
    } else if (snap) {
      const wf = (Math.floor(tclock * 8) % 2) + 1;
      (snap.props || []).forEach((p) => drawList.push({ y: p.z, f: () => drawPropSprite(ctx, p.type, p.x * T - camX, p.z * T - camY) }));
      (snap.entities || []).forEach((e) => {
        if (e.dead) return;
        drawList.push({
          y: e.z,
          f: () => {
            const px = e.x * T - camX, py = e.z * T - camY;
            if (e.disguised && e.propType) drawPropSprite(ctx, e.propType, px, py);
            else drawAvatarLabel(ctx, e.avatar || ME, px, py, e.dir || 0, wf, e.name, e.team === "GUARD" ? "#ff5d6c" : "#fff");
          }
        });
      });

      // Terminal & Tombol Rapat Merah
      (snap.terminals || []).forEach((t) => {
        drawList.push({
          y: t.z,
          f: () => {
            const px = Math.round(t.x * T - camX), py = Math.round(t.z * T - camY);
            ctx.fillStyle = "#1d2430"; ctx.fillRect(px - 6, py - 16, 12, 16);
            ctx.fillStyle = t.done ? "#5ee38b" : Math.sin(tclock * 6) > 0 ? "#ffd23f" : "#5cc8ff";
            ctx.fillRect(px - 4, py - 13, 8, 6);
          }
        });
      });

      drawList.push({
        y: 22,
        f: () => {
          const px = Math.round(32 * T - camX), py = Math.round(22 * T - camY);
          ctx.fillStyle = "#6b1a22"; ctx.fillRect(px - 9, py - 4, 18, 8);
          ctx.fillStyle = Math.sin(tclock * 5) > 0 ? "#ff5d6c" : "#c23846"; ctx.fillRect(px - 6, py - 8, 12, 8);
        }
      });

      [12.5, 31.5].forEach((z) => {
        drawList.push({
          y: z,
          f: () => {
            const px = Math.round(62.5 * T - camX), py = Math.round(z * T - camY);
            ctx.fillStyle = "#222"; ctx.fillRect(px - 10, py - 24, 4, 48);
            ctx.fillStyle = snap.gatesOpen ? "#5ee38b" : "#ff5d6c"; ctx.fillRect(px - 6, py - 20, 3, 40);
          }
        });
      });
    }

    drawList.sort((a, b) => a.y - b.y);
    drawList.forEach((o) => o.f());

    if (!isGame) {
      renderStreetLights(ctx, camX, camY, VW, VH, tclock);
    } else if (snap && snap.you) {
      // Lampu hias aula & kegelapan dengan lubang pandang pemain
      BULBS.forEach((b) => {
        const bx = b[0] - camX, by = b[1] - camY;
        if (bx >= 0 && bx <= VW && by >= 0 && by <= VH) {
          ctx.fillStyle = b[2]; ctx.fillRect(bx, by, 2, 2);
        }
      });

      const px2 = snap.you.x * T - camX, py2 = snap.you.z * T - camY - 6;
      dx.globalCompositeOperation = "source-over";
      dx.clearRect(0, 0, VW, VH);
      dx.fillStyle = `rgba(4,6,20,${[0.84, 0.68, 0.50][CFG.br]})`;
      dx.fillRect(0, 0, VW, VH);
      dx.globalCompositeOperation = "destination-out";
      [62, 46, 30].forEach((r, idx) => {
        dx.fillStyle = `rgba(0,0,0,${0.25 + idx * 0.25})`;
        dx.beginPath(); dx.arc(px2, py2, r, 0, 6.3); dx.fill();
      });
      ctx.drawImage(dm, 0, 0);
    }
  }

  W.MS_APP = { onRoomUpdated, onMatchStarted, onMeetingUpdate, onMatchResult };
  requestAnimationFrame(loop);
})(window);
