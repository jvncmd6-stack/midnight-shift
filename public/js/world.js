(function (W) {
  "use strict";
  const { $, R, rnd, cl, CFG, T, MW, MH, sh } = W.MS_CFG;
  const { spr, prop } = W.MS_SPR;

  const ZN = [
    ["Lobi Gedung", 1, 33, 11, 10, "#33405f", "#3a4868"],
    ["Ruang Kantor", 2, 2, 20, 16, "#3d4a63", "#44526d"],
    ["Ruang Server", 14, 26, 16, 16, "#2a4a52", "#315660"],
    ["Kafetaria", 34, 26, 18, 16, "#5a4a3a", "#65543f"],
    ["Aula Rapat", 38, 2, 24, 16, "#4a3a62", "#55446e"]
  ];

  const SOL = [
    [41, 2, 18, 3, "s"], [36, 29, 5, 2, "k"], [44, 29, 5, 2, "k"],
    [16, 29, 4, 2, "g"], [23, 29, 4, 2, "g"], [5, 6, 4, 2, "j"],
    [14, 11, 4, 2, "j"], [9, 14, 4, 2, "j"], [19, 5, 3, 2, "j"], [2, 34, 6, 2, "b"]
  ];

  const GL = [[20, 19.5], [44, 19.5], [20, 24.6], [44, 24.6], [10, 22], [54, 22]];
  GL.forEach((g) => SOL.push([g[0] - 0.3, g[1] - 0.45, 0.6, 0.5, "l"]));

  function blocked(x, y) {
    if (x < 1.3 || x > 62.6 || y < 1.6 || y > 42.6) return true;
    for (let i = 0; i < SOL.length; i++) {
      const s = SOL[i];
      if (x > s[0] - 0.3 && x < s[0] + s[2] + 0.3 && y > s[1] - 0.1 && y < s[1] + s[3] + 0.3) return true;
    }
    return false;
  }

  function blobOn(X, col, cx, cy, rx, ry) {
    X.fillStyle = col;
    for (let j = -ry; j <= ry; j++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
      X.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2, 1);
    }
  }

  // Pre-render Map Gedung
  const wc = document.createElement("canvas");
  wc.width = MW * T;
  wc.height = MH * T;
  const wx = wc.getContext("2d");
  const wr = (col, x, y, w, h) => { wx.fillStyle = col; wx.fillRect(x, y, w, h); };

  (function buildIndoorMap() {
    let seed = 11;
    const sr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        wr((x + y) % 2 ? "#3a4566" : "#3f4b70", x * T, y * T, T, T);
        wr("#2c3550", x * T, y * T, T, 1);
        wr("#2c3550", x * T, y * T, 1, T);
      }
    }
    ZN.forEach((z) => {
      for (let y = z[2]; y < z[2] + z[4]; y++) {
        for (let x = z[1]; x < z[1] + z[3]; x++) {
          wr((x + y) % 2 ? z[5] : z[6], x * T, y * T, T, T);
          if (sr() < 0.25) wr("rgba(0,0,0,.2)", x * T + Math.floor(sr() * 13), y * T + Math.floor(sr() * 13), 3, 2);
        }
      }
    });
    // Karpet koridor utama & tombol darurat tengah
    wr("#3b2f58", 2 * T, 21 * T, 60 * T, 2 * T);
    wr("#d9b43c", 2 * T, 21 * T, 60 * T, 1);
    wr("#d9b43c", 2 * T, 23 * T - 1, 60 * T, 1);
    blobOn(wx, "#3a2f5a", 32 * T, 22 * T + 4, 24, 9);
    blobOn(wx, "#52467c", 32 * T, 22 * T + 4, 18, 6);

    for (let x = 0; x < MW; x++) {
      for (let y = 0; y < MH; y++) {
        if (x === 0 || y === 0 || y === MH - 1 || (x === MW - 1 && !((y >= 11 && y <= 13) || (y >= 30 && y <= 32)))) {
          wr((x + y) % 2 ? "#0d1020" : "#12162a", x * T, y * T, T, T);
          wr("#8fa0c8", x * T, y * T + T - 2, T, 2);
        }
      }
    }
    SOL.forEach((s) => {
      const x = s[0] * T, y = s[1] * T, w = s[2] * T, h = s[3] * T, t = s[4];
      if (t === "s") { wr("#1a2038", x, y, w, h); wr("#2a6fb0", x + 4, y + 3, w - 8, h - 14); }
      if (t === "k") { wr("#7a5a3a", x, y + 10, w, h - 10); wr("#d8d0c0", x, y + 10, w, 5); }
      if (t === "g") { wr("#1d2430", x, y, w, h); wr("#2f3a4c", x, y, w, 5); }
      if (t === "j") { wr("#9a7a52", x, y + 10, w, h - 12); wr("#b89468", x, y + 10, w, 4); }
      if (t === "b") { wr("#5a6a8a", x, y + 6, w, h - 6); wr("#ffd23f", x + 8, y, w - 16, 6); }
    });
  })();

  // Pre-render Jalan Kota Lobi Multiplayer
  const LW = 48 * T, LH = 34 * T;
  const lc = document.createElement("canvas");
  lc.width = LW;
  lc.height = LH;
  const lx = lc.getContext("2d");
  const lr = (c, x, y, w, h) => { lx.fillStyle = c; lx.fillRect(x, y, w, h); };

  (function buildLobbyStreet() {
    lr("#120d2e", 0, 0, LW, 144);
    for (let y = 144; y < 224; y += 16) for (let x = 0; x < LW; x += 16) lr(((x + y) >> 4) % 2 ? "#3a3650" : "#403b58", x, y, 16, 16);
    lr("#25232f", 0, 231, LW, 159);
    for (let x = 0; x < LW; x += 26) lr("#d9b43c", x, 309, 16, 2);
    for (let y = 240; y < 382; y += 10) lr("#cfcfe0", 352, y, 48, 5);
    for (let y = 392; y < 480; y += 16) for (let x = 0; x < LW; x += 16) lr(((x + y) >> 4) % 2 ? "#3a3650" : "#403b58", x, y, 16, 16);
    lr("#1d1838", 0, 480, LW, 64);

    const shops = [
      ["INDOMAUT", "#3a2f5c", "#ff7a8a"], ["KOPI KENAPA", "#4a3558", "#7ee08a"],
      ["ALFAMIDNITE", "#2f3b66", "#5cc8ff"], ["BARBER KING", "#523a4c", "#ffd23f"],
      ["APOTEK K-25", "#2d4a5c", "#5ee38b"], ["STARBAKSO", "#40355f", "#ff9a3c"],
      ["TOKOPEDEH", "#3b4a52", "#b78cff"]
    ];
    let bx = 0;
    shops.forEach((sp) => {
      const bw = 7 * T;
      lr(sp[1], bx, 38, bw, 106);
      lr("#120d28", bx, 104, bw, 40);
      lr(sp[2], bx + 10, 110, bw - 28, 32);
      lx.font = '5px "Press Start 2P",monospace';
      lx.fillStyle = sp[2];
      lx.fillText(sp[0], bx + 8, 96);
      bx += bw;
    });
  })();

  // Minimap Base
  const mb = document.createElement("canvas");
  mb.width = 128;
  mb.height = 88;
  (function buildMinimap() {
    const x = mb.getContext("2d");
    x.fillStyle = "#0b0e1a"; x.fillRect(0, 0, 128, 88);
    x.fillStyle = "#6b7aa6"; x.fillRect(2, 2, 124, 84);
    x.fillStyle = "#7d8cb8"; x.fillRect(2, 36, 124, 16);
    ZN.forEach((z) => { x.fillStyle = sh(z[5], 45); x.fillRect(z[1] * 2, z[2] * 2, z[3] * 2, z[4] * 2); });
    x.fillStyle = "#5ee38b"; x.fillRect(124, 22, 4, 6); x.fillRect(124, 60, 4, 6);
  })();

  function drawMinimap(snap) {
    const mm = $("mm");
    if (!mm || !snap) return;
    const mx = mm.getContext("2d");
    mx.imageSmoothingEnabled = false;
    mx.drawImage(mb, 0, 0);

    const d = (c, x, y, q) => { mx.fillStyle = c; mx.fillRect(Math.round(x * 2 - q / 2), Math.round(y * 2 - q / 2), q, q); };
    (snap.terminals || []).forEach((t) => d(t.done ? "#4a5578" : "#5ee38b", t.x, t.z, 4));
    d("#ff5d6c", 32, 22, 4);
    [12.5, 31.5].forEach((z) => d(snap.gatesOpen ? "#5ee38b" : "#ff5d6c", 62.5, z, 5));

    (snap.entities || []).forEach((e) => {
      if (e.id === snap.you.id) {
        d("#ffffff", e.x, e.z, 5);
      } else if (e.team === "GUARD" && snap.you.team !== "GUARD") {
        d("#ffd23f", e.x, e.z, 5);
      }
    });
  }

  // Sky background untuk Splash & Avatar Creator
  const ST = [];
  for (let i = 0; i < 60; i++) ST.push([R(), R() * 0.6, R()]);

  function drawSky(ctx, VW, VH, tclock) {
    ctx.fillStyle = "#120d2e"; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#1d1445"; ctx.fillRect(0, VH * 0.35, VW, VH * 0.25);
    ctx.fillStyle = "#2a1b5a"; ctx.fillRect(0, VH * 0.6, VW, VH * 0.4);
    ST.forEach((s) => {
      ctx.fillStyle = Math.sin(tclock * 3 + s[2] * 20) > 0 ? "#fff" : "#8c86b8";
      ctx.fillRect(Math.floor(s[0] * VW), Math.floor(s[1] * VH), 1, 1);
    });
    blobOn(ctx, "#ffe9a8", VW - 38, 30, 11, 11);
    blobOn(ctx, "#120d2e", VW - 32, 26, 10, 10);
  }

  function drawAvatarLabel(ctx, a, px, py, dir, fr, name, color = "#fff", jy = 0) {
    const c = spr(a, dir, fr);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(Math.round(px - 5), Math.round(py - 1), 10, 2);
    ctx.drawImage(c, Math.round(px - 10), Math.round(py - 29 - jy));
    if (name) {
      ctx.font = '5px "Press Start 2P",monospace';
      ctx.textAlign = "center";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0b0716";
      ctx.fillStyle = color;
      ctx.strokeText(name.slice(0, 10), px, py - 34 - jy);
      ctx.fillText(name.slice(0, 10), px, py - 34 - jy);
    }
  }

  function drawPropSprite(ctx, type, px, py) {
    const c = prop(type);
    ctx.drawImage(c, Math.round(px - c.width / 2), Math.round(py - c.height + 1));
  }

  W.MS_WORLD = {
    wc, lc, LW, LH, GL, blocked, drawSky, drawAvatarLabel, drawPropSprite, drawMinimap, cl
  };
})(window);
