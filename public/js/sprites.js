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
    if (a.bot === 8 && !S) { r("#111", 5, 17, 1, 3); r("#111", 10, 17, 1, 3); r("#fff", 7, 18, 2, 1); } // Rok Tartan Punk
    if (a.bot === 2) { if (S) r(bc, 6, 18, 4, 3); else { r(bc, 5, 18, 3, 3); r(bc, 8, 18, 3, 3); } }
    if (a.bot === 4) r(bc, S ? 5 : 4, 17, S ? 6 : 8, 2);
    if (a.bot === 3) { r(sh(bc, -35), S ? 7 : 5, 20, 2, 2); r(sh(bc, -35), 9, 20, S ? 0 : 2, 2); }
    if (a.bot === 7 && !S) { r(sk, 6, 20 + l1, 1, 1); r(sk, 9, 21 + l2, 1, 1); } // Jeans Sobek Punk
    if (a.bot === 9 && !S) { r("#111", 6, 19, 1, 4); r("#111", 9, 19, 1, 4); } // Celana Tartan Punk
    if (a.bot === 10) { r("#fff", S ? 6 : 5, 22 + l1, S ? 4 : 6, 1); } // List bulu Celana Santa
    if (a.bot === 15 && !S) { r(bc, 5, 14, 1, 4); r(bc, 10, 14, 1, 4); r(bc, 5, 16, 6, 2); } // Overall

    // Dress / Gaun panjang
    if (a.shirt === 5 || a.shirt === 13) {
      const dcol = a.shirt === 13 ? "#d92b3a" : sc;
      r(dcol, S ? 4 : 3, 17, S ? 8 : 10, 5);
      r(a.shirt === 13 ? "#fff" : sh(dcol, -25), S ? 4 : 3, 21, S ? 8 : 10, 1);
    }

    // Badan & Baju (Casual, Natal, Punk)
    const bx = S ? 5 : 4, bw = S ? 6 : 8;
    let bodyCol = sc;
    if (a.shirt === 9) bodyCol = "#c92a38"; // Sweater Natal Merah
    if (a.shirt === 10 || a.shirt === 11) bodyCol = "#1e1d26"; // Jaket/Kaos Punk Hitam
    if (a.shirt === 12 || a.shirt === 13) bodyCol = "#d92b3a"; // Baju/Dress Santa
    if (a.shirt === 16) bodyCol = "#2e8b4e"; // Baju Elf Natal Hijau
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
    if (a.shirt === 3) { r(sh(sc, -25), bx, 11, bw, 2); } // Hoodie
    if (a.shirt === 4 && !S) { r("#fff", 6, 12, 4, 1); r(sh(sc, -35), 7, 13, 1, 5); } // Flanel
    if (a.shirt === 7) { r("#fff", bx, 14, bw, 1); r("#fff", bx, 16, bw, 1); } // Jersey
    if (a.shirt === 8) { for (let q = 12; q < 18; q += 2) r(sh(sc, -45), bx, q, bw, 1); } // Kaos Garis
    if (a.shirt === 9 && !S) { r("#2e8b4e", 5, 14, 6, 2); r("#fff", 6, 13, 1, 1); r("#fff", 9, 13, 1, 1); r("#ffd23f", 7, 14, 2, 2); } // Sweater Natal
    if (a.shirt === 10 && !S) { r("#aeb7c7", 5, 12, 1, 1); r("#aeb7c7", 10, 12, 1, 1); r("#aeb7c7", 6, 14, 4, 1); r("#d92b3a", 7, 15, 2, 2); } // Jaket Kulit Punk
    if (a.shirt === 11 && !S) { r("#fff", 7, 13, 2, 2); r("#ff5d6c", 6, 15, 4, 1); } // Kaos Punk
    if (a.shirt === 12) { r("#fff", 7, 12, 2, 5); r("#111", bx, 16, bw, 1); r("#ffd23f", 7, 16, 2, 1); } // Baju Santa
    if (a.shirt === 13 && !S) { r("#fff", 6, 12, 4, 1); r("#111", bx, 15, bw, 1); } // Dress Natal
    if (a.shirt === 15 && !S) { r("#3b6ab8", 4, 12, 2, 6); r("#3b6ab8", 10, 12, 2, 6); r("#fff", 6, 12, 4, 6); } // Rompi Denim
    if (a.shirt === 16 && !S) { r("#d92b3a", 5, 12, 6, 1); r("#ffd23f", 7, 14, 2, 2); } // Baju Elf Natal
    if (a.shirt === 17 && !S) { r("#fff", 7, 12, 2, 3); r("#d92b3a", 7, 13, 2, 2); } // Jas Kantor

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
    if (hs === 12) { r("#ff5d6c", 7, -3, 2, 4); r("#ffd23f", 7, -4, 2, 1); } // Mohawk Punk
    if (hs === 17) { r(hc, 5, -2, 6, 3); } // Pompadour

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
    if (a.acc === 9) { r("#d92b3a", S ? 5 : 4, 11, S ? 6 : 8, 2); r("#2e8b4e", S ? 6 : 5, 11, 2, 2); if (!B && !S) r("#d92b3a", 5, 13, 2, 4); } // Syal Natal
    if (a.acc === 10 && !B) { r("#111", 4, 5, 3, 3); r("#111", 9, 5, 3, 3); r("#111", 7, 5, 2, 1); }
    if (a.acc === 11) { r("#ff7a8a", S ? 5 : 10, 2, 2, 2); r("#ffd23f", S ? 5 : 10, 2, 1, 1); }
    if (a.acc === 12) { r("#d92b3a", 4, -2, 8, 3); r("#fff", 3, 1, 10, 2); r("#fff", 11, -2, 2, 2); } // Topi Santa
    if (a.acc === 13) { r("#8b5a2b", 4, -3, 1, 4); r("#8b5a2b", 3, -2, 3, 1); r("#8b5a2b", 11, -3, 1, 4); r("#8b5a2b", 10, -2, 3, 1); } // Tanduk Rusa Natal
    if (a.acc === 14 && !B) { r("#111", S ? 5 : 4, 11, S ? 6 : 8, 1); r("#d8dce6", S ? 6 : 5, 11, 1, 1); r("#d8dce6", S ? 8 : 8, 11, 1, 1); r("#d8dce6", 7, 13, 2, 2); } // Rantai & Choker Punk
    if (a.acc === 15 && !B) { r("#5cc8ff", 4, 2, 3, 2); r("#5cc8ff", 9, 2, 3, 2); r("#333", 3, 2, 10, 1); } // Goggles Punk
    if (a.acc === 16) { r("#ffd23f", 5, -2, 6, 2); r("#ffd23f", 5, -3, 1, 1); r("#ffd23f", 8, -3, 1, 1); r("#ffd23f", 10, -3, 1, 1); } // Mahkota Kecil
    if (a.acc === 17) { r("#2e8b4e", 3, 0, 10, 4); r("#d92b3a", 3, 3, 10, 1); r("#fff", 6, -2, 3, 2); } // Kupluk Natal

    outline(c);
    return c;
  }

  function spr(a, dir, fr) {
    if (!a.sp) a.sp = {};
    const k = `${dir}_${fr}`;
    return a.sp[k] || (a.sp[k] = mkChar(a, dir, fr));
  }

  const PD = { cone: [12, 10], galon: [12, 18], pot: [12, 12], drum: [16, 20], speaker: [16, 22], palet: [22, 14] };
  const PN = { cone: "Cone Parkir", galon: "Dispenser", pot: "Pot Tanaman", drum: "Tong Sampah", speaker: "Printer", palet: "Sofa" };
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

    if (t === "cone") { r("#ff7a1a", 5, 0, 2, 2); r("#ff7a1a", 4, 2, 4, 3); r("#ff7a1a", 3, 5, 6, 2); r("#fff", 4, 3, 4, 1); r("#fff", 3, 6, 6, 1); r("#333", 1, 7, 10, 3); }
    if (t === "galon") { r("#2d6cdf", 4, 0, 4, 2); r("#bfe6ff", 3, 2, 6, 2); r("#58a6ff", 1, 4, 10, 13); r("#cfeaff", 2, 5, 2, 9); r("#2d6cdf", 1, 9, 10, 1); r("#2d6cdf", 1, 16, 10, 2); }
    if (t === "pot") { r("#3fae5a", 3, 0, 2, 4); r("#3fae5a", 6, 0, 3, 5); r("#2e8a45", 5, 2, 2, 3); r("#c0603a", 2, 5, 8, 6); r("#d9794c", 1, 5, 10, 2); }
    if (t === "drum") { r("#8a93a4", 2, 2, 12, 17); r("#aeb7c7", 1, 0, 14, 3); r("#6a7384", 2, 9, 12, 1); r("#222", 4, 5, 8, 2); r("#c9d1e0", 3, 4, 2, 13); }
    if (t === "speaker") { r("#fff", 3, 1, 10, 5); r("#d8dce6", 0, 6, 16, 16); r("#aab0c0", 0, 6, 16, 3); r("#2a3550", 2, 11, 12, 4); r("#5cc8ff", 3, 12, 4, 2); r("#8a90a0", 1, 18, 14, 2); }
    if (t === "palet") { r("#2d4a8a", 1, 0, 20, 6); r("#3a5aa8", 0, 5, 22, 7); r("#1e3366", 0, 5, 22, 1); r("#4a6ab8", 3, 6, 7, 4); r("#4a6ab8", 12, 6, 7, 4); r("#222", 1, 12, 2, 2); r("#222", 19, 12, 2, 2); }

    outline(c);
    return (PC[t] = c);
  }

  W.MS_SPR = { spr, prop, outline, PD, PN };
})(window);
