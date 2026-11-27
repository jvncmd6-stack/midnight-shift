(function (W) {
  "use strict";
  const { $, R, rnd, CFG, T, MW, MH, sh } = W.MS_CFG;
  const { spr, prop, outline } = W.MS_SPR;

  const ZN = [
    ["Lobi Gedung", 1, 33, 11, 10, "#2c3752", "#33405e"],
    ["Ruang Kantor", 2, 2, 20, 16, "#364259", "#3d4b66"],
    ["Ruang Server", 14, 26, 16, 16, "#233f47", "#294a54"],
    ["Kafetaria", 34, 26, 18, 16, "#4f4032", "#594838"],
    ["Aula Rapat", 38, 2, 24, 16, "#403157", "#4a3963"]
  ];

  const SOL = [
    [41, 2, 18, 3, "s"],
    [36, 29, 5, 2, "k"],
    [44, 29, 5, 2, "k"],
    [16, 29, 4, 2, "g"],
    [23, 29, 4, 2, "g"],
    [5, 6, 4, 2, "j"],
    [14, 11, 4, 2, "j"],
    [9, 14, 4, 2, "j"],
    [19, 5, 3, 2, "j"],
    [2, 34, 6, 2, "b"]
  ];

  const BULBS = [];
  const GL = [[20, 19.5], [44, 19.5], [20, 24.6], [44, 24.6], [10, 22], [54, 22]];
  GL.forEach((g) => SOL.push([g[0] - 0.35, g[1] - 0.45, 0.7, 0.55, "l"]));

  function blocked(x, y, props = []) {
    if (x < 1.35 || x > 62.65 || y < 1.65 || y > 42.65) return true;
    for (let i = 0; i < SOL.length; i++) {
      const s = SOL[i];
      if (x > s[0] - 0.32 && x < s[0] + s[2] + 0.32 && y > s[1] - 0.15 && y < s[1] + s[3] + 0.32) {
        return true;
      }
    }
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (Math.hypot(x - p.x, y - p.z) < 0.65) return true;
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

  /* ==========================================================================
     1. INDOOR BUILDING MAP
     ========================================================================== */
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
        const base = (x + y) % 2 ? "#323c59" : "#374261";
        wr(base, x * T, y * T, T, T);
        wr("#242c42", x * T, y * T, T, 1);
        wr("#242c42", x * T, y * T, 1, T);
        wr("rgba(255,255,255,0.04)", x * T + 1, y * T + 1, T - 1, 1);
        if (sr() < 0.25) {
          wr("rgba(0,0,0,0.18)", x * T + 3 + Math.floor(sr() * 10), y * T + 3 + Math.floor(sr() * 10), 2, 1);
        }
      }
    }

    ZN.forEach((z) => {
      for (let y = z[2]; y < z[2] + z[4]; y++) {
        for (let x = z[1]; x < z[1] + z[3]; x++) {
          wr((x + y) % 2 ? z[5] : z[6], x * T, y * T, T, T);
          wr("rgba(0,0,0,0.12)", x * T, y * T, T, 1);
          wr("rgba(0,0,0,0.12)", x * T, y * T, 1, T);
          if (sr() < 0.22) {
            wr("rgba(255,255,255,0.03)", x * T + Math.floor(sr() * 12), y * T + Math.floor(sr() * 12), 3, 2);
          }
        }
      }
      const zx = z[1] * T, zy = z[2] * T, zw = z[3] * T, zh = z[4] * T;
      wr("#1e253b", zx - 2, zy - 2, zw + 4, 2);
      wr("#1e253b", zx - 2, zy + zh, zw + 4, 2);
      wr("rgba(255,255,255,0.08)", zx, zy, zw, 2);
      wr("rgba(0,0,0,0.35)", zx, zy + zh - 3, zw, 3);
    });

    wr("#362952", 2 * T, 21 * T, 60 * T, 2 * T);
    wr("#291f40", 2 * T, 21 * T + 3, 60 * T, 2 * T - 6);
    wr("#e6bd37", 2 * T, 21 * T, 60 * T, 1);
    wr("#9e7d19", 2 * T, 21 * T + 1, 60 * T, 1);
    wr("#e6bd37", 2 * T, 23 * T - 1, 60 * T, 1);
    for (let x = 3 * T; x < 62 * T; x += 48) {
      wr("#52437d", x, 22 * T - 1, 24, 2);
      wr("#e6bd37", x + 10, 22 * T - 1, 4, 2);
    }

    blobOn(wx, "rgba(0,0,0,0.45)", 32 * T, 22 * T + 5, 26, 10);
    blobOn(wx, "#2e244a", 32 * T, 22 * T + 4, 24, 9);
    blobOn(wx, "#4e407a", 32 * T, 22 * T + 3, 19, 7);
    blobOn(wx, "#6c5ba3", 32 * T, 22 * T + 2, 14, 5);

    GL.forEach((g) => {
      const px = g[0] * T, py = g[1] * T;
      blobOn(wx, "rgba(0,0,0,0.4)", px, py, 6, 3);
      wr("#262f47", px - 4, py - 14, 8, 14);
      wr("#485780", px - 3, py - 14, 4, 14);
      wr("#6b7fb3", px - 4, py - 15, 8, 2);
      wr("#ffd23f", px - 1, py - 10, 2, 3);
    });

    for (let x = 0; x < MW; x++) {
      for (let y = 0; y < MH; y++) {
        const isExitDoor = x === MW - 1 && ((y >= 11 && y <= 13) || (y >= 30 && y <= 32));
        if (x === 0 || y === 0 || y === MH - 1 || (x === MW - 1 && !isExitDoor)) {
          wr((x + y) % 2 ? "#0d1020" : "#12162a", x * T, y * T, T, T);
          wr("#252d4a", x * T, y * T, T, 2);
          wr("#7a8cb8", x * T, y * T + T - 2, T, 2);
          if (((y === 0 || y === MH - 1) && x % 3 === 1) || ((x === 0 || x === MW - 1) && y % 3 === 1)) {
            wr("#1b2a4a", x * T + 2, y * T + 3, T - 4, T - 8);
            wr("#4f86b8", x * T + 3, y * T + 4, T - 6, T - 10);
            wr("#9cd4ff", x * T + 4, y * T + 5, 3, 2);
          }
        }
      }
    }

    SOL.forEach((s) => {
      const x = s[0] * T, y = s[1] * T, w = s[2] * T, h = s[3] * T, t = s[4];
      if (t === "l") return;

      wr("rgba(0,0,0,0.38)", x + 2, y + h - 1, w, 4);

      if (t === "s") {
        wr("#2a1b18", x, y + 6, w, h - 6);
        wr("#6e3b2e", x + 2, y + 6, w - 4, h - 9);
        wr("#8f5040", x + 4, y + 7, w - 8, h - 12);
        wr("#1a2038", x + 16, y, w - 32, 8);
        wr("#38bdf8", x + 18, y + 1, w - 36, 5);
        wr("#e0f2fe", x + 20, y + 2, 12, 1);
      }
      if (t === "k") {
        wr("#593e25", x, y + 10, w, h - 10);
        wr("#e2d9c8", x, y + 10, w, 5);
        wr("#ffffff", x + 1, y + 10, w - 2, 1);
        wr("#1e2430", x + 6, y + 1, 12, 9);
        wr("#475569", x + 7, y + 2, 10, 3);
        wr("#ef4444", x + 9, y + 3, 2, 2);
        wr("#22c55e", x + 13, y + 3, 2, 2);
      }
      if (t === "g") {
        wr("#111622", x, y, w, h);
        wr("#283247", x, y, w, 5);
        wr("#475569", x + 1, y + 1, w - 2, 1);
        for (let i = 4; i < w - 4; i += 6) {
          wr("#1e2638", x + i, y + 7, 4, h - 9);
          for (let r = 0; r < 3; r++) {
            const led = ["#22c55e", "#38bdf8", "#facc15", "#ef4444"][(i / 6 + r) % 4 | 0];
            wr(led, x + i + 1, y + 9 + r * 7, 2, 2);
          }
        }
      }
      if (t === "j") {
        wr("#785a3a", x, y + 10, w, h - 10);
        wr("#a88259", x, y + 10, w, 4);
        wr("#c79f73", x + 1, y + 10, w - 2, 1);
        for (let i = 6; i < w - 12; i += 26) {
          wr("#1e293b", x + i, y, 14, 10);
          wr("#38bdf8", x + i + 1, y + 1, 12, 6);
          wr("#bae6fd", x + i + 2, y + 2, 5, 1);
          wr("#334155", x + i + 2, y + 11, 10, 2);
        }
      }
      if (t === "b") {
        wr("#3b4966", x, y + 6, w, h - 6);
        wr("#6478a1", x, y + 6, w, 5);
        wr("#94a8d1", x + 1, y + 6, w - 2, 1);
        wr("#facc15", x + 10, y + 13, w - 20, 3);
        wr("#1e293b", x + 12, y, 14, 6);
        wr("#5ee38b", x + 13, y + 1, 12, 3);
      }
    });

    wr("#7fb4d8", 1 * T, 33 * T - 4, 11 * T, 3);

    for (let i = 0; i < 68; i++) {
      BULBS.push([
        20 + i * 15,
        12 * T - 6 + Math.round(Math.sin(i * 0.5) * 5),
        ["#ffd23f", "#ff7a8a", "#7ee08a", "#6bb7ff"][i % 4]
      ]);
    }
  })();

  /* ==========================================================================
     2. OUTDOOR LOBBY STREET
     ========================================================================== */
  const LW = 48 * T, LH = 34 * T;
  const lc = document.createElement("canvas");
  lc.width = LW;
  lc.height = LH;
  const lx = lc.getContext("2d");
  const LSOL = [], LAMPS = [], NEON = [], WINL = [], LOBJ = [], VEH = [];
  let vehT = 1, LS = null;

  const lr = (c, x, y, w, h) => { lx.fillStyle = c; lx.fillRect(x, y, w, h); };

  function mk(w, h, fn) {
    const c = document.createElement("canvas");
    c.width = w + 2;
    c.height = h + 2;
    const X = c.getContext("2d");
    X.translate(1, 1);
    fn((col, x, y, ww, hh) => { X.fillStyle = col; X.fillRect(x, y, ww, hh); });
    X.setTransform(1, 0, 0, 1, 0, 0);
    if (outline) outline(c);
    return c;
  }

  function initStreetSprites() {
    LS = {
      lamp: mk(12, 50, (r) => {
        r("#1e2430", 3, 46, 6, 4);
        r("#333c4d", 5, 9, 2, 37);
        r("#4b5569", 4, 7, 4, 3);
        r("#2b3240", 1, 5, 10, 3);
        r("#fef08a", 2, 8, 8, 2);
      }),
      tree: mk(32, 44, (r) => {
        r("#3b281c", 14, 29, 4, 14);
        r("#5c3f2d", 15, 29, 2, 14);
        r("#143d2e", 4, 12, 24, 17);
        r("#1d5440", 7, 6, 18, 12);
        r("#297358", 9, 9, 12, 8);
        r("#3da17c", 11, 8, 6, 4);
        [[7, 15, "#ffd23f"], [23, 14, "#ff7a8a"], [12, 23, "#5cc8ff"], [21, 24, "#ffd23f"]].forEach((d) => r(d[2], d[0], d[1], 2, 2));
      }),
      bench: mk(38, 18, (r) => {
        r("#1e2430", 3, 11, 2, 6);
        r("#1e2430", 33, 11, 2, 6);
        r("#784922", 0, 7, 38, 4);
        r("#a86d3b", 1, 1, 36, 5);
        r("#c98a55", 2, 2, 34, 1);
      }),
      vend: mk(20, 32, (r) => {
        r("#991b1b", 0, 0, 20, 32);
        r("#dc2626", 1, 1, 14, 30);
        r("#bae6fd", 3, 4, 14, 15);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            r(["#ff7a1a", "#22c55e", "#facc15", "#38bdf8"][(i + j * 2) % 4], 4 + i * 4, 5 + j * 4, 3, 3);
          }
        }
        r("#1e293b", 3, 21, 14, 4);
        r("#22c55e", 4, 22, 2, 2);
      }),
      bin: mk(12, 16, (r) => {
        r("#1e4d32", 2, 4, 8, 11);
        r("#2e734b", 3, 5, 4, 9);
        r("#3da166", 1, 1, 10, 3);
      }),
      cart: mk(46, 34, (r) => {
        r("#111", 6, 27, 7, 7);
        r("#555", 8, 29, 3, 3);
        r("#111", 33, 27, 7, 7);
        r("#555", 35, 29, 3, 3);
        r("#6b3e1e", 3, 14, 40, 13);
        r("#9e6234", 2, 12, 42, 3);
        r("#94a3b8", 4, 4, 1, 9);
        r("#94a3b8", 41, 4, 1, 9);
        for (let i = 0; i < 7; i++) r(i % 2 ? "#f8fafc" : "#dc2626", 2 + i * 6, 2, 6, 6);
      }),
      bus: mk(64, 44, (r) => {
        r("#334155", 0, 0, 64, 5);
        r("#64748b", 1, 1, 62, 2);
        r("#94a3b8", 3, 5, 2, 37);
        r("#94a3b8", 59, 5, 2, 37);
        r("#1e293b", 5, 6, 54, 25);
        r("#facc15", 8, 8, 21, 17);
        r("#f472b6", 35, 8, 21, 17);
        r("#784922", 10, 34, 44, 4);
      })
    };
  }

  function carSpr(col) {
    const k = "c" + col;
    return LS[k] || (LS[k] = mk(48, 24, (r) => {
      r(col, 2, 9, 44, 11);
      r(sh(col, 25), 4, 10, 40, 2);
      r(sh(col, -30), 12, 3, 24, 8);
      r("#9fd8ff", 14, 4, 9, 6);
      r("#9fd8ff", 25, 4, 9, 6);
      r("#111", 7, 17, 9, 6);
      r("#94a3b8", 10, 19, 3, 2);
      r("#111", 32, 17, 9, 6);
      r("#94a3b8", 35, 19, 3, 2);
      r("#fef08a", 44, 11, 3, 3);
      r("#ef4444", 1, 11, 2, 3);
    }));
  }

  function motoSpr(col) {
    const k = "m" + col;
    return LS[k] || (LS[k] = mk(28, 24, (r) => {
      r("#111", 1, 15, 8, 8);
      r("#111", 19, 15, 8, 8);
      r(col, 7, 11, 14, 5);
      r("#ff7a1a", 11, 0, 6, 3);
      r("#e8c9a0", 12, 3, 4, 2);
      r("#2d6cdf", 11, 5, 5, 6);
      r("#fef08a", 26, 12, 2, 2);
    }));
  }

  function makeSign(t, col) {
    const o = document.createElement("canvas"), f = document.createElement("canvas");
    lx.font = '6px "Press Start 2P",monospace';
    const w = Math.ceil(lx.measureText(t).width) + 8;
    [o, f].forEach((c, n) => {
      c.width = w;
      c.height = 10;
      const X = c.getContext("2d");
      X.fillStyle = "#120d28";
      X.fillRect(0, 0, w, 10);
      X.fillStyle = n ? "#2a2340" : col;
      X.fillRect(0, 0, w, 1);
      X.fillRect(0, 9, w, 1);
      X.fillRect(0, 0, 1, 10);
      X.fillRect(w - 1, 0, 1, 10);
      X.font = '6px "Press Start 2P",monospace';
      X.textBaseline = "top";
      X.fillStyle = n ? "#4a4260" : col;
      X.fillText(t, 4, 2);
    });
    return { on: o, off: f };
  }

  (function buildLobbyStreet() {
    initStreetSprites();
    let seed = 77;
    const sr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    lr("#0a071c", 0, 0, LW, 20);
    lr("#120d30", 0, 20, LW, 16);
    lr("#1a1242", 0, 36, LW, 16);
    lr("#241754", 0, 52, LW, 92);
    for (let i = 0; i < 95; i++) {
      lr(sr() < 0.5 ? "#fff" : "#8c86b8", Math.floor(sr() * LW), Math.floor(sr() * 38), 1, 1);
    }
    blobOn(lx, "#fef08a", 690, 22, 9, 9);

    const BW = [7, 6, 8, 7, 6, 7, 7];
    const PAL = ["#3a2f5c", "#4a3558", "#2f3b66", "#523a4c", "#2d4a5c", "#40355f", "#3b4a52"];
    const CA = ["#e03a4a", "#2d8a4e", "#2d6cdf", "#ffd23f", "#2d8a4e", "#e03a4a", "#8a5ab8"];
    const SHOP = [
      ["INDOMAUT", "#ff7a8a", "#ffcf6a"],
      ["KOPI KENAPA", "#7ee08a", "#ffb86a"],
      ["ALFAMIDNITE", "#5cc8ff", "#d8f4ff"],
      ["BARBER KING", "#ffd23f", "#ffe9b0"],
      ["APOTEK K-25", "#5ee38b", "#c8ffd8"],
      ["STARBAKSO", "#ff9a3c", "#ffd7a0"],
      ["TOKOPEDEH", "#b78cff", "#6a7080"]
    ];
    let bx = 0;
    for (let i = 0; i < 7; i++) {
      const bw = BW[i] * T, yb = 30 + Math.floor(sr() * 16), wall = PAL[i], sp = SHOP[i];
      lr(wall, bx, yb, bw, 144 - yb);
      lr(sh(wall, 32), bx, yb, bw, 3);
      lr(sh(wall, -25), bx + bw - 3, yb, 3, 144 - yb);

      const nw = Math.floor((bw - 8) / 16);
      for (let rw = 0; rw < 2; rw++) {
        for (let k = 0; k < nw; k++) {
          const wx2 = bx + 6 + k * 16, wy = yb + 8 + rw * 20, lit = sr() < 0.6;
          lr(lit ? "#ffd77a" : "#161129", wx2, wy, 10, 12);
          if (lit) WINL.push([wx2 + 5, wy + 6]);
        }
      }
      const gx = bx + 8, gw = bw - 26;
      lr("#120d28", bx, 104, bw, 40);
      lr(sp[2], gx, 110, gw, 32);
      for (let k = gx - 4; k < gx + gw + 4; k += 6) {
        const odd = (((k - gx) / 6) | 0) % 2;
        lr(odd ? "#f4efdc" : CA[i], k, 100, 6, 8);
      }
      const sg = makeSign(sp[0], sp[1]), nx = bx + ((bw - sg.on.width) >> 1);
      NEON.push({ x: nx, y: 89, on: sg.on, off: sg.off, fl: i % 3 === 2 });
      bx += bw;
    }

    for (let y = 144; y < 224; y += 16) {
      for (let x = 0; x < LW; x += 16) {
        lr(((x + y) >> 4) % 2 ? "#3a3650" : "#433e5c", x, y, 16, 16);
        lr("rgba(255,255,255,0.04)", x, y, 16, 1);
      }
    }
    lr("#524d6e", 0, 224, LW, 7);
    lr("#23212c", 0, 231, LW, 159);
    for (let x = 0; x < LW; x += 26) lr("#e6bd37", x, 309, 16, 2);
    for (let y = 240; y < 382; y += 10) lr("#d4d4e6", 352, y, 48, 5);
    lr("#524d6e", 0, 390, LW, 4);
    for (let y = 394; y < 480; y += 16) {
      for (let x = 0; x < LW; x += 16) {
        lr(((x + y) >> 4) % 2 ? "#3a3650" : "#433e5c", x, y, 16, 16);
      }
    }
    lr("#1a1533", 0, 480, LW, 64);

    const OB = [
      ["tree", 2.6, 13.2, 0.9, 0.6],
      ["tree", 45.4, 13.2, 0.9, 0.6],
      ["tree", 5, 28.2, 0.9, 0.6],
      ["tree", 44, 28, 0.9, 0.6],
      ["bench", 11, 12.6, 2.4, 0.8],
      ["bench", 40, 28.6, 2.4, 0.8],
      ["vend", 24.5, 10.9, 1.8, 0.9],
      ["bin", 28.6, 11.5, 0.9, 0.6],
      ["cart", 18, 29.2, 2.8, 1.0],
      ["bus", 37, 12.9, 0, 0],
      ["car", 9, 23.8, 2.9, 1.1, "#c0303c"],
      ["car", 31, 23.8, 2.9, 1.1, "#2d6cdf"]
    ];
    OB.forEach((o) => {
      const c = o[0] === "car" ? carSpr(o[5]) : LS[o[0]];
      const px = Math.round(o[1] * T), pz = Math.round(o[2] * T);
      blobOn(lx, "rgba(0,0,0,0.35)", px, pz - 1, Math.max(3, (c.width >> 1) - 3), 2);
      LOBJ.push({ c, px, pz, z: o[2], k: o[0] });
      if (o[3]) LSOL.push([o[1] - o[3] / 2, o[2] - o[4], o[3], o[4]]);
    });

    [[5, 13.4], [17, 13.4], [29, 13.4], [41, 13.4], [11, 27.8], [23, 27.8], [35, 27.8]].forEach((l, n) => {
      const px = Math.round(l[0] * T), pz = Math.round(l[1] * T);
      blobOn(lx, "rgba(0,0,0,0.35)", px, pz - 1, 5, 2);
      LOBJ.push({ c: LS.lamp, px, pz, z: l[1], k: "lamp" });
      LAMPS.push({ x: px, y: pz - 41, gz: pz, n });
      LSOL.push([l[0] - 0.35, l[1] - 0.45, 0.7, 0.6]);
    });
  })();

  function lobbyBlocked(x, z) {
    if (x < 1.5 || x > 46.5 || z < 10.9 || z > 29.3) return true;
    for (let i = 0; i < LSOL.length; i++) {
      const s = LSOL[i];
      if (x > s[0] - 0.35 && x < s[0] + s[2] + 0.35 && z > s[1] - 0.25 && z < s[1] + s[3] + 0.35) {
        return true;
      }
    }
    return false;
  }

  function stepStreetTraffic(dt) {
    vehT -= dt;
    if (vehT <= 0 && VEH.length < 3) {
      vehT = rnd(3, 7);
      const d = R() < 0.5 ? 1 : -1;
      const cols = ["#c0303c", "#2d6cdf", "#e0b840", "#4aa86a", "#f4efdc", "#8a5ab8"];
      VEH.push({
        x: d > 0 ? -50 : LW + 50,
        z: d > 0 ? 17.9 : 22.4,
        dir: d,
        sp: rnd(95, 145),
        moto: R() < 0.38,
        col: cols[Math.floor(R() * cols.length)]
      });
    }
    VEH.forEach((v) => { v.x += v.dir * v.sp * dt; });
    for (let i = VEH.length - 1; i >= 0; i--) {
      if (VEH[i].x < -80 || VEH[i].x > LW + 80) VEH.splice(i, 1);
    }
  }

  function renderStreetLayer(ctx, camX, camY, VW, VH, tclock, drawList) {
    LOBJ.forEach((o) => {
      if (o.px < camX - 60 || o.px > camX + VW + 60 || o.pz < camY || o.pz > camY + VH + 70) return;
      drawList.push({
        y: o.z,
        f: () => {
          ctx.drawImage(o.c, Math.round(o.px - (o.c.width >> 1) - camX), Math.round(o.pz - o.c.height + 1 - camY));
          if (o.k === "cart") {
            for (let i = 0; i < 3; i++) {
              const t = (tclock * 0.45 + i / 3) % 1;
              ctx.fillStyle = `rgba(255,255,255,${(1 - t) * 0.45})`;
              ctx.fillRect(Math.round(o.px - camX - 2 + Math.sin(t * 6 + i) * 3), Math.round(o.pz - camY - 28 - t * 16), 2, 2);
            }
          }
        }
      });
    });

    VEH.forEach((v) => {
      drawList.push({
        y: v.z,
        f: () => {
          const c = v.moto ? motoSpr(v.col) : carSpr(v.col);
          const px = Math.round(v.x - camX), py = Math.round(v.z * T - camY);
          ctx.fillStyle = "rgba(0,0,0,0.38)";
          ctx.fillRect(px - (c.width >> 1) + 2, py - 2, c.width - 4, 3);
          ctx.save();
          ctx.translate(px, py);
          if (v.dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(c, -(c.width >> 1), -c.height + 1);
          ctx.restore();
        }
      });
    });
  }

  function renderStreetLights(ctx, camX, camY, VW, VH, tclock) {
    LAMPS.forEach((l) => {
      const x = l.x - camX, y = l.gz - camY - 10;
      if (x < -70 || x > VW + 70 || y < -70 || y > VH + 70) return;
      const f = l.n === 2 && Math.sin(tclock * 23) * Math.sin(tclock * 3.1) > 0.82 ? 0.25 : 1;
      ctx.fillStyle = `rgba(255,190,90,${0.06 * f})`;
      [56, 40, 26].forEach((r) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.55, 0, 0, 6.3);
        ctx.fill();
      });
    });

    NEON.forEach((n, i) => {
      const x = n.x - camX, y = n.y - camY;
      if (x < -90 || x > VW + 10 || y < -20 || y > VH + 10) return;
      if (!(n.fl && Math.sin(tclock * 17 + i * 3) > 0.55)) ctx.drawImage(n.on, x, y);
    });
  }

  /* ==========================================================================
     3. MINIMAP & SKYLINE
     ========================================================================== */
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
      if (e.id === snap.you.id) d("#ffffff", e.x, e.z, 5);
      else if (e.team === "GUARD" && snap.you.team !== "GUARD") d("#ffd23f", e.x, e.z, 5);
    });
  }

  const ST = [];
  for (let i = 0; i < 65; i++) ST.push([R(), R() * 0.65, R()]);
  const SKYLINE = [
    { x: 0.00, w: 0.14, h: 0.42 }, { x: 0.12, w: 0.16, h: 0.56 },
    { x: 0.26, w: 0.13, h: 0.36 }, { x: 0.37, w: 0.18, h: 0.62 },
    { x: 0.53, w: 0.15, h: 0.48 }, { x: 0.66, w: 0.17, h: 0.58 },
    { x: 0.81, w: 0.19, h: 0.44 }
  ];

  function drawSky(ctx, VW, VH, tclock) {
    ctx.fillStyle = "#120d2e"; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#1d1445"; ctx.fillRect(0, VH * 0.35, VW, VH * 0.25);
    ctx.fillStyle = "#2a1b5a"; ctx.fillRect(0, VH * 0.6, VW, VH * 0.4);

    ST.forEach((s) => {
      ctx.fillStyle = Math.sin(tclock * 3 + s[2] * 20) > 0 ? "#fff" : "#8c86b8";
      ctx.fillRect(Math.floor(s[0] * VW), Math.floor(s[1] * VH), 1, 1);
    });

    blobOn(ctx, "#ffe9a8", VW - 36, 28, 11, 11);
    blobOn(ctx, "#120d2e", VW - 30, 24, 10, 10);

    SKYLINE.forEach((b, idx) => {
      const bx = Math.floor(b.x * VW), bw = Math.ceil(b.w * VW), bh = Math.floor(b.h * VH * 0.72), by = VH - bh;
      ctx.fillStyle = idx % 2 ? "#161036" : "#1c1542";
      ctx.fillRect(bx, by, bw, bh);
      for (let wy = by + 5; wy < VH - 8; wy += 6) {
        for (let wx2 = bx + 3; wx2 < bx + bw - 4; wx2 += 5) {
          const hash = (wx2 * 13 + wy * 7 + idx) % 11;
          if (hash < 4) {
            ctx.fillStyle = hash === 0 ? "#ffd23f" : "#6bb7ff";
            ctx.fillRect(wx2, wy, 2, 3);
          }
        }
      }
    });

    ctx.fillStyle = "#0b0716";
    ctx.fillRect(0, VH - 6, VW, 6);
  }

  /* ==========================================================================
     4. CHARACTER, EMOTE BUBBLE & PROP RENDERING (CACHED LABELS = 60 FPS)
     ========================================================================== */
  const LABEL_CACHE = new Map();
  function getCachedLabel(name, color) {
    const txt = String(name || "").slice(0, 10);
    const key = `${txt}_${color}`;
    let c = LABEL_CACHE.get(key);
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
      if (LABEL_CACHE.size > 80) LABEL_CACHE.clear();
      LABEL_CACHE.set(key, c);
    }
    return c;
  }

  function drawEmoteBubble(ctx, em, px, py, jy = 0) {
    if (!em) return;
    const bx = Math.round(px - 8);
    const by = Math.round(py - 50 - jy);

    ctx.fillStyle = "#0b0716";
    ctx.fillRect(bx - 1, by - 1, 18, 14);
    ctx.fillRect(bx + 5, by + 13, 6, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx, by, 16, 12);
    ctx.fillRect(bx + 6, by + 12, 4, 2);

    if (em === 1) {
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(bx + 4, by + 2, 8, 8);
      ctx.fillStyle = "#111";
      ctx.fillRect(bx + 5, by + 4, 2, 2);
      ctx.fillRect(bx + 9, by + 4, 2, 2);
      ctx.fillRect(bx + 5, by + 7, 6, 1);
      ctx.fillRect(bx + 6, by + 8, 4, 1);
    } else if (em === 2) {
      ctx.fillStyle = "#ff3b5c";
      ctx.fillRect(bx + 4, by + 3, 3, 3);
      ctx.fillRect(bx + 9, by + 3, 3, 3);
      ctx.fillRect(bx + 3, by + 4, 10, 3);
      ctx.fillRect(bx + 5, by + 7, 6, 2);
      ctx.fillRect(bx + 7, by + 9, 2, 1);
    } else if (em === 3) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(bx + 7, by + 2, 2, 5);
      ctx.fillRect(bx + 7, by + 9, 2, 2);
    }
  }

  function drawAvatarLabel(ctx, a, px, py, dir, fr, name, color = "#fff", jy = 0, em = 0) {
    const c = spr(a, dir, fr);
    const rx = Math.round(px);
    const ry = Math.round(py);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(rx - 5, ry - 1, 10, 2);
    ctx.drawImage(c, rx - 12, ry - 34 - Math.round(jy));

    if (name) {
      const lbl = getCachedLabel(name, color);
      ctx.drawImage(lbl, rx - 38, ry - 44 - Math.round(jy));
    }
    if (em) drawEmoteBubble(ctx, em, rx, ry, jy);
  }

  function drawPropSprite(ctx, type, px, py) {
    const c = prop(type);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(Math.round(px - c.width * 0.4), Math.round(py - 2), Math.round(c.width * 0.8), 3);
    ctx.drawImage(c, Math.round(px - c.width / 2), Math.round(py - c.height + 1));
  }

  W.MS_WORLD = {
    wc, lc, LW, LH, GL, BULBS,
    blocked, lobbyBlocked,
    drawSky, drawAvatarLabel, drawPropSprite, drawMinimap,
    stepStreetTraffic, renderStreetLayer, renderStreetLights
  };
})(window);
