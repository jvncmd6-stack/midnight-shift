(function (W) {
  "use strict";
  const { R, rnd, T, sh } = W.MS_CFG;
  const { outline } = W.MS_SPR;
  const { blobOn } = W.MS_WORLD_INDOOR;

  const LW = 48 * T, LH = 34 * T;
  const lc = document.createElement("canvas");
  lc.width = LW;
  lc.height = LH;
  const lx = lc.getContext("2d");
  const LSOL = [], LAMPS = [], NEON = [], LOBJ = [], VEH = [];
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
        r("#1e2430", 3, 46, 6, 4); r("#333c4d", 5, 9, 2, 37);
        r("#4b5569", 4, 7, 4, 3); r("#2b3240", 1, 5, 10, 3); r("#fef08a", 2, 8, 8, 2);
      }),
      tree: mk(32, 44, (r) => {
        r("#3b281c", 14, 29, 4, 14); r("#143d2e", 4, 12, 24, 17);
        r("#1d5440", 7, 6, 18, 12); r("#297358", 9, 9, 12, 8);
      }),
      bench: mk(38, 18, (r) => {
        r("#1e2430", 3, 11, 2, 6); r("#1e2430", 33, 11, 2, 6);
        r("#784922", 0, 7, 38, 4); r("#a86d3b", 1, 1, 36, 5);
      }),
      vend: mk(20, 32, (r) => {
        r("#991b1b", 0, 0, 20, 32); r("#dc2626", 1, 1, 14, 30);
        r("#bae6fd", 3, 4, 14, 15); r("#1e293b", 3, 21, 14, 4); r("#22c55e", 4, 22, 2, 2);
      }),
      bin: mk(12, 16, (r) => { r("#1e4d32", 2, 4, 8, 11); r("#3da166", 1, 1, 10, 3); }),
      cart: mk(46, 34, (r) => {
        r("#111", 6, 27, 7, 7); r("#111", 33, 27, 7, 7);
        r("#6b3e1e", 3, 14, 40, 13); r("#9e6234", 2, 12, 42, 3);
        for (let i = 0; i < 7; i++) r(i % 2 ? "#f8fafc" : "#dc2626", 2 + i * 6, 2, 6, 6);
      }),
      bus: mk(64, 44, (r) => {
        r("#334155", 0, 0, 64, 5); r("#94a3b8", 3, 5, 2, 37); r("#94a3b8", 59, 5, 2, 37);
        r("#1e293b", 5, 6, 54, 25); r("#facc15", 8, 8, 21, 17); r("#f472b6", 35, 8, 21, 17);
      })
    };
  }

  function carSpr(col) {
    const k = "c" + col;
    return LS[k] || (LS[k] = mk(48, 24, (r) => {
      r(col, 2, 9, 44, 11); r(sh(col, -30), 12, 3, 24, 8);
      r("#9fd8ff", 14, 4, 9, 6); r("#9fd8ff", 25, 4, 9, 6);
      r("#111", 7, 17, 9, 6); r("#111", 32, 17, 9, 6);
      r("#fef08a", 44, 11, 3, 3); r("#ef4444", 1, 11, 2, 3);
    }));
  }

  function motoSpr(col) {
    const k = "m" + col;
    return LS[k] || (LS[k] = mk(28, 24, (r) => {
      r("#111", 1, 15, 8, 8); r("#111", 19, 15, 8, 8);
      r(col, 7, 11, 14, 5); r("#ff7a1a", 11, 0, 6, 3); r("#2d6cdf", 11, 5, 5, 6);
    }));
  }

  function makeSign(t, col) {
    const o = document.createElement("canvas");
    lx.font = '6px "Press Start 2P",monospace';
    const w = Math.ceil(lx.measureText(t).width) + 8;
    o.width = w; o.height = 10;
    const X = o.getContext("2d");
    X.fillStyle = "#120d28"; X.fillRect(0, 0, w, 10);
    X.fillStyle = col; X.fillRect(0, 0, w, 1); X.fillRect(0, 9, w, 1);
    X.font = '6px "Press Start 2P",monospace'; X.textBaseline = "top"; X.fillText(t, 4, 2);
    return o;
  }

  (function buildLobbyStreet() {
    initStreetSprites();
    let seed = 77;
    const sr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    lr("#0a071c", 0, 0, LW, 20); lr("#120d30", 0, 20, LW, 16);
    lr("#1a1242", 0, 36, LW, 16); lr("#241754", 0, 52, LW, 92);
    for (let i = 0; i < 95; i++) lr(sr() < 0.5 ? "#fff" : "#8c86b8", Math.floor(sr() * LW), Math.floor(sr() * 38), 1, 1);
    blobOn(lx, "#fef08a", 690, 22, 9, 9);

    const BW = [7, 6, 8, 7, 6, 7, 7];
    const PAL = ["#3a2f5c", "#4a3558", "#2f3b66", "#523a4c", "#2d4a5c", "#40355f", "#3b4a52"];
    const CA = ["#e03a4a", "#2d8a4e", "#2d6cdf", "#ffd23f", "#2d8a4e", "#e03a4a", "#8a5ab8"];
    const SHOP = [
      ["INDOMAUT", "#ff7a8a", "#ffcf6a"], ["KOPI KENAPA", "#7ee08a", "#ffb86a"],
      ["ALFAMIDNITE", "#5cc8ff", "#d8f4ff"], ["BARBER KING", "#ffd23f", "#ffe9b0"],
      ["APOTEK K-25", "#5ee38b", "#c8ffd8"], ["STARBAKSO", "#ff9a3c", "#ffd7a0"],
      ["TOKOPEDEH", "#b78cff", "#6a7080"]
    ];
    let bx = 0;
    for (let i = 0; i < 7; i++) {
      const bw = BW[i] * T, yb = 30 + Math.floor(sr() * 16), wall = PAL[i], sp = SHOP[i];
      lr(wall, bx, yb, bw, 144 - yb);
      const nw = Math.floor((bw - 8) / 16);
      for (let rw = 0; rw < 2; rw++) {
        for (let k = 0; k < nw; k++) lr(sr() < 0.6 ? "#ffd77a" : "#161129", bx + 6 + k * 16, yb + 8 + rw * 20, 10, 12);
      }
      const gx = bx + 8, gw = bw - 26;
      lr("#120d28", bx, 104, bw, 40); lr(sp[2], gx, 110, gw, 32);
      for (let k = gx - 4; k < gx + gw + 4; k += 6) lr((((k - gx) / 6) | 0) % 2 ? "#f4efdc" : CA[i], k, 100, 6, 8);
      const sg = makeSign(sp[0], sp[1]);
      NEON.push({ x: bx + ((bw - sg.width) >> 1), y: 89, on: sg, fl: i % 3 === 2 });
      bx += bw;
    }

    for (let y = 144; y < 224; y += 16) for (let x = 0; x < LW; x += 16) lr(((x + y) >> 4) % 2 ? "#3a3650" : "#433e5c", x, y, 16, 16);
    lr("#524d6e", 0, 224, LW, 7); lr("#23212c", 0, 231, LW, 159);
    for (let x = 0; x < LW; x += 26) lr("#e6bd37", x, 309, 16, 2);
    for (let y = 240; y < 382; y += 10) lr("#d4d4e6", 352, y, 48, 5);
    lr("#524d6e", 0, 390, LW, 4);
    for (let y = 394; y < 480; y += 16) for (let x = 0; x < LW; x += 16) lr(((x + y) >> 4) % 2 ? "#3a3650" : "#433e5c", x, y, 16, 16);
    lr("#1a1533", 0, 480, LW, 64);

    const OB = [
      ["tree", 2.6, 13.2, 0.9, 0.6], ["tree", 45.4, 13.2, 0.9, 0.6], ["tree", 5, 28.2, 0.9, 0.6],
      ["tree", 44, 28, 0.9, 0.6], ["bench", 11, 12.6, 2.4, 0.8], ["bench", 40, 28.6, 2.4, 0.8],
      ["vend", 24.5, 10.9, 1.8, 0.9], ["bin", 28.6, 11.5, 0.9, 0.6], ["cart", 18, 29.2, 2.8, 1.0],
      ["bus", 37, 12.9, 0, 0], ["car", 9, 23.8, 2.9, 1.1, "#c0303c"], ["car", 31, 23.8, 2.9, 1.1, "#2d6cdf"]
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
      LOBJ.push({ c: LS.lamp, px, pz, z: l[1], k: "lamp" });
      LAMPS.push({ x: px, gz: pz, n });
      LSOL.push([l[0] - 0.35, l[1] - 0.45, 0.7, 0.6]);
    });
  })();

  function lobbyBlocked(x, z) {
    if (x < 1.5 || x > 46.5 || z < 10.9 || z > 29.3) return true;
    for (let i = 0; i < LSOL.length; i++) {
      const s = LSOL[i];
      if (x > s[0] - 0.35 && x < s[0] + s[2] + 0.35 && z > s[1] - 0.25 && z < s[1] + s[3] + 0.35) return true;
    }
    return false;
  }

  function stepStreetTraffic(dt) {
    vehT -= dt;
    if (vehT <= 0 && VEH.length < 3) {
      vehT = rnd(3, 7);
      const d = R() < 0.5 ? 1 : -1;
      const cols = ["#c0303c", "#2d6cdf", "#e0b840", "#4aa86a", "#f4efdc", "#8a5ab8"];
      VEH.push({ x: d > 0 ? -50 : LW + 50, z: d > 0 ? 17.9 : 22.4, dir: d, sp: rnd(95, 145), moto: R() < 0.38, col: cols[Math.floor(R() * cols.length)] });
    }
    VEH.forEach((v) => { v.x += v.dir * v.sp * dt; });
    for (let i = VEH.length - 1; i >= 0; i--) if (VEH[i].x < -80 || VEH[i].x > LW + 80) VEH.splice(i, 1);
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
          ctx.save(); ctx.translate(px, py);
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
      [56, 40, 26].forEach((r) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, 6.3); ctx.fill(); });
    });
    NEON.forEach((n, i) => {
      const x = n.x - camX, y = n.y - camY;
      if (x >= -90 && x <= VW + 10 && y >= -20 && y <= VH + 10 && !(n.fl && Math.sin(tclock * 17 + i * 3) > 0.55)) {
        ctx.drawImage(n.on, x, y);
      }
    });
  }

  W.MS_WORLD_STREET = { lc, LW, LH, lobbyBlocked, stepStreetTraffic, renderStreetLayer, renderStreetLights };
})(window);
