(function (W) {
  "use strict";
  const { SKIN, HAIR, CLR, sh } = W.MS_CFG;

  function outline(c) {
    const x = c.getContext("2d"), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), p = d.data, o = new Uint8ClampedArray(p);
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
    c.width = 20; c.height = 30;
    const X = c.getContext("2d");
    X.translate(2, 4);
    const r = (col, x, y, w, h) => { X.fillStyle = col; X.fillRect(x, y, w, h); };

    const sk = SKIN[a.skin] || SKIN[1], sd = sh(sk, -30), hc = HAIR[a.hairC] || HAIR[0];
    const sc = CLR[a.shirtC] || CLR[0], bc = CLR[a.botC] || CLR[0], ac = CLR[(a.shirtC + 3) % 8];
    const S = dir > 1, B = dir === 1, hs = a.hair, E = "#2a1a2e";
    if (dir === 3) { X.translate(16, 0); X.scale(-1, 1); }
    const l1 = fr === 1 ? -1 : 0, l2 = fr === 2 ? -1 : 0;
    const lc = (a.bot === 0 || a.bot === 3 || a.bot === 5 || a.bot === 6) && a.shirt !== 5 ? bc : sk;

    if (!S && !B && hs === 1) r(hc, 3, 5, 10, 13);
    if (S && hs === 1) r(hc, 2, 5, 6, 13);
    if (S && hs === 2) r(hc, 2, 5, 5, 6);
    if (S && hs === 5) r(hc, 1, 5, 3, 8);
    if (S && hs === 7) r(hc, 1, -1, 12, 11);
    if (S && hs === 9) r(hc, 2, 5, 3, 6);
    if (S && (hs === 6 || hs === 11)) r(hc, 2, 5, 5, 6);

    if (S) {
      r(lc, 6, 19 + l1, 2, 4); r(lc, 8, 19 + l2, 2, 4);
      r("#2a2438", 6, 23 + l1, 3, 2); r("#2a2438", 8, 23 + l2, 3, 2);
    } else {
      r(lc, 5, 19 + l1, 3, 4); r(lc, 8, 19 + l2, 3, 4);
      r("#2a2438", 5, 23 + l1, 3, 2); r("#2a2438", 8, 23 + l2, 3, 2);
    }

    if (a.bot === 1) { r(bc, S ? 4 : 3, 17, S ? 8 : 10, 3); r(sh(bc, -25), S ? 4 : 3, 19, S ? 8 : 10, 1); }
    if (a.bot === 2) { if (S) r(bc, 6, 18, 4, 3); else { r(bc, 5, 18, 3, 3); r(bc, 8, 18, 3, 3); } }
    if (a.bot === 4) r(bc, S ? 5 : 4, 17, S ? 6 : 8, 2);
    if (a.bot === 5 && !S) { r(bc, 4, 19 + l1, 4, 4); r(bc, 8, 19 + l2, 4, 4); }
    if (a.shirt === 5) { r(sc, S ? 4 : 3, 17, S ? 8 : 10, 5); r(sh(sc, -25), S ? 4 : 3, 21, S ? 8 : 10, 1); }

    const bx = S ? 5 : 4, bw = S ? 6 : 8;
    r(sc, bx, 12, bw, 6);
    if (S) r(a.shirt === 2 ? sk : sc, 7, 13, 2, a.shirt === 2 ? 5 : 4);
    else {
      if (a.shirt === 0 || a.shirt === 6 || a.shirt === 8) { r(sc, 3, 13, 1, 2); r(sc, 12, 13, 1, 2); r(sk, 3, 15, 1, 3); r(sk, 12, 15, 1, 3); }
      if (a.shirt === 1 || a.shirt === 3 || a.shirt === 4) { r(sc, 3, 13, 1, 5); r(sc, 12, 13, 1, 5); }
      if (a.shirt === 2 || a.shirt === 5) { r(sk, 3, 13, 1, 5); r(sk, 12, 13, 1, 5); }
    }

    if (S) {
      r(sk, 4, 2, 8, 9); r(sk, 12, 6, 1, 2); r(E, 9, 6, 2, 3); r("#fff", 9, 6, 1, 1);
    } else {
      r(sk, 4, 2, 8, 9); r(sk, 3, 3, 10, 7); r(sd, 4, 10, 8, 1);
      if (!B) { r(E, 5, 6, 2, 3); r(E, 9, 6, 2, 3); r("#fff", 5, 6, 1, 1); r("#fff", 9, 6, 1, 1); }
    }

    if (B) {
      r(hc, 3, 1, 10, 10); r(hc, 4, 0, 8, 1);
      if (hs === 1) r(hc, 2, 5, 12, 13);
      if (hs === 2 || hs === 6 || hs === 11) r(hc, 2, 5, 12, 6);
    } else if (S) {
      r(hc, 3, 1, 9, 4); r(hc, 4, 0, 7, 1); r(hc, 9, 5, 3, 1); r(hc, 3, 5, 3, 4);
    } else {
      r(hc, 3, 1, 10, 4); r(hc, 4, 0, 8, 1); r(hc, 3, 5, 2, 3); r(hc, 11, 5, 2, 3);
      if (hs === 1) for (let i = 8; i < 18; i++) { const w = i % 4 < 2; r(hc, w ? 2 : 1, i, 3, 1); r(hc, w ? 11 : 12, i, 3, 1); }
      if (hs === 2 || hs === 6) { r(hc, 2, 5, 3, 6); r(hc, 11, 5, 3, 6); }
    }
    if (hs === 3) { r(hc, 4, -1, 2, 2); r(hc, 7, -2, 2, 3); r(hc, 10, -1, 2, 2); }
    if (hs === 4) r(hc, 6, -2, 4, 3);

    const G = "#222";
    if (a.acc === 1 && !B) { r(G, 4, 5, 8, 1); r(G, 4, 9, 3, 1); r(G, 9, 9, 3, 1); }
    if (a.acc === 2) { r(ac, 3, 0, S ? 9 : 10, 4); if (!B) r(sh(ac, -35), S ? 10 : 2, 4, S ? 5 : 12, 1); }
    if (a.acc === 4) { r("#333", 3, 0, S ? 8 : 10, 1); r(CLR[2], 1, 5, 2, 4); r(CLR[2], 13, 5, 2, 4); }
    if (a.acc === 5 && !B) r("#f4f4f4", S ? 8 : 4, 8, S ? 5 : 8, 3);
    if (a.acc === 6) { r(ac, 3, 0, S ? 9 : 10, 4); r("#fff", 6, -1, 3, 1); }

    outline(c);
    return c;
  }

  function spr(a, dir, fr) {
    if (!a.sp) a.sp = {};
    const k = dir + "_" + fr;
    return a.sp[k] || (a.sp[k] = mkChar(a, dir, fr));
  }

  const PD = { cone: [12, 10], galon: [12, 18], pot: [12, 12], drum: [16, 20], speaker: [16, 22], palet: [22, 14] };
  const PC = {};
  function prop(t) {
    if (PC[t]) return PC[t];
    const D = PD[t] || PD.cone, c = document.createElement("canvas");
    c.width = D[0] + 2; c.height = D[1] + 2;
    const X = c.getContext("2d");
    X.translate(1, 1);
    const r = (col, x, y, w, h) => { X.fillStyle = col; X.fillRect(x, y, w, h); };
    if (t === "cone") { r("#ff7a1a", 5, 0, 2, 2); r("#ff7a1a", 4, 2, 4, 3); r("#ff7a1a", 3, 5, 6, 2); r("#fff", 4, 3, 4, 1); r("#333", 1, 7, 10, 3); }
    if (t === "galon") { r("#2d6cdf", 4, 0, 4, 2); r("#bfe6ff", 3, 2, 6, 2); r("#58a6ff", 1, 4, 10, 13); r("#2d6cdf", 1, 16, 10, 2); }
    if (t === "pot") { r("#3fae5a", 3, 0, 2, 4); r("#3fae5a", 6, 0, 3, 5); r("#c0603a", 2, 5, 8, 6); }
    if (t === "drum") { r("#8a93a4", 2, 2, 12, 17); r("#aeb7c7", 1, 0, 14, 3); r("#222", 4, 5, 8, 2); }
    if (t === "speaker") { r("#fff", 3, 1, 10, 5); r("#d8dce6", 0, 6, 16, 16); r("#2a3550", 2, 11, 12, 4); }
    if (t === "palet") { r("#2d4a8a", 1, 0, 20, 6); r("#3a5aa8", 0, 5, 22, 7); }
    outline(c);
    return (PC[t] = c);
  }

  W.MS_SPR = { outline, spr, prop };
})(window);
