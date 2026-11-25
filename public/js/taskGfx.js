(function (W) {
  "use strict";

  const PAL = {
    bgDark: "#050914",
    bgPanel: "#0b1222",
    borderCyan: "#38bdf8",
    borderGreen: "#22c55e",
    borderAmber: "#facc15",
    borderPurple: "#a855f7",
    textLight: "#e2e8f0",
    textMuted: "#94a3b8",
    red: "#ef4444",
    green: "#22c55e",
    amber: "#facc15",
    cyan: "#38bdf8",
    purple: "#a855f7"
  };

  function renderCrtShell({ code, title, subtitle, accent = PAL.cyan, bodyHtml }) {
    return (
      `<div style="background:${PAL.bgDark};border:3px solid ${accent};box-shadow:inset 0 0 22px rgba(56,189,248,.18),0 5px 0 #02040a;padding:10px;position:relative;overflow:hidden;font-family:inherit">` +
      // Efek Scanline CRT Retro
      `<div style="position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(0deg,rgba(0,0,0,.26) 0px,rgba(0,0,0,.26) 1px,transparent 1px,transparent 3px)"></div>` +
      // Header Bar Piksel + 3 Lampu LED
      `<div style="display:flex;align-items:center;justify-content:space-between;background:#0f172a;border:2px solid #1e293b;padding:5px 7px;margin-bottom:8px">` +
      `<div style="display:flex;gap:4px;align-items:center">` +
      `<span style="width:7px;height:7px;background:${PAL.red};box-shadow:0 0 4px ${PAL.red};display:inline-block"></span>` +
      `<span style="width:7px;height:7px;background:${PAL.amber};box-shadow:0 0 4px ${PAL.amber};display:inline-block"></span>` +
      `<span style="width:7px;height:7px;background:${PAL.green};box-shadow:0 0 4px ${PAL.green};display:inline-block"></span>` +
      `</div>` +
      `<span style="font-size:8px;color:${accent};letter-spacing:1px">${code} // ${title}</span>` +
      `</div>` +
      // Instruksi
      `<div style="background:#09101f;border-left:3px solid ${accent};padding:5px 7px;margin-bottom:8px;font-size:8.5px;color:${PAL.textLight};line-height:1.45">${subtitle}</div>` +
      // Konten Mini-Game
      `<div style="position:relative;z-index:3">${bodyHtml}</div>` +
      // Tombol Tutup
      `<button class="pb d" id="tCancel" style="margin-top:10px;width:100%;position:relative;z-index:3">✖ PUTUSKAN KONEKSI</button>` +
      `</div>`
    );
  }

  function drawPixelGrid(ctx, w, h, step = 16, color = "#0f1b33") {
    ctx.fillStyle = PAL.bgDark;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    for (let x = 4; x < w; x += step) {
      for (let y = 4; y < h; y += step) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // Bingkai sudut piksel
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, h - 2, w, 2);
  }

  function drawPixelButton(label, attrs, bg, fg, border = "#0f172a") {
    return (
      `<button class="chip" ${attrs} ` +
      `style="background:${bg};color:${fg};border:2px solid ${border};` +
      `box-shadow:inset 0 2px 0 rgba(255,255,255,.25),0 3px 0 #020617;` +
      `font-size:8.5px;padding:8px 4px;cursor:pointer">${label}</button>`
    );
  }

  function spawnPixelSparks(sparksArr, x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 1.5 + Math.random() * 3.2;
      sparksArr.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 14 + Math.floor(Math.random() * 8),
        color
      });
    }
  }

  function stepAndDrawSparks(ctx, sparksArr) {
    for (let i = sparksArr.length - 1; i >= 0; i--) {
      const s = sparksArr[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15;
      s.life--;
      if (s.life <= 0) {
        sparksArr.splice(i, 1);
        continue;
      }
      ctx.fillStyle = s.life % 2 === 0 ? "#ffffff" : s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3);
    }
  }

  W.MS_TASK_GFX = {
    PAL,
    renderCrtShell,
    drawPixelGrid,
    drawPixelButton,
    spawnPixelSparks,
    stepAndDrawSparks
  };
})(window);
