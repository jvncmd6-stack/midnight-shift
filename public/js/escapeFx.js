(function (W) {
  "use strict";
  const { ME, getUN } = W.MS_CFG;
  const { spr } = W.MS_SPR;

  let spectateMode = false;
  let spectateIdx = 0;
  let escapeStartAt = 0;
  let confetti = [];

  function resetEscapeState() {
    spectateMode = false;
    spectateIdx = 0;
    escapeStartAt = 0;
    confetti = [];
  }

  function isSpectating() {
    return spectateMode;
  }

  function getSpectateTarget(snap) {
    const alive = (snap.entities || []).filter((e) => !e.dead && !e.escaped);
    if (!alive.length) return null;
    return alive[spectateIdx % alive.length];
  }

  function ensureControls(show, snap) {
    let wrap = document.getElementById("specControls");
    if (!show) {
      if (wrap) wrap.remove();
      return;
    }
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "specControls";
      wrap.style.cssText =
        "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:45;" +
        "display:flex;gap:6px;align-items:center";

      const btnMode = document.createElement("button");
      btnMode.id = "bSpecToggle";
      btnMode.className = "pb";
      btnMode.style.cssText =
        "width:auto;padding:8px 12px;font-size:8px;border:2px solid #38bdf8;background:#090e1c;color:#38bdf8";
      btnMode.textContent = "👁 PANTAU TEMAN";

      const btnNext = document.createElement("button");
      btnNext.id = "bSpecNext";
      btnNext.className = "pb";
      btnNext.style.cssText =
        "display:none;width:auto;padding:8px 10px;font-size:8px;border:2px solid #facc15;background:#090e1c;color:#facc15";
      btnNext.textContent = "⏭ GANTI TARGET";

      btnMode.onclick = () => {
        spectateMode = !spectateMode;
        btnMode.textContent = spectateMode ? "🎬 ANIMASI KABUR" : "👁 PANTAU TEMAN";
        btnNext.style.display = spectateMode ? "inline-block" : "none";
      };

      btnNext.onclick = () => {
        spectateIdx++;
      };

      wrap.appendChild(btnMode);
      wrap.appendChild(btnNext);
      document.body.appendChild(wrap);
    }

    const btnNext = document.getElementById("bSpecNext");
    if (btnNext && spectateMode && snap) {
      const target = getSpectateTarget(snap);
      btnNext.textContent = target ? `⏭ ${target.name.toUpperCase()}` : "⏭ SELESAI";
    }
  }

  function initConfetti(VW, groundY) {
    const palette = ["#22c55e", "#facc15", "#38bdf8", "#f472b6", "#a855f7"];
    confetti = Array.from({ length: 26 }, (_, i) => ({
      x: Math.floor(VW * 0.35) + ((i * 17) % Math.max(40, Math.floor(VW * 0.5))),
      y: groundY - 20 - (i % 5) * 12,
      vx: (Math.random() - 0.5) * 28,
      vy: -25 - Math.random() * 35,
      color: palette[i % palette.length]
    }));
  }

  function renderEscapeScene(ctx, VW, VH, snap, tclock) {
    if (!escapeStartAt) {
      escapeStartAt = tclock;
      initConfetti(VW, Math.floor(VH * 0.72));
    }
    const elapsed = tclock - escapeStartAt;
    ensureControls(true, snap);

    // 1. Langit Malam Gradasi Piksel & Bulan Sabit
    ctx.fillStyle = "#050817";
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = "#0b112b";
    ctx.fillRect(0, Math.floor(VH * 0.35), VW, Math.floor(VH * 0.4));

    // Bulan piksel
    const moonX = Math.floor(VW * 0.84);
    const moonY = Math.floor(VH * 0.16);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(moonX, moonY, 12, 12);
    ctx.fillStyle = "#050817";
    ctx.fillRect(moonX + 4, moonY - 2, 10, 10);

    // Bintang berkelip
    for (let i = 0; i < 26; i++) {
      const sx = (i * 47 + 13) % VW;
      const sy = (i * 23 + 9) % Math.max(24, Math.floor(VH * 0.48));
      ctx.fillStyle = Math.sin(tclock * 3.5 + i) > 0.2 ? "#f8fafc" : "#334155";
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 2. Gedung Kantor di Kiri + Sirine Polisi Merah-Biru
    const groundY = Math.floor(VH * 0.72);
    const bldW = Math.floor(VW * 0.32);
    const bldTop = Math.floor(VH * 0.16);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, bldTop, bldW, groundY - bldTop);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(bldW - 3, bldTop, 3, groundY - bldTop);

    for (let wy = bldTop + 10; wy < groundY - 22; wy += 14) {
      for (let wx = 6; wx < bldW - 14; wx += 13) {
        ctx.fillStyle = (wx + wy) % 26 === 0 ? "#fde047" : "#1e293b";
        ctx.fillRect(wx, wy, 7, 8);
      }
    }

    // Pintu Darurat Gedung (Hijau Menyala)
    ctx.fillStyle = "#14532d";
    ctx.fillRect(bldW - 15, groundY - 28, 15, 28);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(bldW - 13, groundY - 26, 11, 26);

    // Lampu Sirine di Atap Gedung
    const sirenPhase = Math.sin(tclock * 14) > 0;
    ctx.fillStyle = sirenPhase ? "#ef4444" : "#38bdf8";
    ctx.fillRect(bldW - 16, bldTop - 5, 10, 5);
    ctx.fillStyle = sirenPhase ? "rgba(239,68,68,0.16)" : "rgba(56,189,248,0.16)";
    ctx.fillRect(0, 0, bldW + 28, groundY);

    // 3. Trotoar & Jalan Raya Piksel
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, groundY, VW, VH - groundY);
    ctx.fillStyle = "#475569";
    ctx.fillRect(0, groundY, VW, 3);

    const dashOffset = Math.floor(tclock * 55) % 26;
    ctx.fillStyle = "#facc15";
    for (let rx = -dashOffset; rx < VW; rx += 26) {
      ctx.fillRect(rx, groundY + 14, 13, 2);
    }

    // Tiang Lampu Jalan & Kerucut Cahaya
    const lampX = Math.floor(VW * 0.82);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(lampX, groundY - 48, 3, 48);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(lampX - 5, groundY - 50, 13, 4);
    ctx.fillStyle = "rgba(254,240,138,0.11)";
    ctx.beginPath();
    ctx.moveTo(lampX + 1, groundY - 46);
    ctx.lineTo(lampX - 26, groundY);
    ctx.lineTo(lampX + 28, groundY);
    ctx.fill();

    // 4. Karakter Pemain Berlari Keluar lalu Melompat Selebrasi
    const stopX = Math.floor(VW * 0.56);
    const charX = Math.min(stopX, bldW + Math.floor(elapsed * 52));
    const arrived = charX >= stopX;
    const jumpY = arrived ? Math.abs(Math.sin(tclock * 7.5)) * 7 : 0;
    const frame = arrived ? 0 : [1, 0, 2, 0][Math.floor(tclock * 11) % 4];
    const dir = arrived ? 0 : 2;

    // Bayangan di bawah kaki karakter
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(charX - 7, groundY - 2, 14, 3);

    const avatarCanvas = spr(ME, dir, frame);
    ctx.drawImage(avatarCanvas, charX - 10, Math.round(groundY - 29 - jumpY));

    // Konfeti Piksel Perayaan
    if (arrived) {
      confetti.forEach((p) => {
        p.x += p.vx * 0.025;
        p.y += p.vy * 0.025;
        p.vy += 1.4;
        if (p.y > groundY - 2) {
          p.y = groundY - 38 - Math.random() * 20;
          p.x = stopX + (Math.random() - 0.5) * 70;
          p.vy = -22 - Math.random() * 25;
        }
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      });
    }

    // 5. Kartu Status Pixel Art "BERHASIL KABUR!"
    const boxW = Math.min(VW - 18, 214);
    const boxX = Math.floor((VW - boxW) / 2);
    const boxY = Math.max(30, Math.floor(VH * 0.13));

    ctx.fillStyle = "rgba(5,9,20,0.9)";
    ctx.fillRect(boxX, boxY, boxW, 40);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, 40);

    ctx.textAlign = "center";
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 9px monospace";
    ctx.fillText("🏃 BERHASIL KABUR!", Math.floor(VW / 2), boxY + 14);

    const aliveLeft = (snap.entities || []).filter((e) => !e.dead && !e.escaped && e.team !== "GUARD").length;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "7px monospace";
    ctx.fillText(
      aliveLeft > 0 ? `${getUN()} selamat! Menunggu ${aliveLeft} teman...` : "Semua penyintas berhasil selamat!",
      Math.floor(VW / 2),
      boxY + 29
    );
    ctx.textAlign = "left";
  }

  W.MS_ESCAPE_FX = {
    resetEscapeState,
    isSpectating,
    getSpectateTarget,
    ensureControls,
    renderEscapeScene
  };
})(window);
