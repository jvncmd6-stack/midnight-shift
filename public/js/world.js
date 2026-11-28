(function (W) {
  "use strict";
  const { $, R, sh } = W.MS_CFG;
  const { spr, prop } = W.MS_SPR;
  const IN = W.MS_WORLD_INDOOR;
  const ST_MAP = W.MS_WORLD_STREET;

  const mb = document.createElement("canvas");
  mb.width = 128;
  mb.height = 88;
  (function buildMinimap() {
    const x = mb.getContext("2d");
    x.fillStyle = "#0b0e1a"; x.fillRect(0, 0, 128, 88);
    x.fillStyle = "#6b7aa6"; x.fillRect(2, 2, 124, 84);
    x.fillStyle = "#7d8cb8"; x.fillRect(2, 36, 124, 16);
    IN.ZN.forEach((z) => { x.fillStyle = sh(z[5], 45); x.fillRect(z[1] * 2, z[2] * 2, z[3] * 2, z[4] * 2); });
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

  const STARS = Array.from({ length: 65 }, () => [R(), R() * 0.65, R()]);
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

    STARS.forEach((s) => {
      ctx.fillStyle = Math.sin(tclock * 3 + s[2] * 20) > 0 ? "#fff" : "#8c86b8";
      ctx.fillRect(Math.floor(s[0] * VW), Math.floor(s[1] * VH), 1, 1);
    });

    IN.blobOn(ctx, "#ffe9a8", VW - 36, 28, 11, 11);
    IN.blobOn(ctx, "#120d2e", VW - 30, 24, 10, 10);

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
    ctx.fillStyle = "#0b0716"; ctx.fillRect(0, VH - 6, VW, 6);
  }

  const LABEL_CACHE = new Map();
  function getCachedLabel(name, color) {
    const txt = String(name || "").slice(0, 10);
    const key = `${txt}_${color}`;
    let c = LABEL_CACHE.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = 76; c.height = 12;
      const x = c.getContext("2d");
      x.font = '5px "Press Start 2P",monospace';
      x.textAlign = "center"; x.textBaseline = "middle";
      x.lineWidth = 2; x.strokeStyle = "#0b0716";
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
    const bx = Math.round(px - 8), by = Math.round(py - 50 - jy);
    ctx.fillStyle = "#0b0716"; ctx.fillRect(bx - 1, by - 1, 18, 14); ctx.fillRect(bx + 5, by + 13, 6, 2);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(bx, by, 16, 12); ctx.fillRect(bx + 6, by + 12, 4, 2);

    if (em === 1) {
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(bx + 4, by + 2, 8, 8);
      ctx.fillStyle = "#111"; ctx.fillRect(bx + 5, by + 4, 2, 2); ctx.fillRect(bx + 9, by + 4, 2, 2);
      ctx.fillRect(bx + 5, by + 7, 6, 1);
    } else if (em === 2) {
      ctx.fillStyle = "#ff3b5c"; ctx.fillRect(bx + 4, by + 3, 3, 3); ctx.fillRect(bx + 9, by + 3, 3, 3);
      ctx.fillRect(bx + 3, by + 4, 10, 3); ctx.fillRect(bx + 5, by + 7, 6, 2);
    } else if (em === 3) {
      ctx.fillStyle = "#ef4444"; ctx.fillRect(bx + 7, by + 2, 2, 5); ctx.fillRect(bx + 7, by + 9, 2, 2);
    }
  }

  function drawAvatarLabel(ctx, a, px, py, dir, fr, name, color = "#fff", jy = 0, em = 0) {
    const c = spr(a, dir, fr);
    const rx = Math.round(px), ry = Math.round(py);
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(rx - 5, ry - 1, 10, 2);
    ctx.drawImage(c, rx - 12, ry - 34 - Math.round(jy));
    if (name) ctx.drawImage(getCachedLabel(name, color), rx - 38, ry - 44 - Math.round(jy));
    if (em) drawEmoteBubble(ctx, em, rx, ry, jy);
  }

  function drawPropSprite(ctx, type, px, py) {
    const c = prop(type);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(Math.round(px - c.width * 0.4), Math.round(py - 2), Math.round(c.width * 0.8), 3);
    ctx.drawImage(c, Math.round(px - c.width / 2), Math.round(py - c.height + 1));
  }

  W.MS_WORLD = {
    wc: IN.wc, lc: ST_MAP.lc, LW: ST_MAP.LW, LH: ST_MAP.LH, GL: IN.GL, BULBS: IN.BULBS,
    blocked: IN.blocked, lobbyBlocked: ST_MAP.lobbyBlocked,
    drawSky, drawAvatarLabel, drawPropSprite, drawMinimap,
    stepStreetTraffic: ST_MAP.stepStreetTraffic,
    renderStreetLayer: ST_MAP.renderStreetLayer,
    renderStreetLights: ST_MAP.renderStreetLights
  };
})(window);
