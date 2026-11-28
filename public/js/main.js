(function (W) {
  "use strict";
  const { $, rnd, cl, vib, tgw, getUN, CFG, ME, T, MW, MH, toast, closeSheet } = W.MS_CFG;
  const { wc, lc, LW, LH, BULBS, blocked, lobbyBlocked, drawSky, stepStreetTraffic, renderStreetLayer, renderStreetLights } = W.MS_WORLD;
  const { openTaskModal } = W.MS_TASKS;
  const { audioOn, MU } = W.MS_AUDIO;
  const NET = W.MS_NET;

  [
    "/js/emotePro.js?v=5",
    "/js/propArt.js?v=5",
    "/js/hudMeeting.js?v=5",
    "/js/lobbyUi.js?v=5",
    "/js/escapeFx.js?v=5",
    "/js/roleFx.js?v=5"
  ].forEach((src) => {
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script");
      s.src = src;
      document.head.appendChild(s);
    }
  });

  const cv = $("c"), ctx = cv.getContext("2d");
  let VW = 300, VH = 170, SC = 3, scene = "splash";
  let jx = 0, jy = 0, keys = {}, camX = 0, camY = 0, pdir = 0, tclock = 0, inputSeq = 0;

  const LM = { x: 24, z: 12.6, vx: 0, vz: 0, wd: 0, dir: 0, jy: 0, vy: 0, em: 0, et: 0, mv: false };
  const PRED = { ready: false, x: 0, z: 0, dir: 0, mv: false, wd: 0 };
  const cam = { x: 0, y: 0, on: 0 };
  const ENT_SMOOTH = new Map();

  // Cache label nama agar tidak memanggil strokeText setiap frame
  const NAME_CACHE = new Map();
  function getNameCanvas(name, color) {
    const txt = String(name || "").slice(0, 10);
    const key = `${txt}_${color}`;
    let c = NAME_CACHE.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = 76;
      c.height = 12;
      const x = c.getContext("2d");
      x.font = '5px "Press Start 2P",monospace';
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.lineWidth = 2;
      x.strokeStyle = "#0b0716";
      x.strokeText(txt, 38, 6);
      x.fillStyle = color;
      x.fillText(txt, 38, 6);
      if (NAME_CACHE.size > 80) NAME_CACHE.clear();
      NAME_CACHE.set(key, c);
    }
    return c;
  }

  function drawAvatarFast(ctx2, avatar, px, py, dir, fr, name, color, jy = 0, em = 0) {
    if (W.MS_EMOTE_PRO && W.MS_EMOTE_PRO.drawAvatarLabelPro) {
      W.MS_EMOTE_PRO.drawAvatarLabelPro(ctx2, avatar, px, py, dir, fr, "", color, jy, em);
    } else {
      W.MS_WORLD.drawAvatarLabel(ctx2, avatar, px, py, dir, fr, "", color, jy, em);
    }
    if (name) {
      const nc = getNameCanvas(name, color);
      ctx2.drawImage(nc, Math.round(px) - 38, Math.round(py) - 44 - Math.round(jy));
    }
  }

  // Cache masker cahaya senter
  const LIGHT_MASK_CACHE = new Map();
  function getLightMask(rad, darkAlpha) {
    const key = `${rad}_${darkAlpha}`;
    let m = LIGHT_MASK_CACHE.get(key);
    if (!m) {
      const size = rad * 2 + 4;
      m = document.createElement("canvas");
      m.width = size;
      m.height = size;
      const mx = m.getContext("2d");
      const cx = size >> 1;
      const grad = mx.createRadialGradient(cx, cx, rad * 0.36, cx, cx, rad);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.68, `rgba(4,6,20,${darkAlpha * 0.45})`);
      grad.addColorStop(1, `rgba(4,6,20,${darkAlpha})`);
      mx.fillStyle = grad;
      mx.fillRect(0, 0, size, size);
      LIGHT_MASK_CACHE.set(key, m);
    }
    return m;
  }

  addEventListener("pointerdown", audioOn);
  addEventListener("keydown", audioOn);

  function resize() {
    const pt = innerHeight > innerWidth;
    SC = pt ? Math.max(2, Math.round(innerWidth / 150)) : Math.max(2, Math.min(Math.round(innerWidth / 300), Math.round(innerHeight / 150)));
    VW = Math.ceil(innerWidth / SC);
    VH = Math.ceil(innerHeight / SC);
    cv.width = VW;
    cv.height = VH;
    ctx.imageSmoothingEnabled = false;
    cam.on = 0;
  }
  addEventListener("resize", resize);
  resize();

  function show(id) {
    closeSheet();
    const sh = $("sheet");
    if (sh) { sh.classList.remove("on"); sh.classList.add("hide"); }
    ["splash", "creator", "lobby", "hud"].forEach((s) => $(s).classList.toggle("hide", s !== id));
    scene = id;
    document.body.className = id;
    cam.on = 0;
    PRED.ready = false;
    ENT_SMOOTH.clear();
    MU.mode = id;
    MU.force = 1;
    if (id !== "hud" && W.MS_ESCAPE_FX) W.MS_ESCAPE_FX.ensureControls(false);
  }

  /* ---------- Splash & Auth ---------- */
  $("who").textContent = tgw ? `Masuk sebagai ${getUN()}` : `Halo, ${getUN()}`;
  function runSplashAuth() {
    const ldw = $("ldw"), ldb = $("ldb"), sp2 = $("sp2"), menu = $("menu");
    if (ldw) ldw.style.display = "block";
    if (ldb) ldb.style.width = "12%";
    if (sp2) {
      sp2.classList.remove("hide");
      sp2.style.display = "block";
      sp2.textContent = "MENGHUBUNGKAN...";
      sp2.onclick = null;
    }
    if (menu) menu.classList.add("hide");

    let ld = 12;
    const ldi = setInterval(() => {
      ld = Math.min(92, ld + rnd(10, 22));
      if (ldb) ldb.style.width = ld + "%";
    }, 140);

    NET.authenticate().then((okAuth) => {
      clearInterval(ldi);
      if (ldb) ldb.style.width = "100%";
      if (okAuth) {
        setTimeout(() => {
          if (ldw) ldw.style.display = "none";
          if (sp2) sp2.classList.add("hide");
          if (menu) menu.classList.remove("hide");
        }, 180);
      } else if (sp2) {
        sp2.textContent = "GAGAL TERHUBUNG · TAP COBA LAGI";
        sp2.style.cursor = "pointer";
        sp2.onclick = runSplashAuth;
      }
    });
  }
  runSplashAuth();

  function initSubModules() {
    if (W.MS_LOBBY_UI) W.MS_LOBBY_UI.bindUi(NET, show, () => pdir, (d) => { pdir = d; });
    else setTimeout(initSubModules, 50);
  }
  initSubModules();

  $("lj").onclick = () => { if (LM.jy <= 0) { LM.vy = 95; LM.jy = 0.01; vib(8); } };
  $("e1").onclick = () => { LM.em = 1; LM.et = 0; vib(10); };
  $("e2").onclick = () => { LM.em = 2; LM.et = 0; vib(10); };
  $("e3").onclick = () => { LM.em = 3; LM.et = 0; vib(10); };

  function onRoomUpdated(room) {
    closeSheet();
    const sh = $("sheet");
    if (sh) { sh.classList.remove("on"); sh.classList.add("hide"); }
    if (scene !== "lobby") show("lobby");
    $("lCode").textContent = `ROOM #${room.code}`;
    $("lMode").textContent = `${room.mode} · ${room.phase}`;
    $("cnt").textContent = `${room.members.length}/20`;
    const isHost = String(room.hostTgId) === String(NET.getMyTgId());
    $("hostBar").classList.toggle("hide", !isHost);
    $("bMode").textContent = `MODE: ${room.mode}`;
  }

  function onMatchStarted(info) {
    PRED.ready = false;
    ENT_SMOOTH.clear();
    if (W.MS_HUD) W.MS_HUD.onMatchStarted(NET, show, info);
  }
  function onMeetingUpdate(m) { if (W.MS_HUD) W.MS_HUD.onMeetingUpdate(NET, m); }
  function onMatchResult(res) { if (W.MS_HUD) W.MS_HUD.onMatchResult(show, res); }

  $("bDis").onclick = () => NET.sendPlayerAction("DISGUISE");
  $("bSpr").onclick = () => NET.sendPlayerAction("SPRINT");
  $("bAct").onclick = () => {
    const snap = NET.getSnapshot();
    if (!snap || !snap.you) return;
    const me = snap.you;
    if (me.escaped || me.dead || me.alive === false) return;
    if (me.team === "GUARD") return NET.sendPlayerAction("ATTACK");

    const px = PRED.ready ? PRED.x : me.x;
    const pz = PRED.ready ? PRED.z : me.z;
    const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - px, t.z - pz) < 2.8);
    if (nearTerm) {
      const targetTermId = nearTerm.id !== undefined ? nearTerm.id : nearTerm.idx;
      openTaskModal(nearTerm.type || nearTerm.k || "", me.role === "TEKNISI", () => {
        NET.sendPlayerAction("COMPLETE_TASK", { termId: targetTermId });
      });
      return;
    }
    if (Math.hypot(32 - px, 22 - pz) < 2.6) return NET.sendPlayerAction("CALL_MEETING");

    const roleUpper = String(me.role || "").toUpperCase();
    if (roleUpper === "TEKNISI") toast("📡 RADAR X-RAY AKTIF 6 DETIK!", "i");
    else if (roleUpper === "DETEKTIF") toast("🕵️ ANALISIS FORENSIK AKTIF 7 DETIK!", "i");
    else if (roleUpper === "DOKTER") toast("🩺 MEMERIKSA LUKA TEMAN DI DEKATMU...", "g");
    else if (roleUpper === "CEPU") toast("🐍 MENYABOTASE TERMINAL HIJAU...", "b");
    else if (roleUpper === "PERETAS") toast("💻 MERETAS LISTRIK GEDUNG...", "b");
    else if (roleUpper === "BADUT") toast("🤡 MEMANCING KECURIGAAN!", "i");

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
  addEventListener("keyup", (e) => {
    const q = e.key.toLowerCase();
    delete keys[q];
    if (AR[q]) delete keys[AR[q]];
  });

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
        pcv.imageSmoothingEnabled = false;
        const sp = W.MS_SPR.spr(ME, pdir, 0);
        pcv.clearRect(0, 0, pcv.width, pcv.height);
        pcv.drawImage(sp, 0, 0);
      }
      return;
    }

    const sheetEl = $("sheet");
    const setEl = $("set");
    const modalOpen = (sheetEl && sheetEl.classList.contains("on")) ||
                      (setEl && !setEl.classList.contains("hide"));
    const ix = modalOpen ? 0 : cl(jx + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), -1, 1);
    const iy = modalOpen ? 0 : cl(jy + (keys.s ? 1 : 0) - (keys.w ? 1 : 0), -1, 1);

    if (scene === "lobby") {
      stepStreetTraffic(dt);
      const l = Math.hypot(ix, iy);
      LM.mv = l > 0.15;
      if (LM.mv) {
        const nx = LM.x + (ix / l) * 4.2 * dt;
        const nz = LM.z + (iy / l) * 4.2 * dt;
        if (!lobbyBlocked(nx, LM.z)) LM.x = nx;
        if (!lobbyBlocked(LM.x, nz)) LM.z = nz;
        LM.wd += 4.2 * dt;
        LM.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 2 : 3) : (iy > 0 ? 0 : 1);
      } else {
        LM.wd = 0;
      }
      if (LM.jy > 0) { LM.vy -= 300 * dt; LM.jy = Math.max(0, LM.jy + LM.vy * dt); }
      if (LM.em) { LM.et += dt; if (LM.et > 2.2) LM.em = 0; }

      netSendAcc += dt;
      if (netSendAcc >= 0.05) { netSendAcc = 0; NET.sendLobbyMove(LM.x, LM.z, LM.dir, LM.em, LM.jy); }
      renderWorld(false, LM.x, LM.z, dt);
    } else if (scene === "hud") {
      netSendAcc += dt;
      if (netSendAcc >= 0.04) { netSendAcc = 0; NET.sendPlayerInput(++inputSeq, ix, iy, Math.atan2(iy, ix)); }
      const snap = NET.getSnapshot();
      if (snap && snap.you) {
        if (!PRED.ready || Math.hypot(snap.you.x - PRED.x, snap.you.z - PRED.z) > 4.5) {
          PRED.x = snap.you.x;
          PRED.z = snap.you.z;
          PRED.dir = snap.you.dir || 0;
          PRED.ready = true;
        }

        // Client-Side Prediction 60 FPS untuk pemain lokal
        const canMoveLocal = !snap.you.dead && !snap.you.escaped && !snap.you.stunned &&
          !(snap.you.team === "GUARD" && snap.graceLeft > 0);
        const mag = Math.hypot(ix, iy);
        PRED.mv = canMoveLocal && mag > 0.1;

        if (PRED.mv) {
          const baseSpd = snap.you.team === "GUARD" ? 4.35 : 4.15;
          const sprMult = snap.you.sprinting ? 1.62 : 1;
          const step = baseSpd * sprMult * dt;
          const norm = mag > 1 ? 1 / mag : 1;
          const nx = PRED.x + ix * norm * step;
          const nz = PRED.z + iy * norm * step;
          if (!blocked(nx, PRED.z)) PRED.x = nx;
          if (!blocked(PRED.x, nz)) PRED.z = nz;
          PRED.dir = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? 2 : 3) : (iy > 0 ? 0 : 1);
          PRED.wd += step;
        } else {
          PRED.wd = 0;
        }

        // Koreksi halus ke posisi server tanpa patah-patah
        const errX = snap.you.x - PRED.x;
        const errZ = snap.you.z - PRED.z;
        const errDist = Math.hypot(errX, errZ);
        if (errDist > 0.05) {
          const pull = PRED.mv ? 0.12 : 0.25;
          PRED.x += errX * pull;
          PRED.z += errZ * pull;
        }

        if (W.MS_HUD) W.MS_HUD.updateHud(snap);

        if (snap.you.escaped && W.MS_ESCAPE_FX && !W.MS_ESCAPE_FX.isSpectating()) {
          W.MS_ESCAPE_FX.renderEscapeScene(ctx, VW, VH, snap, tclock);
          return;
        }

        let focusX = PRED.x;
        let focusZ = PRED.z;
        if (snap.you.escaped || snap.you.dead || snap.you.alive === false) {
          const target = W.MS_ESCAPE_FX ? W.MS_ESCAPE_FX.getSpectateTarget(snap) : null;
          if (target) {
            const ts = ENT_SMOOTH.get(target.id);
            focusX = ts ? ts.x : target.x;
            focusZ = ts ? ts.z : target.z;
          }
        }
        renderWorld(true, focusX, focusZ, dt, snap, focusX, focusZ);
      }
    }
  }

  function renderWorld(isGame, fx, fz, dt, snap = null, lightX = fx, lightZ = fz) {
    const mw = isGame ? MW * T : LW, mh = isGame ? MH * T : LH;
    const ctx_ = mw <= VW ? (mw - VW) / 2 : cl(fx * T - VW / 2, 0, mw - VW);
    const cty_ = mh <= VH ? (mh - VH) / 2 : cl(fz * T - VH / 2, 0, mh - VH);
    if (!cam.on) { cam.x = ctx_; cam.y = cty_; cam.on = 1; }
    else {
      const k = 1 - Math.exp(-dt * 18);
      cam.x += (ctx_ - cam.x) * k;
      cam.y += (cty_ - cam.y) * k;
    }
    camX = Math.round(cam.x);
    camY = Math.round(cam.y);

    ctx.fillStyle = "#0b0716";
    ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(isGame ? wc : lc, -camX, -camY);

    const drawList = [];
    const walkStep = [1, 0, 2, 0][Math.floor(tclock * 7) % 4];

    if (!isGame) {
      renderStreetLayer(ctx, camX, camY, VW, VH, tclock, drawList);
      NET.lobbyPeers.forEach((p) => {
        const dxp = p.tx - p.x, dzp = p.tz - p.z;
        const peerMoving = Math.hypot(dxp, dzp) > 0.03;
        p.x += dxp * (1 - Math.exp(-dt * 15));
        p.z += dzp * (1 - Math.exp(-dt * 15));
        const pfr = peerMoving ? walkStep : 0;
        drawList.push({ y: p.z, f: () => drawAvatarFast(ctx, p.avatar, p.x * T - camX, p.z * T - camY, p.dir, pfr, p.name, "#fff", p.jy, p.em) });
      });
      const fr = LM.mv ? [1, 0, 2, 0][Math.floor(LM.wd * 2.2) % 4] : 0;
      drawList.push({ y: LM.z, f: () => drawAvatarFast(ctx, ME, LM.x * T - camX, LM.z * T - camY, LM.dir, fr, getUN(), "#ffd23f", LM.jy, LM.em) });
    } else if (snap) {
      const propDrawer = (W.MS_PROP_ART && W.MS_PROP_ART.drawPropSpritePro) || W.MS_WORLD.drawPropSprite;
      const lerpFactor = 1 - Math.exp(-dt * 16);
      const activeIds = new Set();

      (snap.props || []).forEach((p) => drawList.push({ y: p.z, f: () => propDrawer(ctx, p.type, p.x * T - camX, p.z * T - camY) }));
      (snap.entities || []).forEach((e) => {
        if (e.dead || e.escaped) return;
        const isMe = String(e.id) === String(snap.you.id);

        if (isMe && PRED.ready) {
          const sx = PRED.x, sz = PRED.z;
          const fr = PRED.mv ? [1, 0, 2, 0][Math.floor(PRED.wd * 2.2) % 4] : 0;
          drawList.push({
            y: sz,
            f: () => {
              const px = sx * T - camX, py = sz * T - camY;
              if ((e.disguised || e.isAnonProp) && e.propType) propDrawer(ctx, e.propType, px, py);
              else drawAvatarFast(ctx, e.avatar || ME, px, py, PRED.dir, fr, e.name, e.team === "GUARD" ? "#ff5d6c" : "#ffd23f", 0, e.em || 0);
            }
          });
          return;
        }

        activeIds.add(e.id);
        let sm = ENT_SMOOTH.get(e.id);
        if (!sm) {
          sm = { x: e.x, z: e.z };
          ENT_SMOOTH.set(e.id, sm);
        } else if (Math.hypot(e.x - sm.x, e.z - sm.z) > 5) {
          sm.x = e.x;
          sm.z = e.z;
        } else {
          sm.x += (e.x - sm.x) * lerpFactor;
          sm.z += (e.z - sm.z) * lerpFactor;
        }

        const isMoving = Boolean(e.moving) || Math.hypot(e.x - sm.x, e.z - sm.z) > 0.04;
        const fr = isMoving ? walkStep : 0;
        const sx = sm.x, sz = sm.z;

        drawList.push({
          y: sz,
          f: () => {
            const px = sx * T - camX, py = sz * T - camY;
            if ((e.disguised || e.isAnonProp) && e.propType) propDrawer(ctx, e.propType, px, py);
            else drawAvatarFast(ctx, e.avatar || ME, px, py, e.dir || 0, fr, e.name, e.team === "GUARD" ? "#ff5d6c" : "#fff", 0, e.em || 0);
          }
        });
      });

      for (const id of ENT_SMOOTH.keys()) {
        if (!activeIds.has(id)) ENT_SMOOTH.delete(id);
      }

      (snap.terminals || []).forEach((t) => {
        drawList.push({
          y: t.z,
          f: () => {
            const px = Math.round(t.x * T - camX), py = Math.round(t.z * T - camY);
            ctx.fillStyle = "#1d2430"; ctx.fillRect(px - 6, py - 16, 12, 16);
            ctx.fillStyle = t.done ? "#5ee38b" : t.sabotaged ? "#ff5d6c" : Math.sin(tclock * 6) > 0 ? "#ffd23f" : "#5cc8ff";
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
      BULBS.forEach((b) => {
        const bx = b[0] - camX, by = b[1] - camY;
        if (bx >= 0 && bx <= VW && by >= 0 && by <= VH) { ctx.fillStyle = b[2]; ctx.fillRect(bx, by, 2, 2); }
      });

      const px2 = Math.round(lightX * T - camX), py2 = Math.round(lightZ * T - camY - 8);
      const baseRad = [74, 96, 124][CFG.br] || 74;
      const rad = (snap.blackout && snap.you.team === "CIVILIAN") ? Math.round(baseRad * 0.55) : baseRad;
      const darkAlpha = [0.78, 0.56, 0.32][CFG.br] ?? 0.78;
      const mask = getLightMask(rad, darkAlpha);
      const half = mask.width >> 1;

      ctx.fillStyle = `rgba(4,6,20,${darkAlpha})`;
      ctx.fillRect(0, 0, Math.max(0, px2 - half), VH);
      ctx.fillRect(Math.min(VW, px2 + half), 0, Math.max(0, VW - (px2 + half)), VH);
      ctx.fillRect(px2 - half, 0, mask.width, Math.max(0, py2 - half));
      ctx.fillRect(px2 - half, Math.min(VH, py2 + half), mask.width, Math.max(0, VH - (py2 + half)));
      ctx.drawImage(mask, px2 - half, py2 - half);

      if (W.MS_ROLE_FX) W.MS_ROLE_FX.renderRoleWorldOverlays(ctx, camX, camY, VW, VH, snap, tclock);
      if (W.MS_HUD) W.MS_HUD.drawExitCompass(ctx, VW, VH, snap, tclock);
    }
  }

  W.MS_APP = { onRoomUpdated, onMatchStarted, onMeetingUpdate, onMatchResult };
  requestAnimationFrame(loop);
})(window);
