(function (W) {
  "use strict";
  const { $, rnd, cl, vib, tgw, getUN, CFG, ME, T, MW, MH, toast, closeSheet } = W.MS_CFG;
  const { wc, lc, LW, LH, BULBS, lobbyBlocked, drawSky, stepStreetTraffic, renderStreetLayer, renderStreetLights } = W.MS_WORLD;
  const { openTaskModal } = W.MS_TASKS;
  const { audioOn, MU } = W.MS_AUDIO;
  const NET = W.MS_NET;

  // Muat modul tambahan secara otomatis
  [
    "/js/emotePro.js",
    "/js/propArt.js",
    "/js/hudMeeting.js",
    "/js/lobbyUi.js",
    "/js/escapeFx.js",
    "/js/roleFx.js"
  ].forEach((src) => {
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script");
      s.src = src;
      document.head.appendChild(s);
    }
  });

  const cv = $("c"), ctx = cv.getContext("2d");
  const dm = document.createElement("canvas"), dx = dm.getContext("2d");
  let VW = 300, VH = 170, SC = 3, scene = "splash";
  let jx = 0, jy = 0, keys = {}, camX = 0, camY = 0, pdir = 0, tclock = 0, inputSeq = 0;

  const LM = { x: 24, z: 12.6, vx: 0, vz: 0, wd: 0, dir: 0, jy: 0, vy: 0, em: 0, et: 0, mv: false };
  const cam = { x: 0, y: 0, on: 0 };

  addEventListener("pointerdown", audioOn);
  addEventListener("keydown", audioOn);

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
    closeSheet();
    ["splash", "creator", "lobby", "hud"].forEach((s) => $(s).classList.toggle("hide", s !== id));
    scene = id;
    document.body.className = id;
    cam.on = 0;
    MU.mode = id;
    MU.force = 1;

    // Pindahkan joystick agar tetap muncul dan bisa digerakkan di lobi maupun saat bermain
    const stickEl = $("stick");
    if (stickEl) {
      if (id === "lobby") {
        document.body.appendChild(stickEl);
        stickEl.style.zIndex = "30";
      } else if (id === "hud") {
        $("hud").appendChild(stickEl);
        stickEl.style.zIndex = "";
      }
    }

    if (id !== "hud" && W.MS_ESCAPE_FX) W.MS_ESCAPE_FX.ensureControls(false);
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
    if (scene !== "lobby") show("lobby");
    $("lCode").textContent = `ROOM #${room.code}`;
    $("lMode").textContent = `${room.mode} · ${room.phase}`;
    $("cnt").textContent = `${room.members.length}/20`;
    const isHost = String(room.hostTgId) === String(NET.getMyTgId());
    $("hostBar").classList.toggle("hide", !isHost);
    $("bMode").textContent = `MODE: ${room.mode}`;
  }

  function onMatchStarted(info) { if (W.MS_HUD) W.MS_HUD.onMatchStarted(NET, show, info); }
  function onMeetingUpdate(m) { if (W.MS_HUD) W.MS_HUD.onMeetingUpdate(NET, m); }
  function onMatchResult(res) { if (W.MS_HUD) W.MS_HUD.onMatchResult(show, res); }

  $("bDis").onclick = () => NET.sendPlayerAction("DISGUISE");
  $("bSpr").onclick = () => NET.sendPlayerAction("SPRINT");
  $("bAct").onclick = () => {
    const snap = NET.getSnapshot();
    if (!snap) return;
    const me = snap.you;
    if (me.escaped || me.dead) return;
    if (me.team === "GUARD") return NET.sendPlayerAction("ATTACK");

    const nearTerm = (snap.terminals || []).find((t) => !t.done && Math.hypot(t.x - me.x, t.z - me.z) < 2.6);
    if (nearTerm) {
      const targetTermId = nearTerm.id !== undefined ? nearTerm.id : nearTerm.idx;
      openTaskModal(nearTerm.type || nearTerm.k || "", me.role === "TEKNISI", () => {
        NET.sendPlayerAction("COMPLETE_TASK", { termId: targetTermId });
      });
      return;
    }
    if (Math.hypot(32 - me.x, 22 - me.z) < 2.5) return NET.sendPlayerAction("CALL_MEETING");

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
        const sp = W.MS_SPR.spr(ME, pdir, [0, 1, 0, 2][Math.floor(tclock * 4) % 4]);
        pcv.clearRect(0, 0, pcv.width, pcv.height);
        pcv.drawImage(sp, 0, 0);
      }
      return;
    }

    const sheetEl = $("sheet");
    const setEl = $("set");
    const modalOpen = (sheetEl && !sheetEl.classList.contains("hide") && sheetEl.offsetParent !== null) ||
                      (setEl && !setEl.classList.contains("hide") && setEl.offsetParent !== null);
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
      }
      if (LM.jy > 0) { LM.vy -= 300 * dt; LM.jy = Math.max(0, LM.jy + LM.vy * dt); }
      if (LM.em) { LM.et += dt; if (LM.et > 2.2) LM.em = 0; }

      netSendAcc += dt;
      if (netSendAcc >= 0.06) { netSendAcc = 0; NET.sendLobbyMove(LM.x, LM.z, LM.dir, LM.em, LM.jy); }
      renderWorld(false, LM.x, LM.z, dt);
    } else if (scene === "hud") {
      netSendAcc += dt;
      if (netSendAcc >= 0.05) { netSendAcc = 0; NET.sendPlayerInput(++inputSeq, ix, iy, Math.atan2(iy, ix)); }
      const snap = NET.getSnapshot();
      if (snap && snap.you) {
        if (W.MS_HUD) W.MS_HUD.updateHud(snap);

        if (snap.you.escaped && W.MS_ESCAPE_FX && !W.MS_ESCAPE_FX.isSpectating()) {
          W.MS_ESCAPE_FX.renderEscapeScene(ctx, VW, VH, snap, tclock);
          return;
        }

        let focusX = snap.you.x;
        let focusZ = snap.you.z;
        if (snap.you.escaped || snap.you.dead) {
          const target = W.MS_ESCAPE_FX ? W.MS_ESCAPE_FX.getSpectateTarget(snap) : null;
          if (target) { focusX = target.x; focusZ = target.z; }
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
    else { cam.x += (ctx_ - cam.x) * (1 - Math.exp(-dt * 10)); cam.y += (cty_ - cam.y) * (1 - Math.exp(-dt * 10)); }
    camX = Math.round(cam.x);
    camY = Math.round(cam.y);

    ctx.fillStyle = "#0b0716";
    ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(isGame ? wc : lc, -camX, -camY);

    const drawList = [];
    const avatarDrawer = (W.MS_EMOTE_PRO && W.MS_EMOTE_PRO.drawAvatarLabelPro) || W.MS_WORLD.drawAvatarLabel;

    if (!isGame) {
      renderStreetLayer(ctx, camX, camY, VW, VH, tclock, drawList);
      NET.lobbyPeers.forEach((p) => {
        p.x += (p.tx - p.x) * 0.25; p.z += (p.tz - p.z) * 0.25;
        drawList.push({ y: p.z, f: () => avatarDrawer(ctx, p.avatar, p.x * T - camX, p.z * T - camY, p.dir, 0, p.name, "#fff", p.jy, p.em) });
      });
      const fr = LM.mv ? [1, 0, 2, 0][Math.floor(LM.wd * 2.2) % 4] : 0;
      drawList.push({ y: LM.z, f: () => avatarDrawer(ctx, ME, LM.x * T - camX, LM.z * T - camY, LM.dir, fr, getUN(), "#ffd23f", LM.jy, LM.em) });
    } else if (snap) {
      const wf = (Math.floor(tclock * 8) % 2) + 1;
      const propDrawer = (W.MS_PROP_ART && W.MS_PROP_ART.drawPropSpritePro) || W.MS_WORLD.drawPropSprite;
      (snap.props || []).forEach((p) => drawList.push({ y: p.z, f: () => propDrawer(ctx, p.type, p.x * T - camX, p.z * T - camY) }));
      (snap.entities || []).forEach((e) => {
        if (e.dead || e.escaped) return;
        drawList.push({
          y: e.z,
          f: () => {
            const px = e.x * T - camX, py = e.z * T - camY;
            if ((e.disguised || e.isAnonProp) && e.propType) propDrawer(ctx, e.propType, px, py);
            else avatarDrawer(ctx, e.avatar || ME, px, py, e.dir || 0, wf, e.name, e.team === "GUARD" ? "#ff5d6c" : "#fff", 0, e.em || 0);
          }
        });
      });
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

      dx.globalCompositeOperation = "source-over"; dx.clearRect(0, 0, VW, VH);
      dx.fillStyle = `rgba(4,6,20,${[0.78, 0.56, 0.32][CFG.br] ?? 0.78})`; dx.fillRect(0, 0, VW, VH);
      dx.globalCompositeOperation = "destination-out";
      const grad = dx.createRadialGradient(px2, py2, rad * 0.38, px2, py2, rad);
      grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(0.7, "rgba(0,0,0,0.65)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      dx.fillStyle = grad; dx.beginPath(); dx.arc(px2, py2, rad, 0, Math.PI * 2); dx.fill();
      ctx.drawImage(dm, 0, 0);

      if (W.MS_ROLE_FX) W.MS_ROLE_FX.renderRoleWorldOverlays(ctx, camX, camY, VW, VH, snap, tclock);
      if (W.MS_HUD) W.MS_HUD.drawExitCompass(ctx, VW, VH, snap, tclock);
    }
  }

  W.MS_APP = { onRoomUpdated, onMatchStarted, onMeetingUpdate, onMatchResult };
  requestAnimationFrame(loop);
})(window);
