(function (W) {
  "use strict";
  const { $, R, rnd, vib, CLR, openSheet, closeSheet } = W.MS_CFG;
  const { sendPlayerAction } = W.MS_NET;

  let activeTok = 0;

  function shk(id) {
    const e = $(id);
    if (!e) return;
    e.classList.remove("sk");
    void e.offsetWidth;
    e.classList.add("sk");
  }

  function openTaskModal(term, role) {
    const tk = role === "TEKNISI";
    const k = term.kind;
    const tok = ++activeTok;

    const complete = () => {
      if (activeTok !== tok) return;
      activeTok++;
      closeSheet();
      vib([10, 30, 10]);
      sendPlayerAction("COMPLETE_TASK", { termId: term.id });
    };

    const iv = (fn, ms) => {
      const v = setInterval(() => {
        if (activeTok !== tok) { clearInterval(v); return; }
        fn();
      }, ms);
      return v;
    };

    const cancelBtn = '<button class="pb d" id="cx">BATAL</button>';

    if (k === 0) {
      const n = tk ? 3 : 4;
      const cs = [2, 3, 4, 5].slice(0, n);
      const rt = cs.slice().sort(() => R() - 0.5);
      let sel = -1, got = 0;
      const ys = (j) => 22 + j * 38;
      let sv = `<svg id="sv" width="230" height="${n * 38 + 8}" style="background:#10131f;display:block;margin:8px auto">`;
      cs.forEach((c, j) => {
        sv += `<rect x="2" y="${ys(j) - 9}" width="30" height="18" fill="#3a3f4e"/><circle class="pl" data-i="${j}" cx="36" cy="${ys(j)}" r="9" fill="${CLR[c]}" stroke="#10131f" stroke-width="3"/>`;
      });
      rt.forEach((c, j) => {
        sv += `<rect x="198" y="${ys(j) - 9}" width="30" height="18" fill="#3a3f4e"/><circle class="pt" data-c="${c}" data-j="${j}" cx="194" cy="${ys(j)}" r="9" fill="#1b1b26" stroke="${CLR[c]}" stroke-width="3"/>`;
      });
      sv += '<g id="wr" style="pointer-events:none"></g></svg>';
      openSheet(`<h2>KABEL SERVER</h2><div id="hm">Hubungkan kabel ke port warna sama</div>${sv}${cancelBtn}`);

      $("sv").onclick = (e) => {
        const c = e.target.closest("circle");
        if (!c) return;
        if (c.classList.contains("pl")) {
          if (c.dataset.d) return;
          sel = +c.dataset.i;
          document.querySelectorAll("#sv .pl").forEach((x) => x.setAttribute("stroke", "#10131f"));
          c.setAttribute("stroke", "#fff");
          vib(6);
        } else if (sel >= 0 && !c.dataset.d) {
          const col = +c.dataset.c, j = +c.dataset.j;
          if (col === cs[sel]) {
            const y1 = ys(sel), y2 = ys(j);
            const pa = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pa.setAttribute("d", `M46,${y1} C110,${y1} 120,${y2} 184,${y2}`);
            pa.setAttribute("fill", "none");
            pa.setAttribute("stroke", CLR[col]);
            pa.setAttribute("stroke-width", "6");
            $("wr").appendChild(pa);
            c.dataset.d = 1;
            const pl = document.querySelector(`#sv .pl[data-i="${sel}"]`);
            pl.dataset.d = 1;
            pl.setAttribute("stroke", "#10131f");
            sel = -1;
            if (++got === n) { $("hm").textContent = "Jaringan nyala!"; setTimeout(complete, 300); }
          } else {
            vib(35);
            shk("sv");
            sel = -1;
            $("hm").textContent = "SALAH PORT!";
          }
        }
      };
    } else if (k === 1) {
      const need = tk ? 1 : 2;
      let got = 0, lv = 0, hold = false, tt = 0;
      const lo = tk ? 56 : 62, hi = tk ? 96 : 84;
      openSheet(`<h2>ISI GALON</h2><div id="hm">Tahan tombol, lepas di zona hijau (0/${need})</div><div style="position:relative;width:80px;height:140px;margin:10px auto;background:#10131f;border:4px solid #bfe6ff"><div style="position:absolute;left:0;right:0;bottom:${lo}%;height:${hi - lo}%;background:rgba(94,227,139,.4)"></div><div id="wt" style="position:absolute;left:0;right:0;bottom:0;height:0;background:#58a6ff"></div></div><button class="pb g" id="fb">TAHAN: ISI AIR</button>${cancelBtn}`);
      const fb = $("fb");
      fb.onpointerdown = (e) => { e.preventDefault(); hold = true; };
      const up = () => {
        if (!hold) return;
        hold = false;
        if (lv >= lo && lv <= hi) {
          got++;
          if (got >= need) { $("hm").textContent = "Galon penuh!"; setTimeout(complete, 250); return; }
          lv = 0;
          $("hm").textContent = `Ganti galon (${got}/${need})`;
        } else {
          lv = 0;
          shk("fb");
          $("hm").textContent = "TUMPAH / KURANG! Ulangi";
        }
      };
      fb.onpointerup = up; fb.onpointerleave = up; fb.onpointercancel = up;
      iv(() => {
        tt += 0.03;
        if (hold && got < need) {
          lv += (tk ? 1.2 : 1.6) * (1 + 0.5 * Math.sin(tt * 4));
          if (lv >= 100) { lv = 0; hold = false; shk("fb"); $("hm").textContent = "TUMPAH! Ulangi"; }
        }
        if ($("wt")) $("wt").style.height = lv + "%";
      }, 30);
    } else if (k === 2) {
      const L = tk ? 4 : 5;
      const q = Array.from({ length: L }, () => Math.floor(R() * 4));
      let pos = 0, ph = 0, ti = -2;
      const bt = [2, 3, 4, 5].map((c, j) => `<button class="wb" data-i="${j}" style="background:${CLR[c]};opacity:.45"></button>`).join("");
      openSheet(`<h2>PROYEKTOR AULA</h2><div id="hm">Hafalkan urutan lampu...</div><div class="row" id="rm">${bt}</div>${cancelBtn}`);
      const fl = (j, on) => { const r = $("rm"); if (!r) return; const b = r.children[j]; b.style.opacity = on ? 1 : 0.45; };
      iv(() => {
        if (ph !== 0) return;
        ti++;
        const st = ti >> 1;
        for (let j = 0; j < 4; j++) fl(j, 0);
        if (st >= L) { ph = 1; pos = 0; $("hm").textContent = "Giliran kamu!"; return; }
        if ((ti & 1) === 1 && st >= 0) fl(q[st], 1);
      }, 360);
      $("rm").onclick = (e) => {
        const b = e.target.closest("button");
        if (!b || ph !== 1) return;
        const j = +b.dataset.i;
        fl(j, 1);
        setTimeout(() => fl(j, 0), 150);
        if (j === q[pos]) {
          if (++pos === L) { ph = 2; $("hm").textContent = "Proyektor nyala!"; setTimeout(complete, 250); }
        } else {
          ph = 0; ti = -2; pos = 0; shk("rm"); $("hm").textContent = "SALAH! Lihat lagi...";
        }
      };
    } else if (k === 3) {
      const need = tk ? 5 : 7;
      let got = 0, sp = null, wait = 4;
      openSheet(`<h2>PRINTER MACET</h2><div id="hm">Tarik kertas macet! (0/${need})</div><div id="ar" style="position:relative;width:240px;height:150px;margin:8px auto;background:#d8dce6"></div>${cancelBtn}`);
      iv(() => {
        const ar = $("ar");
        if (!ar) return;
        if (sp) {
          if (--sp.l <= 0) { sp.e.remove(); sp = null; wait = 3; }
        } else if (got < need && --wait <= 0) {
          const b = document.createElement("button");
          b.className = "pp";
          b.style.left = Math.floor(rnd(4, 206)) + "px";
          b.style.top = Math.floor(rnd(4, 116)) + "px";
          b.onclick = () => {
            if (sp && sp.e === b) {
              b.remove(); sp = null; got++;
              $("hm").textContent = `Kertas ditarik! (${got}/${need})`;
              if (got >= need) complete();
              else wait = 2;
            }
          };
          ar.appendChild(b);
          sp = { e: b, l: tk ? 14 : 10 };
        }
      }, 100);
    } else if (k === 4) {
      const len = tk ? 4 : 5;
      let code = "", inp = "", show = 0;
      const gen = () => {
        code = Array.from({ length: len }, () => Math.floor(R() * 10)).join("");
        show = tk ? 32 : 22;
        inp = "";
      };
      gen();
      const KP = `<div class="kp" id="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((n) => `<button data-n="${n}">${n}</button>`).join("")}</div>`;
      openSheet(`<h2>BRANKAS KANTOR</h2><div id="hm">Hafalkan kodenya!</div><div class="seq" id="cd">${code.split("").join(" ")}</div><div class="seq" id="iv" style="color:#fff">_</div>${KP}${cancelBtn}`);
      iv(() => {
        if (show > 0 && --show === 0) {
          $("cd").textContent = code.split("").map(() => "*").join(" ");
          $("hm").textContent = "Masukkan kode";
        }
      }, 100);
      $("kp").onclick = (e) => {
        const b = e.target.closest("button");
        if (!b || show > 0) return;
        const n = b.dataset.n;
        if (n === "C") inp = "";
        else if (n === "OK") {
          if (inp === code) { $("hm").textContent = "Brankas terbuka!"; setTimeout(complete, 250); }
          else { shk("kp"); gen(); $("cd").textContent = code.split("").join(" "); $("hm").textContent = "SALAH! Kode baru:"; }
        } else if (inp.length < len) inp += n;
        $("iv").textContent = inp.split("").join(" ") || "_";
      };
    } else {
      const n = tk ? 4 : 5;
      const st = Array(n).fill(true);
      const tg = (j) => { for (let d = -1; d <= 1; d++) if (st[j + d] !== undefined) st[j + d] = !st[j + d]; };
      const all = () => st.every(Boolean);
      do { for (let i = 0; i < 3; i++) tg(Math.floor(R() * n)); } while (all());
      openSheet(`<h2>PANEL LISTRIK</h2><div id="hm">Nyalakan semua lampu hijau!</div><div class="row" id="bk"></div>${cancelBtn}`);
      const rd = () => {
        $("bk").innerHTML = st.map((on, j) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:4px"><div style="width:14px;height:14px;background:${on ? "#5ee38b" : "#4a2a2a"}"></div><button class="wb" data-j="${j}" style="width:36px;height:70px;background:#2a3038;position:relative"><i style="position:absolute;left:6px;right:6px;height:28px;background:${on ? "#5ee38b" : "#ff5d6c"};${on ? "top:6px" : "bottom:6px"}"></i></button></div>`).join("");
      };
      rd();
      $("bk").onclick = (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        tg(+b.dataset.j);
        rd();
        if (all()) { $("hm").textContent = "Listrik menyala!"; setTimeout(complete, 250); }
      };
    }

    $("cx").onclick = () => {
      activeTok++;
      closeSheet();
    };
  }

  W.MS_TASKS = { openTaskModal };
})(window);
