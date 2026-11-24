(function (W) {
  "use strict";

  const $ = (i) => document.getElementById(i);
  const R = Math.random;
  const rnd = (a, b) => a + R() * (b - a);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const tgw = W.Telegram && W.Telegram.WebApp;

  let UN = (tgw && tgw.initDataUnsafe && tgw.initDataUnsafe.user && tgw.initDataUnsafe.user.first_name) || "Pemain";
  if (tgw) {
    try { tgw.ready(); tgw.expand(); } catch (e) {}
  }

  const CFG = { vib: 1, sfx: 2, mus: 2, song: 0, br: 0 };
  const PG = { coins: 0, xp: 0, games: 0, wins: 0, tasks: 0, unl: [] };

  try {
    const sv = JSON.parse(localStorage.getItem("msp_mp1") || "{}");
    if (sv.cfg) Object.assign(CFG, sv.cfg);
    if (sv.pg) Object.assign(PG, sv.pg);
    if (sv.name) UN = String(sv.name).slice(0, 12);
  } catch (e) {}

  const vib = (p) => {
    try { if (CFG.vib && navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  };

  const T = 16, MW = 64, MH = 44;
  const SKIN = ["#ffe0c2", "#f5c9a0", "#d9a273", "#b87a4b", "#8a5530", "#5a3520"];
  const HAIR = ["#1c1c24", "#4a2c1a", "#8b5a2b", "#d9a441", "#c2506b", "#5aa0ff", "#e8eef5", "#35b868"];
  const CLR = ["#7ee08a", "#f4efdc", "#ff7a8a", "#6bb7ff", "#ffd23f", "#b78cff", "#2b2b36", "#d93848"];

  // Minimal 12-15 item tersedia untuk masing-masing gender (u = unisex/semua, f = cewe, m = cowo)
  const CAT = {
    hair: [
      ["Pendek", "u"], ["Panjang", "f"], ["Bob", "f"], ["Jabrik", "m"],
      ["Cepol", "f"], ["Kuncir", "u"], ["Poni", "f"], ["Keriting", "u"],
      ["Belah Tengah", "m"], ["Twintail", "f"], ["Cepak", "m"], ["Wolf Cut", "u"],
      ["Mohawk Punk", "u"], ["Mullet", "m"], ["Kepang", "f"], ["Messy", "u"],
      ["Undercut", "m"], ["Pompadour", "m"]
    ],
    shirt: [
      ["Kaos Casual", "u"], ["Jaket Bomber", "u"], ["Tanktop", "f"], ["Hoodie", "u"],
      ["Flanel Casual", "m"], ["Gaun Pesta", "f"], ["Crop Top", "f"], ["Jersey", "m"],
      ["Kaos Garis", "u"], ["Sweater Natal", "u"], ["Jaket Kulit Punk", "u"], ["Kaos Punk", "u"],
      ["Baju Santa", "m"], ["Dress Natal", "f"], ["Kardigan Casual", "f"], ["Rompi Denim", "m"],
      ["Baju Elf Natal", "u"], ["Jas Kantor", "m"]
    ],
    bot: [
      ["Celana Panjang", "u"], ["Rok Lipit", "f"], ["Celana Pendek", "u"], ["Cargo", "m"],
      ["Rok Mini", "f"], ["Kulot Casual", "f"], ["Training", "m"], ["Jeans Sobek Punk", "u"],
      ["Rok Tartan Punk", "f"], ["Tartan Punk", "m"], ["Celana Santa", "u"], ["Legging", "f"],
      ["Chino Casual", "m"], ["Baggy Jeans", "u"], ["Celana Kulit", "u"], ["Overall", "u"],
      ["Celana Kotak", "u"], ["Jogger", "m"]
    ],
    acc: [
      ["Tanpa", "u"], ["Kacamata", "u"], ["Topi Casual", "u"], ["Pita Rambut", "f"],
      ["Headset", "u"], ["Masker", "u"], ["Beanie", "u"], ["Bandana", "u"],
      ["Anting", "f"], ["Syal Natal", "u"], ["Kacamata Hitam", "m"], ["Jepit Bunga", "f"],
      ["Topi Santa", "u"], ["Tanduk Rusa", "u"], ["Rantai Punk", "u"], ["Goggles Punk", "m"],
      ["Mahkota Kecil", "f"], ["Kupluk Natal", "m"]
    ]
  };

  const TABS = ["Gaya", "Kulit", "Rambut", "Baju", "Bawah", "Aksesori"];
  const TAB_KEYS = ["g", "skin", "hair", "shirt", "bot", "acc"];

  const ME = { g: "f", skin: 1, hair: 1, hairC: 0, shirt: 0, shirtC: 1, bot: 1, botC: 7, acc: 0, sp: {} };
  const PRE = {
    f: { g: "f", hair: 1, shirt: 0, bot: 1, shirtC: 1, botC: 7, hairC: 0, acc: 0 },
    m: { g: "m", hair: 0, shirt: 1, bot: 0, shirtC: 6, botC: 6, hairC: 0, acc: 0 }
  };

  const LOCK = {
    hair: { 3: 30, 7: 40, 9: 40, 11: 50, 12: 60, 17: 50 },
    shirt: { 5: 50, 9: 60, 10: 70, 11: 50, 12: 60, 13: 60, 16: 50 },
    bot: { 3: 30, 7: 40, 8: 50, 9: 50, 10: 40, 15: 50 },
    acc: { 4: 40, 9: 40, 10: 40, 12: 50, 13: 50, 14: 60, 15: 50, 16: 70 }
  };

  function ok(t, g) {
    g = g || ME.g;
    return t === "u" || t === g;
  }

  function owned(c, i) {
    const p = (LOCK[c] || {})[i];
    return !p || PG.unl.indexOf(c + ":" + i) > -1;
  }

  function pk(c, g) {
    const l = [];
    CAT[c].forEach((n, i) => {
      if (ok(n[1], g) && owned(c, i)) l.push(i);
    });
    return l.length ? l[Math.floor(R() * l.length)] : 0;
  }

  function sh(h, a) {
    const n = parseInt(h.slice(1), 16);
    const r = cl((n >> 16) + a, 0, 255);
    const g = cl(((n >> 8) & 255) + a, 0, 255);
    const b = cl((n & 255) + a, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function rav() {
    const g = R() < 0.5 ? "f" : "m";
    return {
      g,
      skin: Math.floor(R() * SKIN.length),
      hair: pk("hair", g),
      hairC: Math.floor(R() * HAIR.length),
      shirt: pk("shirt", g),
      shirtC: Math.floor(R() * CLR.length),
      bot: pk("bot", g),
      botC: Math.floor(R() * CLR.length),
      acc: R() < 0.4 ? 0 : pk("acc", g),
      sp: {}
    };
  }

  function saveCfg() {
    try {
      const { sp, ...cleanAv } = ME;
      localStorage.setItem("msp_mp1", JSON.stringify({ cfg: CFG, pg: PG, name: UN, av: cleanAv }));
    } catch (e) {}
  }

  const QUICK_CHATS = [
    "Halo semua!", "Siap main!", "Ayo mulai!", "Gas terus!",
    "Aku bukan Cepu!", "Hati-hati Satpam!", "Kumpul di tengah!", "GG mantap!"
  ];

  /* ---------- Audio Chiptune & SFX Engine ---------- */
  let AC = null, NB = null;
  const MV = [0, 0.35, 0.65, 1];
  const SV = [0, 0.4, 0.7, 1];
  const MU = { step: 0, t: 0, song: -1, force: 0, iv: null, mode: "lobby" };
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
    AC.mg.gain.value = MV[CFG.mus] * 0.5;
    AC.sg.gain.value = SV[CFG.sfx];
    return AC;
  }

  function beep(f, d) {
    try {
      if (!SV[CFG.sfx]) return;
      actx();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = "square"; o.frequency.value = f; g.gain.value = 0.05;
      o.connect(g); g.connect(AC.sg);
      o.start(); o.stop(AC.currentTime + d);
    } catch (e) {}
  }

  const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function tone(t, f, d, ty, v) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = ty; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.mg);
    o.start(t); o.stop(t + d + 0.05);
  }
  function nz(t, d, v, fr) {
    if (!NB) {
      NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const a = NB.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    }
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = NB; f.type = "highpass"; f.frequency.value = fr;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(AC.mg);
    s.start(t); s.stop(t + d + 0.02);
  }
  function kick(t) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(AC.mg);
    o.start(t); o.stop(t + 0.2);
  }
  function playStep(t, g, st, bar) {
    const ch = g.ch[bar], b = g.r + ch[0], tr = ch[1] ? [0, 3, 7] : [0, 4, 7];
    if (g.bs.charAt(st) === "x") tone(t, mf(b - 12), g.bd, "triangle", 0.45);
    const ap = g.ap.charAt(st);
    if (ap !== ".") tone(t, mf(b + 12 + tr[+ap]), 0.11, g.aw, 0.08);
    const ld = g.ld[bar & 1].charAt(st);
    if (ld !== ".") { const d = +ld; tone(t, mf(g.r + g.sc[d % 5] + 12 * Math.floor(d / 5) + 12), g.ls, "square", 0.09); }
    const dr = g.dr.charAt(st);
    if (dr === "k") kick(t);
    if (dr === "s") nz(t, 0.13, 0.3, 1500);
    if (dr === "h") nz(t, 0.04, 0.1, 7000);
  }
  function sched() {
    if (!AC || AC.state !== "running" || !MV[CFG.mus]) return;
    const now = AC.currentTime;
    if (MU.t < now) MU.t = now + 0.05;
    while (MU.t < now + 0.25) {
      if ((MU.step & 15) === 0 || MU.force) {
        const w = CFG.song > 0 ? CFG.song - 1 : (MU.mode === "chase" ? 3 : MU.mode === "hud" ? 1 : MU.mode === "lobby" ? 2 : 0);
        if (w !== MU.song || MU.force) { MU.song = w; MU.step = 0; MU.force = 0; }
      }
      const g = SG[MU.song];
      if (!g) break;
      playStep(MU.t, g, MU.step & 15, (MU.step >> 4) & 3);
      MU.t += 60 / g.bpm / 4;
      MU.step++;
    }
  }
  function audioOn() {
    try { actx(); if (!MU.iv) MU.iv = setInterval(sched, 80); } catch (e) {}
  }
  function applyAudioCfg() {
    saveCfg();
    if (AC && AC.mg) {
      AC.mg.gain.value = MV[CFG.mus] * 0.5;
      AC.sg.gain.value = SV[CFG.sfx];
    }
  }

  /* ---------- Toast & Modal ---------- */
  const tq = [];
  let tb = false;
  function toast(t, type = "i") {
    if (tq.length > 2) tq.shift();
    tq.push([t, type]);
    if (!tb) nxtToast();
  }
  function nxtToast() {
    const q = tq.shift(), e = $("toast");
    if (!q || !e) { tb = false; if (e) e.classList.remove("on"); return; }
    tb = true;
    e.textContent = q[0];
    e.style.color = q[1] === "b" ? "#ff5d6c" : q[1] === "g" ? "#5ee38b" : "#fff";
    e.classList.add("on");
    beep(q[1] === "b" ? 160 : q[1] === "g" ? 660 : 440, 0.08);
    setTimeout(nxtToast, tq.length ? 1200 : 2200);
  }

  function openSheet(h) { $("box").innerHTML = h; $("sheet").classList.add("on"); }
  function closeSheet() { $("sheet").classList.remove("on"); }

  W.MS_CFG = {
    $, R, rnd, cl, vib, tgw,
    getUN: () => UN,
    setUN: (v) => { UN = String(v || "").replace(/[<>]/g, "").trim().slice(0, 12) || "Pemain"; saveCfg(); },
    CFG, PG, ME, T, MW, MH, SKIN, HAIR, CLR, CAT, TABS, TAB_KEYS, PRE, LOCK,
    ok, owned, sh, rav, saveCfg, toast, openSheet, closeSheet, QUICK_CHATS
  };
  W.MS_AUDIO = { beep, audioOn, applyAudioCfg, MU };
})(window);
