(function (W) {
  "use strict";
  const { SKIN, HAIR, CLR, sh } = W.MS_CFG;

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
            o[k] = 34; o[k + 1] = 22; o[k + 2] = 44; o[k + 3] = 255;
            break;
          }
        }
      }
    }
    d.data.set(o);
    x.putImageData(d, 0, 0);
  }

  function mkChar(a, dir, fr) {
    const c = document.createElement("canvas");
    c.width = 20;
    c.height = 30;
    const X = c.getContext("2d");
    X.translate(2, 4);
    const r = (col, x, y, w, h) => { X.fillStyle = col; X.fillRect(x, y, w, h); };

    const sk = SKIN[a.skin] || SKIN[1];
    const sd = sh(sk, -30);
    const hc = HAIR[a.hairC] || HAIR[0];
    const sc = CLR[a.shirtC] || CLR[0];
    const bc = CLR[a.botC] || CLR[6];
    const ac = CLR[(a.shirtC + 3) % CLR.length];
    const S = dir > 1, B = dir === 1, hs = a.hair, E = "#2a1a2e";

    if (dir === 3) { X.translate(16, 0); X.scale(-1, 1); }
    const l1 = fr === 1 ? -1 : 0, l2 = fr === 2 ? -1 : 0;
    const longPant = [0, 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17].includes(a.bot) && a.shirt !== 5 && a.shirt !== 13;
    const lc = longPant ? bc : sk;

    // Rambut belakang
    if (!S && !B && (hs === 1 || hs === 14)) r(hc, 3, 5, 10, 13);
    if (S && (hs === 1 || hs === 14)) r(hc, 2, 5, 6, 13);
    if (S && (hs === 2 || hs === 6 || hs === 11)) r(hc, 2, 5, 5, 6);
    if (S && (hs === 5 || hs === 13)) r(hc, 1, 5, 3, 9);
    if (S && (hs === 7 || hs === 15)) r(hc, 1, -1, 12, 11);
    if (S && hs === 9) r(hc, 2, 5, 3, 6);

    // Kaki & Sepatu
    if (S) {
      r(lc, 6, 19 + l1, 2, 4); r(lc, 8, 19 + l2, 2, 4);
      r("#2a2438", 6, 23 + l1, 3, 2); r("#2a2438", 8, 23 + l2, 3, 2);
    } else {
      r(lc, 5, 19 + l1, 3, 4); r(lc, 8, 19 + l2, 3, 4);
      r("#2a2438", 5, 23 + l1, 3, 2); r("#2a2438", 8, 23 + l2, 3, 2);
    }

    // Detail Bawahan
    if (a.bot === 1 || a.bot === 8) { r(bc, S ? 4 : 3, 17, S ? 8 : 10, 3); r(sh(bc, -25), S ? 4 : 3, 19, S ? 8 : 10, 1); }
    if (a.bot === 8 && !S) { r("#111", 5, 17, 1, 3); r("#111", 10, 17, 1, 3); r("#fff", 7, 18, 2, 1); }
    if (a.bot === 2) { if (S) r(bc, 6, 18, 4, 3); else { r(bc, 5, 18, 3, 3); r(bc, 8, 18, 3, 3); } }
    if (a.bot === 4) r(bc, S ? 5 : 4, 17, S ? 6 : 8, 2);
    if (a.bot === 3) { r(sh(bc, -35), S ? 7 : 5, 20, 2, 2); r(sh(bc, -35), 9, 20, S ? 0 : 2, 2); }
    if (a.bot === 7 && !S) { r(sk, 6, 20 + l1, 1, 1); r(sk, 9, 21 + l2, 1, 1); }
    if (a.bot === 9 && !S) { r("#111", 6, 19, 1, 4); r("#111", 9, 19, 1, 4); }
    if (a.bot === 10) { r("#fff", S ? 6 : 5, 22 + l1, S ? 4 : 6, 1); }
    if (a.bot === 15 && !S) { r(bc, 5, 14, 1, 4); r(bc, 10, 14, 1, 4); r(bc, 5, 16, 6, 2); }

    // Dress / Gaun panjang
    if (a.shirt === 5 || a.shirt === 13) {
      const dcol = a.shirt === 13 ? "#d92b3a" : sc;
      r(dcol, S ? 4 : 3, 17, S ? 8 : 10, 5);
      r(a.shirt === 13 ? "#fff" : sh(dcol, -25), S ? 4 : 3, 21, S ? 8 : 10, 1);
    }

    // Badan & Baju (Casual, Natal, Punk)
    const bx = S ? 5 : 4, bw = S ? 6 : 8;
    let bodyCol = sc;
    if (a.shirt === 9) bodyCol = "#c92a38";
    if (a.shirt === 10 || a.shirt === 11) bodyCol = "#1e1d26";
    if (a.shirt === 12 || a.shirt === 13) bodyCol = "#d92b3a";
    if (a.shirt === 16) bodyCol = "#2e8b4e";
    r(bodyCol, bx, 12, bw, 6);

    if (S) {
      r(a.shirt === 2 ? sk : bodyCol, 7, 13, 2, a.shirt === 2 ? 5 : 4);
    } else {
      if ([0, 6, 8, 11].includes(a.shirt)) {
        r(bodyCol, 3, 13, 1, 2); r(bodyCol, 12, 13, 1, 2);
        r(sk, 3, 15, 1, 3); r(sk, 12, 15, 1, 3);
      } else if ([2, 5, 13].includes(a.shirt)) {
        r(sk, 3, 13, 1, 5); r(sk, 12, 13, 1, 5);
      } else {
        r(bodyCol, 3, 13, 1, 5); r(bodyCol, 12, 13, 1, 5);
      }
    }

    // Motif Khusus Baju
    if (a.shirt === 3) { r(sh(sc, -25), bx, 11, bw, 2); }
    if (a.shirt === 4 && !S) { r("#fff", 6, 12, 4, 1); r(sh(sc, -35), 7, 13, 1, 5); }
    if (a.shirt === 7) { r("#fff", bx, 14, bw, 1); r("#fff", bx, 16, bw, 1); }
    if (a.shirt === 8) { for (let q = 12; q < 18; q += 2) r(sh(sc, -45), bx, q, bw, 1); }
    if (a.shirt === 9 && !S) { r("#2e8b4e", 5, 14, 6, 2); r("#fff", 6, 13, 1, 1); r("#fff", 9, 13, 1, 1); r("#ffd23f", 7, 14, 2, 2); }
    if (a.shirt === 10 && !S) { r("#aeb7c7", 5, 12, 1, 1); r("#aeb7c7", 10, 12, 1, 1); r("#aeb7c7", 6, 14, 4, 1); r("#d92b3a", 7, 15, 2, 2); }
    if (a.shirt === 11 && !S) { r("#fff", 7, 13, 2, 2); r("#ff5d6c", 6, 15, 4, 1); }
    if (a.shirt === 12) { r("#fff", 7, 12, 2, 5); r("#111", bx, 16, bw, 1); r("#ffd23f", 7, 16, 2, 1); }
    if (a.shirt === 13 && !S) { r("#fff", 6, 12, 4, 1); r("#111", bx, 15, bw, 1); }
    if (a.shirt === 15 && !S) { r("#3b6ab8", 4, 12, 2, 6); r("#3b6ab8", 10, 12, 2, 6); r("#fff", 6, 12, 4, 6); }
    if (a.shirt === 16 && !S) { r("#d92b3a", 5, 12, 6, 1); r("#ffd23f", 7, 14, 2, 2); }
    if (a.shirt === 17 && !S) { r("#fff", 7, 12, 2, 3); r("#d92b3a", 7, 13, 2, 2); }

    // Kepala & Wajah
    if (S) {
      r(sk, 4, 2, 8, 9); r(sk, 12, 6, 1, 2);
      r(E, 9, 6, 2, 3); r("#fff", 9, 6, 1, 1); r("#b5535e", 10, 9, 1, 1);
    } else {
      r(sk, 4, 2, 8, 9); r(sk, 3, 3, 10, 7); r(sd, 4, 10, 8, 1);
      if (!B) {
        r(E, 5, 6, 2, 3); r(E, 9, 6, 2, 3);
        r("#fff", 5, 6, 1, 1); r("#fff", 9, 6, 1, 1);
        r("#b5535e", 7, 9, 2, 1);
      }
    }

    // Rambut Depan
    if (B) {
      r(hc, 3, 1, 10, 10); r(hc, 4, 0, 8, 1);
      if (hs === 1) r(hc, 2, 5, 12, 13);
      if (hs === 10 || hs === 16) r(sk, 3, 3, 10, 8);
    } else if (S) {
      r(hc, 3, 1, 9, 4); r(hc, 4, 0, 7, 1); r(hc, 9, 5, 3, 1); r(hc, 3, 5, 3, 4);
      if (hs === 10 || hs === 16) { r(sk, 4, 3, 8, 2); r(sk, 4, 5, 2, 4); }
    } else {
      r(hc, 3, 1, 10, 4); r(hc, 4, 0, 8, 1);
      r(hc, 3, 5, 2, 3); r(hc, 11, 5, 2, 3);
      if (hs === 1) { r(hc, 2, 8, 2, 9); r(hc, 12, 8, 2, 9); }
      if (hs === 2 || hs === 6 || hs === 11) { r(hc, 2, 5, 3, 6); r(hc, 11, 5, 3, 6); }
      if (hs === 5) { r(hc, 12, 4, 3, 3); r(hc, 13, 7, 2, 6); }
      if (hs === 7 || hs === 15) { r(hc, 1, 0, 14, 6); r(hc, 1, 5, 3, 5); r(hc, 12, 5, 3, 5); }
      if (hs === 8) { r(hc, 4, 5, 3, 2); r(hc, 9, 5, 3, 2); }
      if (hs === 9) { r(hc, 0, 5, 3, 7); r(hc, 13, 5, 3, 7); }
      if (hs === 10 || hs === 16) { r(sk, 3, 3, 10, 3); r(hc, 4, 2, 8, 2); }
      if (hs === 14) { r(hc, 2, 6, 2, 10); r(hc, 12, 6, 2, 10); r("#ff7a8a", 2, 14, 2, 1); r("#ff7a8a", 12, 14, 2, 1); }
    }
    if (hs === 3) { r(hc, 4, -1, 2, 2); r(hc, 7, -2, 2, 3); r(hc, 10, -1, 2, 2); }
    if (hs === 4) r(hc, 6, -2, 4, 3);
    if (hs === 12) { r("#ff5d6c", 7, -3, 2, 4); r("#ffd23f", 7, -4, 2, 1); }
    if (hs === 17) { r(hc, 5, -2, 6, 3); }

    // Aksesori (18 Varian termasuk Natal & Punk)
    const G = "#222";
    if (a.acc === 1 && !B) {
      if (S) { r(G, 8, 5, 4, 1); r(G, 8, 9, 3, 1); r(G, 8, 6, 1, 3); }
      else { r(G, 4, 5, 8, 1); r(G, 4, 9, 3, 1); r(G, 9, 9, 3, 1); r(G, 4, 6, 1, 3); r(G, 11, 6, 1, 3); }
    }
    if (a.acc === 2) { r(ac, 3, 0, S ? 9 : 10, 4); if (!B) r(sh(ac, -35), S ? 10 : 2, 4, S ? 5 : 12, 1); }
    if (a.acc === 3) { r(CLR[2], S ? 4 : 10, 0, 3, 3); }
    if (a.acc === 4) { r("#333", 3, 0, S ? 8 : 10, 1); if (!S) { r(CLR[2], 1, 5, 2, 4); r(CLR[2], 13, 5, 2, 4); } }
    if (a.acc === 5 && !B) { r("#f4f4f4", S ? 8 : 4, 8, S ? 5 : 8, 3); }
    if (a.acc === 6) { r(ac, 3, 0, S ? 9 : 10, 4); r("#fff", 6, -1, 3, 1); }
    if (a.acc === 7) { r(CLR[2], 3, 2, S ? 9 : 10, 2); }
    if (a.acc === 8) { r("#ffd23f", S ? 7 : 3, 9, 1, 2); if (!S) r("#ffd23f", 12, 9, 1, 2); }
    if (a.acc === 9) { r("#d92b3a", S ? 5 : 4, 11, S ? 6 : 8, 2); r("#2e8b4e", S ? 6 : 5, 11, 2, 2); if (!B && !S) r("#d92b3a", 5, 13, 2, 4); }
    if (a.acc === 10 && !B) { r("#111", 4, 5, 3, 3); r("#111", 9, 5, 3, 3); r("#111", 7, 5, 2, 1); }
    if (a.acc === 11) { r("#ff7a8a", S ? 5 : 10, 2, 2, 2); r("#ffd23f", S ? 5 : 10, 2, 1, 1); }
    if (a.acc === 12) { r("#d92b3a", 4, -2, 8, 3); r("#fff", 3, 1, 10, 2); r("#fff", 11, -2, 2, 2); }
    if (a.acc === 13) { r("#8b5a2b", 4, -3, 1, 4); r("#8b5a2b", 3, -2, 3, 1); r("#8b5a2b", 11, -3, 1, 4); r("#8b5a2b", 10, -2, 3, 1); }
    if (a.acc === 14 && !B) { r("#111", S ? 5 : 4, 11, S ? 6 : 8, 1); r("#d8dce6", S ? 6 : 5, 11, 1, 1); r("#d8dce6", S ? 8 : 8, 11, 1, 1); r("#d8dce6", 7, 13, 2, 2); }
    if (a.acc === 15 && !B) { r("#5cc8ff", 4, 2, 3, 2); r("#5cc8ff", 9, 2, 3, 2); r("#333", 3, 2, 10, 1); }
    if (a.acc === 16) { r("#ffd23f", 5, -2, 6, 2); r("#ffd23f", 5, -3, 1, 1); r("#ffd23f", 8, -3, 1, 1); r("#ffd23f", 10, -3, 1, 1); }
    if (a.acc === 17) { r("#2e8b4e", 3, 0, 10, 4); r("#d92b3a", 3, 3, 10, 1); r("#fff", 6, -2, 3, 2); }

    outline(c);
    return c;
  }

  function spr(a, dir, fr) {
    if (!a.sp) a.sp = {};
    const k = `${dir}_${fr}`;
    return a.sp[k] || (a.sp[k] = mkChar(a, dir, fr));
  }

  /* ---------- Props Resolusi Tinggi (HD Pixel) ---------- */
  const PD = {
    cone: [20, 22],
    galon: [22, 32],
    pot: [24, 26],
    drum: [24, 30],
    speaker: [26, 32],
    palet: [34, 24]
  };
  const PN = {
    cone: "Cone Parkir",
    galon: "Dispenser Air",
    pot: "Pot Tanaman",
    drum: "Tong Besi",
    speaker: "Mesin Printer",
    palet: "Sofa Kantor"
  };
  const PC = {};

  function prop(t) {
    if (PC[t]) return PC[t];
    const D = PD[t] || PD.cone;
    const c = document.createElement("canvas");
    c.width = D[0] + 2;
    c.height = D[1] + 2;
    const X = c.getContext("2d");
    X.translate(1, 1);
    const r = (col, x, y, w, h) => { X.fillStyle = col; X.fillRect(x, y, w, h); };

    if (t === "cone") {
      r("#d9531e", 8, 1, 4, 3);
      r("#ff7a1a", 7, 4, 6, 4);
      r("#ffffff", 6, 8, 8, 3);
      r("#d8e2f0", 11, 8, 3, 3);
      r("#ff7a1a", 5, 11, 10, 4);
      r("#d9531e", 11, 11, 4, 4);
      r("#ffffff", 4, 15, 12, 3);
      r("#2b2d3c", 2, 18, 16, 4);
      r("#45485e", 3, 18, 10, 2);
    }
    if (t === "galon") {
      r("#1d4ed8", 8, 0, 6, 2);
      r("#93c5fd", 6, 2, 10, 2);
      r("#3b82f6", 5, 4, 12, 11);
      r("#60a5fa", 6, 5, 4, 9);
      r("#dbeafe", 7, 6, 2, 7);
      r("#2563eb", 5, 9, 12, 1);
      r("#e2e8f0", 4, 15, 14, 16);
      r("#cbd5e1", 13, 15, 5, 16);
      r("#334155", 6, 18, 10, 6);
      r("#ef4444", 7, 20, 2, 3);
      r("#3b82f6", 13, 20, 2, 3);
      r("#1e293b", 4, 30, 14, 2);
    }
    if (t === "pot") {
      r("#15803d", 9, 1, 6, 6);
      r("#22c55e", 5, 4, 14, 7);
      r("#4ade80", 7, 5, 5, 4);
      r("#166534", 13, 5, 6, 6);
      r("#15803d", 8, 9, 8, 4);
      r("#ea580c", 4, 13, 16, 3);
      r("#fb923c", 5, 13, 8, 2);
      r("#c2410c", 6, 16, 12, 9);
      r("#9a3412", 13, 16, 5, 9);
      r("#451a03", 7, 25, 10, 1);
    }
    if (t === "drum") {
      r("#475569", 3, 2, 18, 26);
      r("#64748b", 4, 3, 8, 24);
      r("#94a3b8", 6, 4, 3, 22);
      r("#1e293b", 2, 1, 20, 3);
      r("#cbd5e1", 3, 1, 10, 1);
      r("#1e293b", 2, 10, 20, 2);
      r("#1e293b", 2, 20, 20, 2);
      r("#1e293b", 2, 27, 20, 3);
      r("#facc15", 10, 14, 4, 4);
    }
    if (t === "speaker") {
      r("#f8fafc", 6, 1, 14, 7);
      r("#cbd5e1", 8, 3, 10, 1);
      r("#cbd5e1", 8, 5, 8, 1);
      r("#e2e8f0", 2, 8, 22, 22);
      r("#94a3b8", 18, 8, 6, 22);
      r("#cbd5e1", 2, 8, 22, 4);
      r("#0f172a", 4, 14, 12, 5);
      r("#38bdf8", 5, 15, 6, 3);
      r("#22c55e", 13, 15, 2, 1);
      r("#ef4444", 13, 17, 2, 1);
      r("#64748b", 4, 21, 16, 7);
      r("#334155", 9, 23, 6, 2);
      r("#1e293b", 3, 30, 20, 2);
    }
    if (t === "palet") {
      r("#1e3a8a", 2, 1, 30, 9);
      r("#2563eb", 3, 2, 28, 7);
      r("#3b82f6", 5, 3, 11, 5);
      r("#3b82f6", 18, 3, 11, 5);
      r("#1d4ed8", 0, 8, 34, 12);
      r("#60a5fa", 4, 9, 12, 6);
      r("#60a5fa", 18, 9, 12, 6);
      r("#1e3a8a", 0, 8, 4, 12);
      r("#1e3a8a", 30, 8, 4, 12);
      r("#451a03", 3, 20, 3, 4);
      r("#451a03", 28, 20, 3, 4);
    }

    outline(c);
    return (PC[t] = c);
  }

  W.MS_SPR = { spr, prop, outline, PD, PN };
})(window);
