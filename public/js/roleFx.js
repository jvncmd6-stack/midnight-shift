(function (W) {
  "use strict";
  const { $, openSheet, closeSheet, T } = W.MS_CFG;

  const ROLE_INFO = {
    TEKNISI: {
      badge: "🔧 TEKNISI",
      color: "#38bdf8",
      btnLabel: "RADAR",
      passive: "Mini-game terminal 35% lebih cepat & akurat.",
      active: "RADAR X-RAY (6d): Mendeteksi posisi Satpam & semua terminal menembus kegelapan!"
    },
    DOKTER: {
      badge: "🩺 DOKTER",
      color: "#22c55e",
      btnLabel: "OBATI",
      passive: "Melihat tanda [+] hijau di atas teman yang terluka (1 HP).",
      active: "OBATI TEMAN: Memulihkan nyawa teman di dekatmu kembali penuh (2 HP)."
    },
    PENYUSUP: {
      badge: "🥷 PENYUSUP",
      color: "#a855f7",
      btnLabel: "SILUMAN",
      passive: "Durasi lari cepat 4.5 detik (lebih lama) & cooldown lebih singkat.",
      active: "LANGKAH BAYANGAN: Lari cepat dengan aura siluman untuk mengecoh Satpam."
    },
    CEPU: {
      badge: "🐍 CEPU",
      color: "#ef4444",
      btnLabel: "SABO",
      passive: "Menang bersama Satpam jika 4 terminal disabotase atau warga habis.",
      active: "SABOTASE: Merusak terminal yang sudah selesai (mengurangi progres tugas tim!)."
    },
    BADUT: {
      badge: "🤡 BADUT",
      color: "#facc15",
      btnLabel: "DRAMA",
      passive: "Menang SOLO secara instan jika berhasil diusir saat Rapat Darurat!",
      active: "PANCING CURIGA: Mengeluarkan emote panik agar dicurigai & di-vote warga."
    },
    SATPAM: {
      badge: "🔦 SATPAM",
      color: "#ef4444",
      btnLabel: "PUKUL",
      passive: "Kebal kegelapan & bertugas menangkap seluruh warga sebelum kabur.",
      active: "PENTUNG: Tangkap penyusup (hati-hati stun 1.5d jika salah pukul benda asli!)."
    },
    WARGA: {
      badge: "👷 WARGA",
      color: "#cbd5e1",
      btnLabel: "FOKUS",
      passive: "Menyamar jadi properti ruangan & selesaikan seluruh terminal.",
      active: "WASPADA: Gunakan tombol merah tengah untuk memanggil Rapat Darurat."
    }
  };

  function getRoleMeta(roleName) {
    const key = String(roleName || "WARGA").toUpperCase();
    return ROLE_INFO[key] || ROLE_INFO.WARGA;
  }

  function showRoleCard(roleName) {
    const r = getRoleMeta(roleName);
    openSheet(
      `<div style="border:2px solid ${r.color};background:#080c18;padding:10px;text-align:left">` +
      `<div style="font-size:8px;color:#94a3b8;text-align:center;margin-bottom:2px">KARTU PERAN KAMU</div>` +
      `<h2 style="color:${r.color};text-align:center;margin-bottom:8px">${r.badge}</h2>` +
      `<div style="background:#0f172a;border-left:3px solid ${r.color};padding:6px;font-size:8.5px;color:#e2e8f0;line-height:1.5;margin-bottom:6px">` +
      `<b>⚡ KEAHLIAN PASIF:</b><br>${r.passive}</div>` +
      `<div style="background:#0f172a;border-left:3px solid #facc15;padding:6px;font-size:8.5px;color:#fde047;line-height:1.5;margin-bottom:10px">` +
      `<b>🎯 TOMBOL SKILL:</b><br>${r.active}</div>` +
      `<button class="pb g" id="rcOk">MENGERTI & MULAI</button>` +
      `</div>`
    );
    $("rcOk").onclick = closeSheet;
  }

  function getActionButtonLabel(me, snap, nearTerm, nearBtn) {
    if (me.team === "GUARD") return "PUKUL";
    if (nearTerm) return "TUGAS";
    if (nearBtn) return "RAPAT";

    const role = String(me.role || "WARGA").toUpperCase();
    if (role === "TEKNISI") return me.scanActive ? "RADAR ON" : "RADAR";
    if (role === "DOKTER") {
      const injuredNear = (snap.entities || []).some(
        (e) => e.id !== me.id && !e.dead && e.team === "CIVILIAN" && (e.hp || 2) < 2 && Math.hypot(e.x - me.x, e.z - me.z) < 2.6
      );
      return injuredNear ? "✚ OBATI" : "OBATI";
    }
    if (role === "CEPU") {
      const canSab = (snap.terminals || []).some((t) => t.done);
      return canSab ? "⚡ SABO" : "SABO";
    }
    if (role === "BADUT") return "DRAMA";
    if (role === "PENYUSUP") return "SILUMAN";
    return "SKILL";
  }

  function drawFloatingTag(ctx, px, py, text, bg, fg) {
    ctx.font = "bold 6px monospace";
    const w = ctx.measureText(text).width + 6;
    const x = Math.round(px - w / 2);
    const y = Math.round(py);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 3, y + 7);
  }

  function renderRoleWorldOverlays(ctx, camX, camY, VW, VH, snap, tclock) {
    const me = snap.you;
    if (!me || me.escaped) return;
    const role = String(me.role || "").toUpperCase();

    // A. Label Petunjuk Mengambang di Atas Terminal & Tombol Rapat Terdekat (Biar Tidak Bingung)
    if (me.team !== "GUARD") {
      (snap.terminals || []).forEach((t) => {
        if (t.done) return;
        const d = Math.hypot(t.x - me.x, t.z - me.z);
        if (d < 3.4) {
          const tx = t.x * T - camX;
          const ty = t.z * T - camY - 26 - Math.sin(tclock * 5) * 1.5;
          drawFloatingTag(ctx, tx, ty, d < 2.6 ? "[TUGAS]" : "TERMINAL", "#0f172a", "#facc15");
        }
      });

      const dBtn = Math.hypot(32 - me.x, 22 - me.z);
      if (dBtn < 3.4) {
        const bx = 32 * T - camX;
        const by = 22 * T - camY - 20 - Math.sin(tclock * 5) * 1.5;
        drawFloatingTag(ctx, bx, by, dBtn < 2.5 ? "[RAPAT]" : "TOMBOL RAPAT", "#7f1d1d", "#fef08a");
      }
    }

    // B. DOKTER: Ikon [+] Hijau & Lingkaran Penyembuhan pada Teman Terluka
    if (role === "DOKTER") {
      (snap.entities || []).forEach((e) => {
        if (e.id === me.id || e.dead || e.escaped || e.team === "GUARD") return;
        if ((e.hp || 2) < 2) {
          const px = Math.round(e.x * T - camX);
          const py = Math.round(e.z * T - camY - 25 - Math.sin(tclock * 6) * 2);
          ctx.fillStyle = "#22c55e";
          ctx.fillRect(px - 1, py - 4, 3, 9);
          ctx.fillRect(px - 4, py - 1, 9, 3);
          drawFloatingTag(ctx, px, py - 12, "TERLUKA", "#14532d", "#bbf7d0");
        }
      });
    }

    // C. TEKNISI: Radar Sonar X-Ray Menembus Kegelapan
    if (role === "TEKNISI" && me.scanActive) {
      const mx = Math.round(me.x * T - camX);
      const my = Math.round(me.z * T - camY - 8);
      const waveR = (tclock * 95) % 145;

      ctx.strokeStyle = "rgba(56,189,248,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, waveR, 0, Math.PI * 2);
      ctx.stroke();

      (snap.entities || []).forEach((e) => {
        if (e.dead || e.team !== "GUARD") return;
        const gx = Math.round(e.x * T - camX);
        const gy = Math.round(e.z * T - camY - 8);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.strokeRect(gx - 8, gy - 10, 16, 20);
        drawFloatingTag(ctx, gx, gy - 20, "!SATPAM", "#7f1d1d", "#fecaca");
      });

      (snap.terminals || []).forEach((t) => {
        if (t.done) return;
        const tx = Math.round(t.x * T - camX);
        const ty = Math.round(t.z * T - camY - 8);
        ctx.strokeStyle = t.sabotaged ? "#ef4444" : "#facc15";
        ctx.strokeRect(tx - 6, ty - 6, 12, 12);
      });
    }

    // D. PENYUSUP: Aura Bayangan Siluman saat Sprint
    if (role === "PENYUSUP" && me.sprinting) {
      const px = Math.round(me.x * T - camX);
      const py = Math.round(me.z * T - camY - 8);
      ctx.strokeStyle = "rgba(168,85,247,0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 7, py - 10, 14, 20);
    }
  }

  W.MS_ROLE_FX = {
    getRoleMeta,
    showRoleCard,
    getActionButtonLabel,
    renderRoleWorldOverlays
  };
})(window);
