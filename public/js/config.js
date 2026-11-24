(function (W) {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const R = Math.random;
  const rnd = (a, b) => a + R() * (b - a);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const vib = (p) => {
    try {
      if (CFG.vib && navigator.vibrate) navigator.vibrate(p);
    } catch (e) {}
  };

  const tgw = W.Telegram && W.Telegram.WebApp;
  let UN = (tgw && tgw.initDataUnsafe && tgw.initDataUnsafe.user && tgw.initDataUnsafe.user.first_name) || "Pemain";
  if (tgw) {
    try {
      tgw.ready();
      tgw.expand();
    } catch (e) {}
  }

  const CFG = { vib: 1, sfx: 2, mus: 2, song: 0, br: 0 };
  const PG = { coins: 0, xp: 0, games: 0, wins: 0, tasks: 0, best: 0, cepu: 0, unl: [] };

  try {
    const sv = JSON.parse(localStorage.getItem("msp1") || "{}");
    Object.keys(CFG).forEach((q) => {
      if (typeof sv[q] === "number") CFG[q] = sv[q];
    });
    if (sv.name) UN = String(sv.name).slice(0, 10);
  } catch (e) {}

  function saveCfg() {
    try {
      localStorage.setItem("msp1", JSON.stringify({
        vib: CFG.vib, sfx: CFG.sfx, mus: CFG.mus, song: CFG.song, br: CFG.br, name: UN
      }));
    } catch (e) {}
  }

  const T = 16, MW = 64, MH = 44;
  const SKIN = ["#ffe0c2", "#f5c9a0", "#d9a273", "#b87a4b", "#8a5530", "#5a3520"];
  const HAIR = ["#1c1c24", "#4a2c1a", "#8b5a2b", "#d9a441", "#c2506b", "#5aa0ff"];
  const CLR = ["#7ee08a", "#f4efdc", "#ff7a8a", "#6bb7ff", "#ffd23f", "#b78cff", "#2b2b36", "#a8d8ea"];

  const CAT = {
    hair: [["Pendek", "u"], ["Panjang", "f"], ["Bob", "f"], ["Jabrik", "m"], ["Cepol", "f"], ["Kuncir", "u"], ["Poni", "f"], ["Keriting", "u"], ["Belah Tengah", "m"], ["Twintail", "f"], ["Cepak", "m"], ["Wolf", "u"]],
    shirt: [["Kaos", "u"], ["Jaket", "u"], ["Tanktop", "f"], ["Hoodie", "u"], ["Kemeja", "m"], ["Gaun", "f"], ["Crop Top", "f"], ["Jersey", "m"], ["Kaos Garis", "u"]],
    bot: [["Celana", "u"], ["Rok", "f"], ["Pendek", "u"], ["Cargo", "m"], ["Rok Mini", "f"], ["Kulot", "f"], ["Training", "m"]],
    acc: [["Tanpa", "u"], ["Kacamata", "u"], ["Topi", "u"], ["Pita", "f"], ["Headset", "u"], ["Masker", "u"], ["Beanie", "u"], ["Bandana", "u"], ["Anting", "f"], ["Syal", "u"], ["Kacamata Hitam", "m"], ["Jepit Bunga", "f"]]
  };

  const LOCK = {
    hair: { 3: 40, 4: 40, 7: 60, 9: 60, 11: 80 },
    shirt: { 3: 50, 5: 60, 7: 50, 8: 40 },
    bot: { 3: 40, 5: 40, 6: 30 },
    acc: { 2: 30, 4: 50, 6: 30, 7: 30, 9: 30, 10: 60, 11: 40 }
  };

  const ME = { g: "f", skin: 1, hair: 1, hairC: 0, shirt: 2, shirtC: 0, bot: 1, botC: 7, acc: 0, sp: {} };
  const PRE = {
    f: { g: "f", hair: 1, shirt: 2, bot: 1, shirtC: 0, botC: 7, hairC: 0 },
    m: { g: "m", hair: 0, shirt: 1, bot: 0, shirtC: 1, botC: 6, hairC: 0 }
  };

  const PN = { cone: "Cone Parkir", galon: "Dispenser", pot: "Pot Tanaman", drum: "Tong Sampah", speaker: "Printer", palet: "Sofa" };
  const TN = ["KABEL SERVER", "ISI GALON", "PROYEKTOR", "PRINTER", "BRANKAS", "PANEL LISTRIK"];
  const QUICK_CHATS = ["Butuh bantuan!", "Ikuti aku!", "Ada Satpam di dekat sini!", "Tugas lagi disabotase!", "Aku lagi ngerjain tugas.", "Pintu darurat terbuka!", "Sus banget gerak-geriknya!", "Ayo kumpul rapat!"];

  function ok(t, g) { g = g || ME.g; return t === "u" || t === g; }
  function owned(c, i) { const p = (LOCK[c] || {})[i]; return !p || PG.unl.indexOf(c + ":" + i) > -1; }
  function sh(h, a) {
    const n = parseInt(h.slice(1), 16);
    const r = cl((n >> 16) + a, 0, 255);
    const g = cl(((n >> 8) & 255) + a, 0, 255);
    const b = cl((n & 255) + a, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- WebAudio Synth & SFX ---------- */
  let AC = null, NB = null;
  const MV = [0, 0.35, 0.65, 1], SV = [0, 0.4, 0.7, 1];
  const MU = { step: 0, t: 0, song: -1, force: 0, iv: null };
  const SG = [
    { bpm: 104, r: 57, sc: [0, 3, 5, 7, 10], ch: [[0, 1], [-4, 0], [-2, 0], [-5, 1]], bs: "x..x..x.x..x..x.", bd: 0.18, ap: "0121012101210121", aw: "square", ld: ["5..4..3.2..3.4..", "7..5..4.3..2.0.."], ls: 0.2, dr: "k.h.s.h.k.h.s.hh" },
    { bpm: 80, r: 45, sc: [0, 3, 5, 7, 10], ch: [[0, 1], [1, 0], [-2, 0], [-4, 0]], bs: "x.......x.....x.", bd: 0.35, ap: "0...2...1...2...", aw: "triangle", ld: ["..........5.....", "......4........."], ls: 0.5, dr: "k.h.h.h.k.h.h.h." },
    { bpm: 92, r: 60, sc: [0, 2, 4, 7, 9], ch: [[0, 0], [-3, 1], [-7, 0], [-5, 0]], bs: "x...x...x...x.x.", bd: 0.3, ap: "0.1.2.1.0.1.2.1.", aw: "triangle", ld: ["4..3.2..3..4.2..", "5..4.3..2..0...."], ls: 0.3, dr: "k...h...s...h..." },
    { bpm: 150, r: 52, sc: [0, 3, 5, 7, 10], ch: [[0, 1], [-2, 0], [-4, 0], [-5, 0]], bs: "xxxxxxxxxxxxxxxx", bd: 0.08, ap: "0120120120120120", aw: "square", ld: ["7.5.7.8.7.5.4.5.", "8.7.5.7.8.9.8.7."], ls: 0.1, dr: "k.hkshk.k.hkshkk" }
  ];

  function actx() {
    if (!AC) {
      AC = new (W.AudioContext || W.webkitAudioContext)();
      AC.mg = AC.createGain();
      AC.sg = AC.createGain();
      AC.mg.connect(AC.destination);
      AC.sg.connect(AC.destination);
    }
    if (AC.state === "suspended") AC.resume();
    AC.mg.gain.value = MV[CFG.mus] * 0.55;
    AC.sg.gain.value = SV[CFG.sfx];
    return AC;
  }

  function beep(f, d) {
    try {
      if (!SV[CFG.sfx]) return;
      actx();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = "square"; o.frequency.value = f; g.gain.value = 0.05;
      o.connect(g); g.connect(AC.sg); o.start(); o.stop(AC.currentTime + d);
    } catch (e) {}
  }

  function mf(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function tone(t, f, d, ty, v) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = ty; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.mg); o.start(t); o.stop(t + d + 0.05);
  }
  function nz(t, d, v, fr) {
    if (!NB) {
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const a = NB.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = R() * 2 - 1;
    }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NB; f.type = "highpass"; f.frequency.value = fr;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(AC.mg); s.start(t); s.stop(t + d + 0.02);
  }
  function kick(t) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(AC.mg); o.start(t); o.stop(t + 0.2);
  }

  function audioOn() {
    try {
      actx();
      if (!MU.iv) MU.iv = setInterval(() => {
        if (!AC || AC.state !== "running" || !MV[CFG.mus]) return;
        const now = AC.currentTime;
        if (MU.t < now) MU.t = now + 0.05;
        while (MU.t < now + 0.25) {
          const w = CFG.song > 0 ? CFG.song - 1 : (W.MS_SCENE === "lobby" ? 2 : (W.MS_SCENE === "hud" ? 1 : 0));
          if (w !== MU.song || MU.force) { MU.song = w; MU.step = 0; MU.force = 0; }
          const g = SG[MU.song];
          const st = MU.step & 15, bar = (MU.step >> 4) & 3;
          const ch = g.ch[bar], b = g.r + ch[0], tr = ch[1] ? [0, 3, 7] : [0, 4, 7];
          if (g.bs[st] === "x") tone(MU.t, mf(b - 12), g.bd, "triangle", 0.5);
          if (g.ap[st] !== ".") tone(MU.t, mf(b + 12 + tr[+g.ap[st]]), 0.11, g.aw, 0.09);
          if (g.ld[bar & 1][st] !== ".") { const d = +g.ld[bar & 1][st]; tone(MU.t, mf(g.r + g.sc[d % 5] + 12 * Math.floor(d / 5) + 12), g.ls, "square", 0.1); }
          if (g.dr[st] === "k") kick(MU.t);
          if (g.dr[st] === "s") nz(MU.t, 0.13, 0.35, 1500);
          if (g.dr[st] === "h") nz(MU.t, 0.04, 0.12, 7000);
          MU.t += 60 / g.bpm / 4;
          MU.step++;
        }
      }, 80);
    } catch (e) {}
  }

  /* ---------- Toast & Sheet UI ---------- */
  const tq = [];
  let tb = false;
  function toast(t, forcedType) {
    const ty = forcedType || (/TERTANGKAP|KENA|RUSAK|DEKAT|KETAHUAN|MELESET|WAKTU|DISABOTASE|KOIN KURANG|GAGAL/.test(t) ? "b" : /SELESAI|KABUR|TERBUKA|BAGUS|CEPU!|DIBELI|SIAP/.test(t) ? "g" : "i");
    if (tq.length > 2) tq.shift();
    tq.push([t, ty]);
    if (!tb) nxtToast();
  }
  function nxtToast() {
    const q = tq.shift(), e = $("toast");
    if (!q) { tb = false; e.classList.remove("on"); return; }
    tb = true;
    e.textContent = q[0];
    e.style.color = q[1] === "b" ? "#ff5d6c" : q[1] === "g" ? "#5ee38b" : "#fff";
    e.classList.add("on");
    beep(q[1] === "b" ? 160 : q[1] === "g" ? 660 : 440, 0.09);
    setTimeout(nxtToast, tq.length ? 1200 : 2300);
  }

  function openSheet(h) { $("box").innerHTML = h; $("sheet").classList.add("on"); }
  function closeSheet() { $("sheet").classList.remove("on"); }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  W.MS_CFG = {
    $, R, rnd, cl, vib, tgw,
    getUN: () => UN,
    setUN: (v) => { UN = String(v || "Pemain").slice(0, 12); saveCfg(); },
    CFG, PG, saveCfg, T, MW, MH, SKIN, HAIR, CLR, CAT, LOCK, ME, PRE, PN, TN, QUICK_CHATS,
    ok, owned, sh, audioOn, beep, MU, toast, openSheet, closeSheet, fmt
  };
})(window);
