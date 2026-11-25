(function (W) {
  "use strict";

  const SPRITE_CACHE = new Map();

  function makeCanvas(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { cv, ctx };
  }

  function drawShadow(ctx, cx, y, rx, ry) {
    ctx.fillStyle = "rgba(2, 4, 12, 0.52)";
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function buildPropSprite(type) {
    const { cv, ctx } = makeCanvas(24, 28);

    if (type === "cone") {
      drawShadow(ctx, 12, 25, 6, 2);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(6, 22, 12, 3);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(7, 21, 10, 2);
      ctx.fillStyle = "#f97316";
      ctx.fillRect(8, 17, 8, 4);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(9, 14, 6, 3);
      ctx.fillStyle = "#fb923c";
      ctx.fillRect(10, 10, 4, 4);
      ctx.fillStyle = "#fed7aa";
      ctx.fillRect(11, 8, 2, 2);
    } else if (type === "bin") {
      drawShadow(ctx, 12, 25, 6, 2.2);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(6, 11, 12, 14);
      ctx.fillStyle = "#334155";
      ctx.fillRect(7, 12, 10, 12);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(7, 12, 3, 12);
      // Tutup tong & lubang
      ctx.fillStyle = "#475569";
      ctx.fillRect(5, 9, 14, 3);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(6, 9, 12, 1);
      ctx.fillStyle = "#020617";
      ctx.fillRect(9, 10, 6, 1);
    } else if (type === "box") {
      drawShadow(ctx, 12, 25, 7, 2.5);
      ctx.fillStyle = "#451a03";
      ctx.fillRect(5, 13, 14, 12);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(6, 14, 12, 10);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(6, 14, 6, 10);
      // Lakban & label paket
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(10, 13, 4, 5);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(7, 18, 4, 3);
    } else if (type === "plant") {
      drawShadow(ctx, 12, 25, 6.5, 2.2);
      // Pot terakota
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(7, 18, 10, 7);
      ctx.fillStyle = "#c2410c";
      ctx.fillRect(8, 18, 6, 7);
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(6, 16, 12, 2);
      // Daun Monstera berlapis
      ctx.fillStyle = "#14532d";
      ctx.fillRect(5, 8, 14, 8);
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(6, 6, 5, 7);
      ctx.fillRect(13, 7, 5, 7);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(9, 4, 6, 8);
      ctx.fillRect(7, 7, 2, 2);
    } else if (type === "chair") {
      drawShadow(ctx, 12, 25, 6, 2);
      // Roda & kaki besi
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(7, 23, 10, 2);
      ctx.fillRect(11, 19, 2, 4);
      // Dudukan & sandaran ergonomis
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(6, 17, 12, 3);
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(7, 17, 10, 2);
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(7, 8, 10, 9);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(8, 9, 4, 7);
    } else if (type === "coffee") {
      drawShadow(ctx, 12, 25, 7, 2.3);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(5, 8, 14, 17);
      ctx.fillStyle = "#334155";
      ctx.fillRect(6, 9, 12, 15);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(6, 9, 4, 15);
      // Layar & ceruk gelas kopi
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(11, 11, 5, 3);
      ctx.fillStyle = "#020617";
      ctx.fillRect(8, 16, 8, 6);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(10, 19, 4, 3);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(11, 18, 2, 1);
    } else if (type === "cooler") {
      drawShadow(ctx, 12, 25, 6.5, 2.2);
      // Bodi dispenser putih
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(7, 13, 10, 12);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(7, 13, 7, 12);
      // Keran merah & biru
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(9, 16, 2, 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(13, 16, 2, 2);
      // Galon air biru transparan
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(7, 4, 10, 9);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(8, 5, 6, 7);
      ctx.fillStyle = "#bae6fd";
      ctx.fillRect(9, 6, 2, 5);
    } else if (type === "printer") {
      drawShadow(ctx, 12, 25, 8, 2.5);
      ctx.fillStyle = "#475569";
      ctx.fillRect(4, 12, 16, 13);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(5, 12, 14, 9);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(5, 11, 14, 2);
      // Panel LED hijau & kertas keluar
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(15, 13, 3, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(7, 16, 7, 4);
    } else if (type === "locker") {
      drawShadow(ctx, 12, 25, 7, 2.3);
      ctx.fillStyle = "#1e3a8a";
      ctx.fillRect(5, 4, 14, 21);
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(6, 5, 12, 19);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(6, 5, 3, 19);
      // Ventilasi & gagang pintu
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(8, 7, 8, 1);
      ctx.fillRect(8, 9, 8, 1);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(15, 14, 2, 3);
    } else if (type === "server") {
      drawShadow(ctx, 12, 25, 7.5, 2.4);
      ctx.fillStyle = "#020617";
      ctx.fillRect(5, 3, 14, 22);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(6, 4, 12, 20);
      // Rak server & lampu indikator LED berkelip
      for (let ry = 6; ry <= 20; ry += 4) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(7, ry, 10, 2);
        ctx.fillStyle = ry % 8 === 0 ? "#22c55e" : "#38bdf8";
        ctx.fillRect(8, ry, 2, 1);
        ctx.fillStyle = "#facc15";
        ctx.fillRect(11, ry, 1, 1);
      }
    } else if (type === "sofa") {
      drawShadow(ctx, 12, 25, 9, 2.6);
      ctx.fillStyle = "#4c1d95";
      ctx.fillRect(3, 12, 18, 12);
      ctx.fillStyle = "#6d28d9";
      ctx.fillRect(4, 12, 16, 6);
      // Bantalan dudukan & sandaran tangan
      ctx.fillStyle = "#8b5cf6";
      ctx.fillRect(5, 17, 6, 5);
      ctx.fillRect(13, 17, 6, 5);
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(3, 15, 2, 8);
      ctx.fillRect(19, 15, 2, 8);
    } else if (type === "safe") {
      drawShadow(ctx, 12, 25, 7.5, 2.5);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(5, 8, 14, 17);
      ctx.fillStyle = "#334155";
      ctx.fillRect(6, 9, 12, 15);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(6, 9, 4, 15);
      // Roda pemutar brankas emas & engsel
      ctx.fillStyle = "#facc15";
      ctx.fillRect(11, 14, 4, 4);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(12, 15, 2, 2);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(17, 11, 1, 3);
      ctx.fillRect(17, 19, 1, 3);
    } else {
      // Fallback box
      drawShadow(ctx, 12, 25, 6, 2);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(6, 14, 12, 10);
    }

    SPRITE_CACHE.set(type, cv);
    return cv;
  }

  function drawPropSpritePro(ctx, type, px, py) {
    const sprite = SPRITE_CACHE.get(type) || buildPropSprite(type);
    ctx.drawImage(sprite, Math.round(px - 12), Math.round(py - 25));
  }

  W.MS_PROP_ART = { drawPropSpritePro };

  // Integrasi otomatis ke renderer dunia jika MS_WORLD sudah dimuat
  if (W.MS_WORLD) {
    W.MS_WORLD.drawPropSprite = drawPropSpritePro;
  }
})(window);
