(function (W) {
  "use strict";
  const { T, MW, MH, sh } = W.MS_CFG;

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
        wr((x + y) % 2 ? "#323c59" : "#374261", x * T, y * T, T, T);
        wr("#242c42", x * T, y * T, T, 1);
        wr("#242c42", x * T, y * T, 1, T);
        wr("rgba(255,255,255,0.04)", x * T + 1, y * T + 1, T - 1, 1);
        if (sr() < 0.25) wr("rgba(0,0,0,0.18)", x * T + 3 + Math.floor(sr() * 10), y * T + 3 + Math.floor(sr() * 10), 2, 1);
      }
    }

    ZN.forEach((z) => {
      for (let y = z[2]; y < z[2] + z[4]; y++) {
        for (let x = z[1]; x < z[1] + z[3]; x++) {
          wr((x + y) % 2 ? z[5] : z[6], x * T, y * T, T, T);
          wr("rgba(0,0,0,0.12)", x * T, y * T, T, 1);
          wr("rgba(0,0,0,0.12)", x * T, y * T, 1, T);
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
    wr("#e6bd37", 2 * T, 23 * T - 1, 60 * T, 1);

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
        wr("#1a2038", x + 16, y, w - 32, 8);
        wr("#38bdf8", x + 18, y + 1, w - 36, 5);
      } else if (t === "k") {
        wr("#593e25", x, y + 10, w, h - 10);
        wr("#e2d9c8", x, y + 10, w, 5);
        wr("#1e2430", x + 6, y + 1, 12, 9);
      } else if (t === "g") {
        wr("#111622", x, y, w, h);
        wr("#283247", x, y, w, 5);
        for (let i = 4; i < w - 4; i += 6) {
          wr("#1e2638", x + i, y + 7, 4, h - 9);
          wr("#22c55e", x + i + 1, y + 9, 2, 2);
          wr("#38bdf8", x + i + 1, y + 16, 2, 2);
        }
      } else if (t === "j") {
        wr("#785a3a", x, y + 10, w, h - 10);
        wr("#a88259", x, y + 10, w, 4);
        for (let i = 6; i < w - 12; i += 26) {
          wr("#1e293b", x + i, y, 14, 10);
          wr("#38bdf8", x + i + 1, y + 1, 12, 6);
        }
      } else if (t === "b") {
        wr("#3b4966", x, y + 6, w, h - 6);
        wr("#6478a1", x, y + 6, w, 5);
        wr("#1e293b", x + 12, y, 14, 6);
        wr("#5ee38b", x + 13, y + 1, 12, 3);
      }
    });

    wr("#7fb4d8", 1 * T, 33 * T - 4, 11 * T, 3);
    for (let i = 0; i < 68; i++) {
      BULBS.push([20 + i * 15, 12 * T - 6 + Math.round(Math.sin(i * 0.5) * 5), ["#ffd23f", "#ff7a8a", "#7ee08a", "#6bb7ff"][i % 4]]);
    }
  })();

  W.MS_WORLD_INDOOR = { ZN, GL, BULBS, wc, blocked, blobOn };
})(window);
