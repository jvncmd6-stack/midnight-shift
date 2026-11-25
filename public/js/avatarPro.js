(function (W) {
  "use strict";
  const { SKIN, HAIR, CLR } = W.MS_CFG;

  const CACHE = new Map();
  const OUTLINE = "#12131f";

  function shade(hex, amt) {
    const n = parseInt((hex || "#888888").replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    return { c, x };
  }

  function px(x, col, gx, gy, gw = 1, gh = 1) {
    x.fillStyle = col;
    x.fillRect(gx, gy, gw, gh);
  }

  function buildChibiSprite(av, dir, frame) {
    const { c, x } = makeCanvas(24, 36);

    // Jika menghadap kiri (dir === 3), gambar versi kanan (dir === 2) lalu balik secara horizontal
    if (dir === 3) {
      const rightCanvas = getChibiSprite(av, 2, frame);
      x.save();
      x.translate(24, 0);
      x.scale(-1, 1);
      x.drawImage(rightCanvas, 0, 0);
      x.restore();
      return c;
    }

    const skinBase = SKIN[av.skin] || "#f8d5c2";
    const skinShadow = shade(skinBase, -24);
    const skinBlush = "#f9a8d4";

    const hairBase = HAIR[av.hairC] || "#3b3534";
    const hairDark = shade(hairBase, -24);
    const hairLight = shade(hairBase, 24);

    const topBase = CLR[av.shirtC] || "#1e293b";
    const topDark = shade(topBase, -26);
    const topLight = shade(topBase, 24);

    const botBase = CLR[av.botC] || "#334155";
    const botDark = shade(botBase, -24);
    const botLight = shade(botBase, 26);

    const bob = frame === 0 ? 0 : -1;
    const stepL = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    const stepR = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const isSide = dir === 2;
    const isBack = dir === 1;

    // 1. Bayangan lembut di bawah sepatu
    x.fillStyle = "rgba(5, 8, 20, 0.42)";
    x.fillRect(6, 33, 12, 2);

    // 2. Sepatu & Kaki (y: 25..34)
    if (!isSide) {
      // Kaki kiri & kanan
      px(x, OUTLINE, 7, 25, 4, 8 + stepL);
      px(x, OUTLINE, 13, 25, 4, 8 + stepR);
      px(x, botBase, 8, 25, 3, 5 + stepL);
      px(x, botBase, 13, 25, 3, 5 + stepR);
      px(x, botLight, 8, 26, 2, 2); // Highlight lutut celana
      px(x, botLight, 14, 26, 2, 2);

      // Sepatu boots gelap dengan sol
      px(x, "#18181b", 7, 30 + stepL, 4, 3);
      px(x, "#18181b", 13, 30 + stepR, 4, 3);
      px(x, "#3f3f46", 8, 30 + stepL, 2, 1);
      px(x, "#3f3f46", 14, 30 + stepR, 2, 1);
    } else {
      // Tampak samping
      px(x, OUTLINE, 9, 25, 6, 8);
      px(x, botBase, 10 + stepL, 25, 4, 5);
      px(x, botDark, 10 + stepR, 25, 4, 5);
      px(x, "#18181b", 9 + stepL, 30, 5, 3);
      px(x, "#27272a", 9 + stepR, 30, 5, 3);
    }

    // 3. Badan / Jaket Berkancing (y: 18..26 + bob)
    const by = 18 + bob;
    if (!isSide) {
      px(x, OUTLINE, 6, by, 12, 8);
      px(x, OUTLINE, 4, by + 1, 2, 6); // Lengan kiri
      px(x, OUTLINE, 18, by + 1, 2, 6); // Lengan kanan

      // Badan utama jaket
      px(x, topBase, 7, by + 1, 10, 6);
      px(x, topDark, 7, by + 1, 2, 6);
      px(x, topDark, 15, by + 1, 2, 6);

      // Lengan & Tangan
      px(x, topBase, 5, by + 1, 2, 4);
      px(x, topBase, 17, by + 1, 2, 4);
      px(x, topDark, 5, by + 5, 2, 1);
      px(x, topDark, 17, by + 5, 2, 1);
      px(x, skinBase, 5, by + 6, 2, 2);
      px(x, skinBase, 17, by + 6, 2, 2);

      if (!isBack) {
        // Kaos dalam & kerah V
        px(x, "#18181b", 11, by + 1, 2, 6);
        px(x, skinBase, 11, by, 2, 1);
        // Saku dada & kancing perak
        px(x, topLight, 8, by + 3, 2, 1);
        px(x, topLight, 14, by + 3, 2, 1);
        px(x, "#e2e8f0", 11, by + 2, 1, 1);
        px(x, "#e2e8f0", 11, by + 4, 1, 1);
        px(x, "#e2e8f0", 11, by + 6, 1, 1);
      } else {
        px(x, topLight, 8, by + 2, 8, 1);
      }
    } else {
      px(x, OUTLINE, 8, by, 8, 8);
      px(x, topBase, 9, by + 1, 6, 6);
      px(x, topLight, 10, by + 2, 3, 4);
      px(x, skinBase, 10 + stepR, by + 6, 3, 2);
    }

    // 4. Kepala Chibi (y: 3..18 + bob)
    const hy = 3 + bob;
    px(x, OUTLINE, 6, hy, 12, 1);
    px(x, OUTLINE, 5, hy + 1, 14, 1);
    px(x, OUTLINE, 4, hy + 2, 16, 11);
    px(x, OUTLINE, 5, hy + 13, 14, 1);
    px(x, OUTLINE, 7, hy + 14, 10, 1);

    // Dasar kulit wajah
    px(x, skinBase, 5, hy + 3, 14, 10);
    px(x, skinBase, 7, hy + 13, 10, 1);
    px(x, skinShadow, 5, hy + 11, 2, 2);
    px(x, skinShadow, 17, hy + 11, 2, 2);
    px(x, skinShadow, 8, hy + 13, 8, 1);

    // 5. Wajah & Ekspresi Mata (Jika tidak menghadap belakang)
    if (!isBack) {
      if (!isSide) {
        // Alis
        px(x, hairDark, 7, hy + 7, 3, 1);
        px(x, hairDark, 14, hy + 7, 3, 1);

        // Mata kiri & kanan (3x3 piksel dengan kilau putih)
        px(x, "#18181b", 7, hy + 8, 3, 3);
        px(x, "#18181b", 14, hy + 8, 3, 3);
        px(x, "#334155", 8, hy + 9, 2, 2);
        px(x, "#334155", 15, hy + 9, 2, 2);
        px(x, "#ffffff", 7, hy + 8, 1, 1);
        px(x, "#ffffff", 14, hy + 8, 1, 1);

        // Blush pipi & mulut lembut
        px(x, skinBlush, 6, hy + 11, 2, 1);
        px(x, skinBlush, 16, hy + 11, 2, 1);
        px(x, "#f472b6", 11, hy + 12, 2, 1);

        // Aksesori Kacamata / Masker / Topi (av.acc)
        if (av.acc === 1 || av.acc === 4 || av.g === "m") {
          // Kacamata bingkai kotak seperti referensi
          px(x, "#090d16", 6, hy + 8, 5, 1);
          px(x, "#090d16", 6, hy + 11, 5, 1);
          px(x, "#090d16", 6, hy + 8, 1, 4);
          px(x, "#090d16", 10, hy + 8, 1, 4);

          px(x, "#090d16", 13, hy + 8, 5, 1);
          px(x, "#090d16", 13, hy + 11, 5, 1);
          px(x, "#090d16", 13, hy + 8, 1, 4);
          px(x, "#090d16", 17, hy + 8, 1, 4);

          px(x, "#090d16", 11, hy + 9, 2, 1); // Jembatan hidung
        }
      } else {
        // Wajah tampak samping (kanan)
        px(x, hairDark, 14, hy + 7, 3, 1);
        px(x, "#18181b", 14, hy + 8, 3, 3);
        px(x, "#ffffff", 14, hy + 8, 1, 1);
        px(x, skinBlush, 13, hy + 11, 2, 1);
        if (av.acc === 1 || av.acc === 4 || av.g === "m") {
          px(x, "#090d16", 13, hy + 8, 5, 1);
          px(x, "#090d16", 13, hy + 11, 5, 1);
          px(x, "#090d16", 13, hy + 8, 1, 4);
          px(x, "#090d16", 18, hy + 8, 1, 4);
        }
      }
    }

    // 6. Rambut Berponi & Bertekstur 3-Tone (y: 1..12 + bob)
    px(x, hairBase, 6, hy + 1, 12, 4);
    px(x, hairBase, 5, hy + 2, 14, 4);
    px(x, hairLight, 7, hy + 2, 4, 1);
    px(x, hairLight, 13, hy + 2, 4, 1);

    if (isBack) {
      px(x, hairBase, 5, hy + 3, 14, 9);
      px(x, hairDark, 6, hy + 10, 12, 2);
      px(x, hairLight, 8, hy + 4, 8, 1);
    } else if (!isSide) {
      // Jambang kiri & kanan
      px(x, hairBase, 5, hy + 5, 2, 5);
      px(x, hairBase, 17, hy + 5, 2, 5);
      px(x, hairDark, 5, hy + 8, 1, 2);
      px(x, hairDark, 18, hy + 8, 1, 2);

      // Poni belah tengah alami (seperti referensi)
      px(x, hairBase, 7, hy + 5, 4, 2);
      px(x, hairBase, 13, hy + 5, 4, 2);
      px(x, hairDark, 9, hy + 6, 2, 2);
      px(x, hairDark, 13, hy + 6, 2, 2);

      // Rambut panjang jika karakter cewek / gaya rambut panjang
      if (av.g === "f" || (av.hair || 0) >= 4) {
        px(x, hairDark, 4, hy + 9, 2, 9);
        px(x, hairDark, 18, hy + 9, 2, 9);
      }
    } else {
      // Rambut tampak samping
      px(x, hairBase, 5, hy + 3, 9, 8);
      px(x, hairBase, 14, hy + 5, 4, 2);
      px(x, hairDark, 5, hy + 9, 7, 2);
    }

    // Aksesori Mahkota / Topi Spesial (av.acc === 2 atau 3)
    if (av.acc === 2) {
      px(x, "#facc15", 8, hy - 1, 8, 2);
      px(x, "#ef4444", 11, hy - 1, 2, 1);
    } else if (av.acc === 3) {
      px(x, "#ef4444", 6, hy + 1, 12, 2);
      px(x, "#ffffff", 11, hy, 2, 1);
    }

    return c;
  }

  function getChibiSprite(av, dir = 0, frame = 0) {
    const key = `${av.g}_${av.skin}_${av.hair}_${av.hairC}_${av.shirtC}_${av.botC}_${av.acc}_${dir}_${frame}`;
    let sp = CACHE.get(key);
    if (!sp) {
      sp = buildChibiSprite(av, dir, frame);
      CACHE.set(key, sp);
    }
    return sp;
  }

  // Sesuaikan ukuran preview canvas #pv di Avatar Creator menjadi 24x36 agar tidak terpotong
  function syncPreviewCanvas() {
    const pv = document.getElementById("pv");
    if (pv && (pv.width !== 24 || pv.height !== 36)) {
      pv.width = 24;
      pv.height = 36;
    }
  }

  W.MS_AVATAR_PRO = { getChibiSprite, syncPreviewCanvas };

  if (W.MS_SPR) {
    W.MS_SPR.spr = (av, dir, frame) => {
      syncPreviewCanvas();
      return getChibiSprite(av, dir, frame);
    };
  }
})(window);
