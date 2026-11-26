(function (W) {
  "use strict";
  const { SKIN, HAIR, CLR, sh } = W.MS_CFG;

  const CACHE = new Map();
  const OUTLINE = "#12131f";

  function outline(c) {
    const x = c.getContext("2d"), w = c.width, h = c.height;
    const d = x.getImageData(0, 0, w, h), p = d.data, o = new Uint8ClampedArray(p);
    const q = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < w; i++) {
        const k = (y * w + i) * 4;
        if (p[k + 3] > 0) continue;
        for (let j = 0; j < 4; j++) {
          const a = i + q[j][0], b = y + q[j][1];
          if (a >= 0 && b >= 0 && a < w && b < h && p[(b * w + a) * 4 + 3] > 0) {
            o[k] = 24; o[k + 1] = 18; o[k + 2] = 36; o[k + 3] = 255;
            break;
          }
        }
      }
    }
    d.data.set(o);
    x.putImageData(d, 0, 0);
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.imageSmoothingEnabled = false;
    return { c, x };
  }

  function r(x, col, gx, gy, gw = 1, gh = 1) {
    x.fillStyle = col;
    x.fillRect(gx, gy, gw, gh);
  }

  function normAvatar(raw) {
    const a = raw || {};
    return {
      g: a.g || "m",
      sk: a.sk ?? a.skin ?? 1,
      hr: a.hr ?? a.hair ?? 0,
      hc: a.hc ?? a.hairC ?? 0,
      st: a.st ?? a.shirt ?? 0,
      sc: a.sc ?? a.shirtC ?? 0,
      pt: a.pt ?? a.bot ?? 0,
      pc: a.pc ?? a.botC ?? 6,
      ac: a.ac ?? a.acc ?? 0
    };
  }

  function buildChibiSprite(rawAv, dir, frame) {
    const av = normAvatar(rawAv);
    const { c, x } = makeCanvas(24, 36);

    if (dir === 3) {
      const rightCanvas = spr(av, 2, frame);
      x.save();
      x.translate(24, 0);
      x.scale(-1, 1);
      x.drawImage(rightCanvas, 0, 0);
      x.restore();
      return c;
    }

    const skinBase = SKIN[av.sk] || SKIN[1] || "#f8d5c2";
    const skinShadow = sh(skinBase, -26);
    const skinBlush = "#f9a8d4";

    const hairBase = HAIR[av.hc] || HAIR[0] || "#3b3534";
    const hairDark = sh(hairBase, -26);
    const hairLight = sh(hairBase, 24);

    const topBase = CLR[av.sc] || CLR[0] || "#1e293b";
    const topDark = sh(topBase, -28);
    const topLight = sh(topBase, 24);

    const botBase = CLR[av.pc] || CLR[6] || "#334155";
    const botDark = sh(botBase, -26);
    const botLight = sh(botBase, 24);

    const bob = frame === 0 ? 0 : -1;
    const stepL = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    const stepR = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const isSide = dir === 2;
    const isBack = dir === 1;

    // 1. Bayangan lantai
    x.fillStyle = "rgba(5, 8, 20, 0.42)";
    x.fillRect(6, 33, 12, 2);

    // 2. Celana & Sepatu (y: 25..34)
    if (!isSide) {
      r(x, OUTLINE, 7, 25, 4, 8 + stepL);
      r(x, OUTLINE, 13, 25, 4, 8 + stepR);
      r(x, botBase, 8, 25, 3, 5 + stepL);
      r(x, botBase, 13, 25, 3, 5 + stepR);
      r(x, botLight, 8, 26, 2, 2);
      r(x, botLight, 14, 26, 2, 2);

      r(x, "#18181b", 7, 30 + stepL, 4, 3);
      r(x, "#18181b", 13, 30 + stepR, 4, 3);
      r(x, "#3f3f46", 8, 30 + stepL, 2, 1);
      r(x, "#3f3f46", 14, 30 + stepR, 2, 1);
    } else {
      r(x, OUTLINE, 9, 25, 6, 8);
      r(x, botBase, 10 + stepL, 25, 4, 5);
      r(x, botDark, 10 + stepR, 25, 4, 5);
      r(x, "#18181b", 9 + stepL, 30, 5, 3);
      r(x, "#27272a", 9 + stepR, 30, 5, 3);
    }

    // 3. Badan / Jaket (y: 18..26 + bob)
    const by = 18 + bob;
    if (!isSide) {
      r(x, OUTLINE, 6, by, 12, 8);
      r(x, OUTLINE, 4, by + 1, 2, 6);
      r(x, OUTLINE, 18, by + 1, 2, 6);

      r(x, topBase, 7, by + 1, 10, 6);
      r(x, topDark, 7, by + 1, 2, 6);
      r(x, topDark, 15, by + 1, 2, 6);

      r(x, topBase, 5, by + 1, 2, 4);
      r(x, topBase, 17, by + 1, 2, 4);
      r(x, topDark, 5, by + 5, 2, 1);
      r(x, topDark, 17, by + 5, 2, 1);
      r(x, skinBase, 5, by + 6, 2, 2);
      r(x, skinBase, 17, by + 6, 2, 2);

      if (!isBack) {
        r(x, "#18181b", 11, by + 1, 2, 6);
        r(x, skinBase, 11, by, 2, 1);
        if (av.st % 2 === 0) {
          r(x, topLight, 8, by + 3, 2, 1);
          r(x, topLight, 14, by + 3, 2, 1);
          r(x, "#e2e8f0", 11, by + 2, 1, 1);
          r(x, "#e2e8f0", 11, by + 4, 1, 1);
          r(x, "#e2e8f0", 11, by + 6, 1, 1);
        } else {
          r(x, topLight, 8, by + 2, 8, 2);
          r(x, topDark, 9, by + 5, 6, 2);
        }
      } else {
        r(x, topLight, 8, by + 2, 8, 1);
      }
    } else {
      r(x, OUTLINE, 8, by, 8, 8);
      r(x, topBase, 9, by + 1, 6, 6);
      r(x, topLight, 10, by + 2, 3, 4);
      r(x, skinBase, 10 + stepR, by + 6, 3, 2);
    }

    // 4. Kepala Chibi (y: 3..18 + bob)
    const hy = 3 + bob;
    r(x, OUTLINE, 6, hy, 12, 1);
    r(x, OUTLINE, 5, hy + 1, 14, 1);
    r(x, OUTLINE, 4, hy + 2, 16, 11);
    r(x, OUTLINE, 5, hy + 13, 14, 1);
    r(x, OUTLINE, 7, hy + 14, 10, 1);

    r(x, skinBase, 5, hy + 3, 14, 10);
    r(x, skinBase, 7, hy + 13, 10, 1);
    r(x, skinShadow, 5, hy + 11, 2, 2);
    r(x, skinShadow, 17, hy + 11, 2, 2);
    r(x, skinShadow, 8, hy + 13, 8, 1);

    // 5. Wajah & Ekspresi
    if (!isBack) {
      if (!isSide) {
        r(x, hairDark, 7, hy + 7, 3, 1);
        r(x, hairDark, 14, hy + 7, 3, 1);

        r(x, "#18181b", 7, hy + 8, 3, 3);
        r(x, "#18181b", 14, hy + 8, 3, 3);
        r(x, "#334155", 8, hy + 9, 2, 2);
        r(x, "#334155", 15, hy + 9, 2, 2);
        r(x, "#ffffff", 7, hy + 8, 1, 1);
        r(x, "#ffffff", 14, hy + 8, 1, 1);

        r(x, skinBlush, 6, hy + 11, 2, 1);
        r(x, skinBlush, 16, hy + 11, 2, 1);
        r(x, "#f472b6", 11, hy + 12, 2, 1);

        // Kacamata bingkai kotak (acc 1, 4, atau 10)
        if (av.ac === 1 || av.ac === 4 || av.ac === 10) {
          r(x, "#090d16", 6, hy + 8, 5, 1);
          r(x, "#090d16", 6, hy + 11, 5, 1);
          r(x, "#090d16", 6, hy + 8, 1, 4);
          r(x, "#090d16", 10, hy + 8, 1, 4);

          r(x, "#090d16", 13, hy + 8, 5, 1);
          r(x, "#090d16", 13, hy + 11, 5, 1);
          r(x, "#090d16", 13, hy + 8, 1, 4);
          r(x, "#090d16", 17, hy + 8, 1, 4);
          r(x, "#090d16", 11, hy + 9, 2, 1);
        } else if (av.ac === 5) {
          r(x, "#1e293b", 7, hy + 10, 10, 4);
          r(x, "#334155", 8, hy + 11, 8, 2);
        }
      } else {
        r(x, hairDark, 14, hy + 7, 3, 1);
        r(x, "#18181b", 14, hy + 8, 3, 3);
        r(x, "#ffffff", 14, hy + 8, 1, 1);
        r(x, skinBlush, 13, hy + 11, 2, 1);
        if (av.ac === 1 || av.ac === 4 || av.ac === 10) {
          r(x, "#090d16", 13, hy + 8, 5, 1);
          r(x, "#090d16", 13, hy + 11, 5, 1);
          r(x, "#090d16", 13, hy + 8, 1, 4);
          r(x, "#090d16", 18, hy + 8, 1, 4);
        }
      }
    }

    // 6. Rambut 3-Tone
    r(x, hairBase, 6, hy + 1, 12, 4);
    r(x, hairBase, 5, hy + 2, 14, 4);
    r(x, hairLight, 7, hy + 2, 4, 1);
    r(x, hairLight, 13, hy + 2, 4, 1);

    if (isBack) {
      r(x, hairBase, 5, hy + 3, 14, 9);
      r(x, hairDark, 6, hy + 10, 12, 2);
      r(x, hairLight, 8, hy + 4, 8, 1);
    } else if (!isSide) {
      r(x, hairBase, 5, hy + 5, 2, 5);
      r(x, hairBase, 17, hy + 5, 2, 5);
      r(x, hairDark, 5, hy + 8, 1, 2);
      r(x, hairDark, 18, hy + 8, 1, 2);

      const style = av.hr % 4;
      if (style === 0) {
        r(x, hairBase, 7, hy + 5, 4, 2);
        r(x, hairBase, 13, hy + 5, 4, 2);
        r(x, hairDark, 9, hy + 6, 2, 2);
        r(x, hairDark, 13, hy + 6, 2, 2);
      } else if (style === 1) {
        r(x, hairBase, 7, hy + 5, 10, 2);
        r(x, hairDark, 8, hy + 6, 8, 1);
      } else if (style === 2) {
        r(x, hairBase, 7, hy + 5, 8, 2);
        r(x, hairDark, 7, hy + 6, 5, 2);
      } else {
        r(x, hairBase, 7, hy + 5, 4, 2);
        r(x, hairBase, 13, hy + 5, 4, 2);
        r(x, hairDark, 4, hy + 9, 2, 9);
        r(x, hairDark, 18, hy + 9, 2, 9);
      }
    } else {
      r(x, hairBase, 5, hy + 3, 9, 8);
      r(x, hairBase, 14, hy + 5, 4, 2);
      r(x, hairDark, 5, hy + 9, 7, 2);
    }

    // 7. Aksesori Kepala dengan Outline Utuh (tidak terpotong/bertumpuk)
    if (av.ac === 16 || av.ac === 2) {
      r(x, OUTLINE, 7, hy - 3, 10, 4);
      r(x, "#facc15", 8, hy - 1, 8, 2);
      r(x, "#facc15", 8, hy - 2, 2, 1);
      r(x, "#facc15", 11, hy - 2, 2, 1);
      r(x, "#facc15", 14, hy - 2, 2, 1);
      r(x, "#ef4444", 11, hy - 1, 2, 1);
    } else if (av.ac === 12 || av.ac === 3) {
      r(x, OUTLINE, 5, hy - 2, 14, 4);
      r(x, "#ef4444", 6, hy - 1, 12, 2);
      r(x, "#ffffff", 6, hy + 1, 12, 1);
      r(x, "#ffffff", 16, hy - 1, 2, 2);
    }

    return c;
  }

  function spr(av, dir = 0, fr = 0) {
    const pv = document.getElementById("pv");
    if (pv && (pv.width !== 24 || pv.height !== 36)) {
      pv.width = 24;
      pv.height = 36;
    }
    const n = normAvatar(av);
    const key = `${n.g}_${n.sk}_${n.hr}_${n.hc}_${n.st}_${n.sc}_${n.pt}_${n.pc}_${n.ac}_${dir}_${fr}`;
    let sp = CACHE.get(key);
    if (!sp) {
      sp = buildChibiSprite(n, dir, fr);
      CACHE.set(key, sp);
    }
    return sp;
  }

  /* ---------- Props Bawaan untuk Kompatibilitas world.js ---------- */
  const PD = { cone: [20, 22], galon: [22, 32], pot: [24, 26], drum: [24, 30], speaker: [26, 32], palet: [34, 24] };
  const PN = { cone: "Cone Parkir", galon: "Dispenser Air", pot: "Pot Tanaman", drum: "Tong Besi", speaker: "Mesin Printer", palet: "Sofa Kantor" };
  const PC = {};

  function prop(t) {
    if (W.MS_PROP_ART && W.MS_PROP_ART.buildPropSprite) {
      return W.MS_PROP_ART.buildPropSprite(t);
    }
    if (PC[t]) return PC[t];
    const D = PD[t] || PD.cone;
    const c = document.createElement("canvas");
    c.width = D[0] + 2;
    c.height = D[1] + 2;
    const X = c.getContext("2d");
    X.translate(1, 1);
    r(X, "#ff7a1a", 6, 4, 8, 14);
    r(X, "#2b2d3c", 2, 18, 16, 4);
    outline(c);
    return (PC[t] = c);
  }

  W.MS_SPR = { spr, prop, outline, PD, PN };
})(window);
