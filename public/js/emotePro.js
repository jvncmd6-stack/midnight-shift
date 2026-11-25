(function (W) {
  "use strict";
  const { vib } = W.MS_CFG;

  const EMOTE_DEFS = {
    1: { code: "PANIC", bg: "#7f1d1d", border: "#ef4444" },
    2: { code: "LOVE",  bg: "#831843", border: "#f472b6" },
    3: { code: "LAUGH", bg: "#713f12", border: "#facc15" },
    4: { code: "SUS",   bg: "#1e1b4b", border: "#38bdf8" },
    5: { code: "ANGRY", bg: "#450a0a", border: "#f87171" },
    6: { code: "CROWN", bg: "#422006", border: "#fbbf24" }
  };

  function drawPixelHeart(ctx, cx, cy, color) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - 2, cy - 1, 2, 2);
    ctx.fillRect(cx + 1, cy - 1, 2, 2);
    ctx.fillRect(cx - 1, cy, 3, 2);
    ctx.fillRect(cx, cy + 2, 1, 1);
  }

  function drawProEmoteBubble(ctx, cx, topY, emId, clock) {
    const def = EMOTE_DEFS[emId] || EMOTE_DEFS[1];
    const pop = Math.sin(clock * 11) * 1.5;
    const bx = Math.round(cx - 10);
    const by = Math.round(topY - 17 + pop);

    ctx.fillStyle = "#050814";
    ctx.fillRect(bx - 1, by - 1, 22, 15);
    ctx.fillStyle = def.bg;
    ctx.fillRect(bx, by, 20, 13);
    ctx.strokeStyle = def.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, 19, 12);

    ctx.fillStyle = def.bg;
    ctx.fillRect(Math.round(cx - 2), by + 13, 4, 2);
    ctx.fillStyle = def.border;
    ctx.fillRect(Math.round(cx - 1), by + 15, 2, 1);

    if (emId === 1) {
      ctx.fillStyle = Math.sin(clock * 18) > 0 ? "#facc15" : "#ffffff";
      ctx.fillRect(bx + 9, by + 2, 2, 6);
      ctx.fillRect(bx + 9, by + 9, 2, 2);
      const dropY = (clock * 14) % 8;
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(bx - 4, by + 3 + Math.round(dropY), 2, 3);
      ctx.fillRect(bx + 22, by + 2 + Math.round(dropY), 2, 3);
    } else if (emId === 2) {
      drawPixelHeart(ctx, bx + 10, by + 5, "#f43f5e");
      const float1 = (clock * 12) % 10;
      drawPixelHeart(ctx, bx + 3, by - 2 - Math.round(float1), "#fb7185");
      drawPixelHeart(ctx, bx + 17, by - 4 - Math.round((float1 + 5) % 10), "#f472b6");
    } else if (emId === 3) {
      const shake = Math.round(Math.sin(clock * 22));
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 7px monospace";
      ctx.fillText("XD", bx + 5 + shake, by + 9);
    } else if (emId === 4) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 8px monospace";
      ctx.fillText("?", bx + 8, by + 10);
    } else if (emId === 5) {
      const pulse = Math.sin(clock * 16) > 0 ? 1 : 0;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(bx + 6 - pulse, by + 4, 3, 2);
      ctx.fillRect(bx + 11 + pulse, by + 4, 3, 2);
      ctx.fillRect(bx + 6 - pulse, by + 7, 3, 2);
      ctx.fillRect(bx + 11 + pulse, by + 7, 3, 2);
    } else {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(bx + 6, by + 7, 8, 3);
      ctx.fillRect(bx + 6, by + 4, 2, 3);
      ctx.fillRect(bx + 9, by + 3, 2, 4);
      ctx.fillRect(bx + 12, by + 4, 2, 3);
      if (Math.sin(clock * 14) > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bx + 2, by + 2, 2, 2);
        ctx.fillRect(bx + 17, by + 3, 2, 2);
      }
    }
  }

  function drawAvatarLabelPro(ctx, av, px, py, dir, frame, name, nameColor = "#fff", jumpY = 0, em = 0) {
    const sprite = W.MS_SPR.spr(av, dir, frame);
    const drawX = Math.round(px - sprite.width / 2);
    const drawY = Math.round(py - sprite.height + 2 - jumpY);

    ctx.save();
    if (em > 0) {
      const now = performance.now() / 1000;
      const sx = 1 + Math.sin(now * 16) * 0.06;
      const sy = 1 - Math.sin(now * 16) * 0.06;
      ctx.translate(Math.round(px), Math.round(py));
      ctx.scale(sx, sy);
      ctx.drawImage(sprite, Math.round(-sprite.width / 2), Math.round(-sprite.height + 2 - jumpY));
    } else {
      ctx.drawImage(sprite, drawX, drawY);
    }
    ctx.restore();

    if (name) {
      ctx.font = "bold 6px monospace";
      const tw = ctx.measureText(name).width;
      const pillW = tw + 6;
      const pillX = Math.round(px - pillW / 2);
      const pillY = drawY - 10;

      ctx.fillStyle = "rgba(5, 8, 20, 0.78)";
      ctx.fillRect(pillX, pillY, pillW, 9);
      ctx.fillStyle = nameColor;
      ctx.fillText(name, pillX + 3, pillY + 7);
    }

    if (em > 0) {
      drawProEmoteBubble(ctx, px, drawY - 11, em, performance.now() / 1000);
    }
  }

  function injectInGameEmoteBar() {
    if (document.getElementById("hudEmoteBar")) return;
    const hud = document.getElementById("hud");
    if (!hud) return;

    const bar = document.createElement("div");
    bar.id = "hudEmoteBar";
    bar.style.cssText =
      "position:fixed;top:38px;left:50%;transform:translateX(-50%);z-index:25;" +
      "display:flex;gap:3px;background:rgba(8,12,24,0.75);padding:2px 5px;border:1px solid #334155;border-radius:4px";

    const icons = [
      { id: 1, txt: "😱" },
      { id: 2, txt: "❤️" },
      { id: 3, txt: "😂" },
      { id: 4, txt: "🧐" },
      { id: 5, txt: "💢" },
      { id: 6, txt: "👑" }
    ];

    icons.forEach((ic) => {
      const btn = document.createElement("button");
      btn.textContent = ic.txt;
      btn.style.cssText =
        "background:#1e293b;border:1px solid #475569;color:#fff;font-size:10px;" +
        "padding:2px 4px;cursor:pointer;line-height:1";
      btn.onclick = () => {
        vib(10);
        if (W.MS_NET) W.MS_NET.sendPlayerAction("EMOTE", { emote: ic.id });
      };
      bar.appendChild(btn);
    });

    hud.appendChild(bar);
  }

  W.MS_EMOTE_PRO = { drawAvatarLabelPro, drawProEmoteBubble, injectInGameEmoteBar };

  if (W.MS_WORLD) {
    W.MS_WORLD.drawAvatarLabel = drawAvatarLabelPro;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectInGameEmoteBar);
  } else {
    injectInGameEmoteBar();
  }
})(window);
