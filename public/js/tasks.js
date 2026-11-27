(function (W) {
  "use strict";
  const { $, vib, openSheet, closeSheet, toast } = W.MS_CFG;
  const { beep } = W.MS_AUDIO;

  if (!W.MS_TASK_GFX) {
    const s = document.createElement("script");
    s.src = "/js/taskGfx.js?v=4";
    document.head.appendChild(s);
  }

  let cleanupFn = null;
  let lastKind = "";
  let deck = [];

  function stopLoop() {
    if (typeof cleanupFn === "function") {
      cleanupFn();
      cleanupFn = null;
    }
  }

  function showTaskSheet(html) {
    openSheet(html);
    const sh = $("sheet");
    if (sh) {
      sh.classList.remove("hide");
      sh.classList.add("on");
    }
  }

  function hideTaskSheet() {
    stopLoop();
    closeSheet();
    const sh = $("sheet");
    if (sh) {
      sh.classList.remove("on");
      sh.classList.add("hide");
    }
  }

  function pickVariedKind(rawType) {
    const t = String(rawType || "").toLowerCase();
    let mapped = null;
    if (t.includes("wir") || t.includes("kab")) mapped = "wiring";
    else if (t.includes("freq") || t.includes("slid") || t.includes("cal")) mapped = "frequency";
    else if (t.includes("scan") || t.includes("bio")) mapped = "biometric";
    else if (t.includes("fuse") || t.includes("pow") || t.includes("sek")) mapped = "fuse";
    else if (t.includes("serv") || t.includes("data") || t.includes("up")) mapped = "server";
    else if (t.includes("key") || t.includes("pin") || t.includes("code")) mapped = "keypad";

    if (mapped && mapped !== lastKind) {
      lastKind = mapped;
      return mapped;
    }

    if (deck.length === 0) {
      deck = ["wiring", "frequency", "biometric", "fuse", "server", "keypad"].sort(() => Math.random() - 0.5);
      if (deck[0] === lastKind) deck.push(deck.shift());
    }
    const chosen = deck.shift();
    lastKind = chosen;
    return chosen;
  }

  function playWiring(gfx, _isTech, finish) {
    const colors = [
      { id: 0, name: "MERAH", hex: "#ef4444", dark: "#7f1d1d" },
      { id: 1, name: "BIRU", hex: "#38bdf8", dark: "#0c4a6e" },
      { id: 2, name: "KUNING", hex: "#facc15", dark: "#713f12" },
      { id: 3, name: "HIJAU", hex: "#22c55e", dark: "#14532d" }
    ];
    const left = [...colors].sort(() => Math.random() - 0.5);
    const right = [...colors].sort(() => Math.random() - 0.5);
    const doneSet = new Set();
    const sparks = [];
    let selLeft = null;

    showTaskSheet(
      gfx.renderCrtShell({
        code: "TERM-01",
        title: "PANEL KABEL",
        subtitle: "Hubungkan soket kiri ke soket kanan dengan warna kabel yang sama!",
        accent: gfx.PAL.cyan,
        bodyHtml:
          `<canvas id="wCv" width="260" height="148" style="width:100%;border:2px solid #334155;image-rendering:pixelated;display:block"></canvas>` +
          `<div style="display:flex;justify-content:space-between;gap:6px;margin-top:8px">` +
          `<div id="wColL" style="display:flex;flex-direction:column;gap:5px;width:48%"></div>` +
          `<div id="wColR" style="display:flex;flex-direction:column;gap:5px;width:48%"></div>` +
          `</div>`
      })
    );

    const rowY = [22, 56, 90, 124];
    const anim = setInterval(() => {
      const cv = $("wCv");
      if (!cv) return clearInterval(anim);
      const ctx = cv.getContext("2d");
      gfx.drawPixelGrid(ctx, cv.width, cv.height);

      left.forEach((c, i) => {
        const y = rowY[i];
        ctx.fillStyle = c.dark;
        ctx.fillRect(0, y - 8, 28, 16);
        ctx.fillStyle = c.hex;
        ctx.fillRect(4, y - 5, 22, 10);
        if (selLeft === c.id) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(2, y - 10, 26, 20);
        }
      });

      right.forEach((c, i) => {
        const y = rowY[i];
        ctx.fillStyle = c.dark;
        ctx.fillRect(cv.width - 28, y - 8, 28, 16);
        ctx.fillStyle = c.hex;
        ctx.fillRect(cv.width - 26, y - 5, 22, 10);
      });

      doneSet.forEach((id) => {
        const li = left.findIndex((x) => x.id === id);
        const ri = right.findIndex((x) => x.id === id);
        const c = colors[id];
        const y1 = rowY[li];
        const y2 = rowY[ri];
        ctx.strokeStyle = c.hex;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(28, y1);
        ctx.lineTo(106, y1);
        ctx.lineTo(154, y2);
        ctx.lineTo(cv.width - 28, y2);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillRect(126, Math.round((y1 + y2) / 2) - 2, 8, 4);
      });

      gfx.stepAndDrawSparks(ctx, sparks);
    }, 35);
    cleanupFn = () => clearInterval(anim);

    const renderBtns = () => {
      const boxL = $("wColL");
      const boxR = $("wColR");
      if (!boxL || !boxR) return;

      boxL.innerHTML = left.map((c) => {
        const ok = doneSet.has(c.id);
        return gfx.drawPixelButton(
          `${ok ? "✓ " : "▶ "}${c.name}`,
          `data-l="${c.id}"`,
          ok ? "#1e293b" : c.hex,
          ok ? "#64748b" : "#050914",
          selLeft === c.id ? "#ffffff" : "#0f172a"
        );
      }).join("");

      boxR.innerHTML = right.map((c) => {
        const ok = doneSet.has(c.id);
        return gfx.drawPixelButton(
          `${c.name}${ok ? " ✓" : " ◀"}`,
          `data-r="${c.id}"`,
          ok ? "#1e293b" : c.hex,
          ok ? "#64748b" : "#050914"
        );
      }).join("");

      boxL.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          const id = Number(b.dataset.l);
          if (doneSet.has(id)) return;
          selLeft = id;
          beep(450, 0.05);
          vib(8);
          renderBtns();
        };
      });

      boxR.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          const id = Number(b.dataset.r);
          if (doneSet.has(id)) return;
          if (selLeft === null) return toast("Pilih soket kiri dulu!", "i");
          const rIdx = right.findIndex((x) => x.id === id);
          if (selLeft === id) {
            doneSet.add(id);
            gfx.spawnPixelSparks(sparks, 232, rowY[rIdx], colors[id].hex, 14);
            selLeft = null;
            beep(560 + doneSet.size * 90, 0.08);
            vib(15);
            renderBtns();
            if (doneSet.size >= 4) {
              setTimeout(() => { hideTaskSheet(); finish(); }, 260);
            }
          } else {
            gfx.spawnPixelSparks(sparks, 232, rowY[rIdx], "#ef4444", 10);
            selLeft = null;
            beep(150, 0.14);
            vib(35);
            toast("KORSLETING! WARNA SALAH", "b");
            renderBtns();
          }
        };
      });
    };

    renderBtns();
    if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
  }

  function playFrequency(gfx, isTech, finish) {
    const targetFreq = 2 + Math.floor(Math.random() * 5);
    let userFreq = 1;
    let phase = 0;
    let lock = 0;
    const goal = isTech ? 18 : 28;

    showTaskSheet(
      gfx.renderCrtShell({
        code: "TERM-02",
        title: "OSILOSKOP RADIO",
        subtitle: "Geser tuas frekuensi sampai gelombang kuning menyatu dengan hijau!",
        accent: gfx.PAL.green,
        bodyHtml:
          `<canvas id="fCv" width="260" height="112" style="width:100%;border:2px solid #22c55e;image-rendering:pixelated;display:block"></canvas>` +
          `<div style="margin:8px 0 4px;font-size:8px;color:#22c55e">SINKRONISASI SINYAL: <span id="fPct">0%</span></div>` +
          `<input id="fRng" type="range" min="1" max="7" step="0.1" value="1" style="width:100%;accent-color:#facc15">`
      })
    );

    $("fRng").oninput = (e) => { userFreq = parseFloat(e.target.value); };

    const iv = setInterval(() => {
      const cv = $("fCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");
      phase += 0.2;
      gfx.drawPixelGrid(ctx, cv.width, cv.height, 20, "#0b2418");

      ctx.fillStyle = "#14532d";
      ctx.fillRect(0, 55, cv.width, 2);

      ctx.fillStyle = "#22c55e";
      for (let x = 0; x < cv.width; x += 4) {
        const y = 56 + Math.sin(x * 0.03 * targetFreq + phase) * 34;
        ctx.fillRect(x, Math.round(y), 3, 3);
      }

      const ok = Math.abs(userFreq - targetFreq) <= 0.35;
      ctx.fillStyle = ok ? "#ffffff" : "#facc15";
      for (let x = 0; x < cv.width; x += 4) {
        const y = 56 + Math.sin(x * 0.03 * userFreq + phase) * 34;
        ctx.fillRect(x, Math.round(y), 3, 3);
      }

      lock = ok ? lock + 1 : Math.max(0, lock - 1);
      if (ok && lock % 6 === 0) beep(520 + lock * 10, 0.04);

      const pct = Math.min(100, Math.round((lock / goal) * 100));
      if ($("fPct")) $("fPct").textContent = pct + "%";

      if (lock >= goal) {
        clearInterval(iv);
        beep(780, 0.12);
        vib(18);
        hideTaskSheet();
        finish();
      }
    }, 45);
    cleanupFn = () => clearInterval(iv);
    if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
  }

  function playBiometric(gfx, isTech, finish) {
    let pct = 0;
    let hold = false;
    let ly = 14;
    let dir = 1;
    const rate = isTech ? 2.8 : 2.0;

    showTaskSheet(
      gfx.renderCrtShell({
        code: "TERM-03",
        title: "SCAN BIOMETRIK",
        subtitle: "Tahan tombol pemindai di bawah sampai laser mencapai 100%!",
        accent: gfx.PAL.cyan,
        bodyHtml:
          `<canvas id="bCv" width="260" height="118" style="width:100%;border:2px solid #38bdf8;image-rendering:pixelated;display:block"></canvas>` +
          `<button class="pb g" id="bBtn" style="margin-top:8px;width:100%;user-select:none">🖐 TAHAN PEMINDAI (<span id="bPct">0%</span>)</button>`
      })
    );

    const btn = $("bBtn");
    btn.onpointerdown = () => { hold = true; beep(430, 0.05); };
    btn.onpointerup = () => { hold = false; };
    btn.onpointerleave = () => { hold = false; };

    const iv = setInterval(() => {
      const cv = $("bCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");
      gfx.drawPixelGrid(ctx, cv.width, cv.height);

      for (let r = 10; r <= 42; r += 8) {
        ctx.strokeStyle = hold ? "#38bdf8" : "#1e3a5f";
        ctx.lineWidth = 3;
        ctx.strokeRect(130 - r * 0.7, 59 - r, r * 1.4, r * 2);
      }

      if (hold) {
        pct = Math.min(100, pct + rate);
        ly += dir * 4;
        if (ly >= 104 || ly <= 14) dir *= -1;
        if (Math.round(pct) % 16 === 0) beep(520 + pct * 3, 0.03);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(65, ly, 130, 3);
        ctx.fillStyle = "rgba(34,197,94,.22)";
        ctx.fillRect(65, ly - 5, 130, 12);
      }

      if ($("bPct")) $("bPct").textContent = Math.floor(pct) + "%";
      if (pct >= 100) {
        clearInterval(iv);
        beep(820, 0.12);
        vib(18);
        hideTaskSheet();
        finish();
      }
    }, 35);
    cleanupFn = () => clearInterval(iv);
    if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
  }

  function playFuse(gfx, isTech, finish) {
    const len = isTech ? 4 : 5;
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 4));
    let step = 0;

    const render = () => {
      const leds = seq.map((s, i) => {
        const bg = i < step ? "#22c55e" : i === step ? "#facc15" : "#1e293b";
        return `<div style="flex:1;padding:6px 2px;background:${bg};color:#050914;font-size:9px;text-align:center;border:2px solid #0f172a">S${s + 1}</div>`;
      }).join("");

      const btns = [0, 1, 2, 3].map((i) =>
        gfx.drawPixelButton(`⚡ S${i + 1}`, `data-sw="${i}" style="width:22%;padding:14px 0"`, "#1e293b", "#38bdf8", "#38bdf8")
      ).join("");

      showTaskSheet(
        gfx.renderCrtShell({
          code: "TERM-04",
          title: "GARDU SEKRING",
          subtitle: "Nyalakan sakelar listrik sesuai urutan indikator kuning!",
          accent: gfx.PAL.amber,
          bodyHtml:
            `<div style="display:flex;gap:4px;margin-bottom:12px">${leds}</div>` +
            `<div style="display:flex;justify-content:space-between;gap:4px">${btns}</div>`
        })
      );

      document.querySelectorAll("#box .chip[data-sw]").forEach((b) => {
        b.onclick = () => {
          if (Number(b.dataset.sw) === seq[step]) {
            beep(490 + step * 90, 0.07);
            vib(12);
            step++;
            if (step >= len) { hideTaskSheet(); finish(); }
            else render();
          } else {
            beep(140, 0.15);
            vib(35);
            step = 0;
            toast("URUTAN SALAH! ULANG DARI AWAL", "b");
            render();
          }
        };
      });
      if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
    };
    render();
  }

  function playServer(gfx, isTech, finish) {
    let caught = 0;
    const goal = isTech ? 4 : 5;
    let bx = 108;
    let px = 30 + Math.random() * 190;
    let py = 8;

    showTaskSheet(
      gfx.renderCrtShell({
        code: "TERM-05",
        title: "SERVER BUFFER",
        subtitle: "Gerakkan slot ungu untuk menangkap paket data hijau!",
        accent: gfx.PAL.purple,
        bodyHtml:
          `<canvas id="sCv" width="260" height="122" style="width:100%;border:2px solid #a855f7;image-rendering:pixelated;display:block"></canvas>` +
          `<div style="display:flex;gap:8px;margin-top:8px">` +
          `<button class="pb" id="sL" style="flex:1">◀ GESER KIRI</button>` +
          `<button class="pb" id="sR" style="flex:1">GESER KANAN ▶</button>` +
          `</div>`
      })
    );

    $("sL").onclick = () => { bx = Math.max(8, bx - 38); beep(390, 0.03); };
    $("sR").onclick = () => { bx = Math.min(208, bx + 38); beep(430, 0.03); };

    const iv = setInterval(() => {
      const cv = $("sCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");

      py += 3.7;
      if (py >= 96 && py <= 114 && px + 12 >= bx && px <= bx + 44) {
        caught++;
        beep(610 + caught * 70, 0.07);
        vib(14);
        py = 8;
        px = 20 + Math.random() * 210;
        if (caught >= goal) {
          clearInterval(iv);
          hideTaskSheet();
          finish();
          return;
        }
      } else if (py > 122) {
        py = 8;
        px = 20 + Math.random() * 210;
        beep(170, 0.08);
      }

      gfx.drawPixelGrid(ctx, cv.width, cv.height, 18, "#180f29");
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(Math.round(px), Math.round(py), 12, 12);
      ctx.fillStyle = "#bbf7d0";
      ctx.fillRect(Math.round(px) + 3, Math.round(py) + 3, 6, 6);

      ctx.fillStyle = "#a855f7";
      ctx.fillRect(bx, 102, 44, 12);
      ctx.fillStyle = "#f3e8ff";
      ctx.fillRect(bx + 4, 102, 36, 3);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px monospace";
      ctx.fillText(`DATA: ${caught}/${goal}`, 8, 14);
    }, 35);
    cleanupFn = () => clearInterval(iv);
    if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
  }

  function playKeypad(gfx, isTech, finish) {
    const len = isTech ? 3 : 4;
    let pin = "";
    for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 9) + 1;
    let typed = "";

    const render = () => {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
        gfx.drawPixelButton(String(n), `data-n="${n}" style="width:29%;padding:10px 0;font-size:11px"`, "#0f172a", "#38bdf8", "#334155")
      ).join("");

      showTaskSheet(
        gfx.renderCrtShell({
          code: "TERM-06",
          title: "DEKRIPSI SANDI",
          subtitle: `Masukkan kode keamanan: <b style="color:#facc15;font-size:11px">${pin}</b>`,
          accent: gfx.PAL.green,
          bodyHtml:
            `<div style="background:#020617;border:2px solid #22c55e;color:#22c55e;font-size:14px;letter-spacing:6px;text-align:center;padding:8px;margin-bottom:8px">${typed.padEnd(len, "_")}</div>` +
            `<div class="rw" style="justify-content:center;gap:6px">${nums}</div>`
        })
      );

      document.querySelectorAll("#box .chip[data-n]").forEach((b) => {
        b.onclick = () => {
          typed += b.dataset.n;
          beep(480 + typed.length * 80, 0.06);
          vib(8);
          if (typed === pin) {
            hideTaskSheet();
            finish();
          } else if (typed.length >= len) {
            beep(150, 0.15);
            vib(35);
            typed = "";
            toast("KODE SANDI DITOLAK!", "b");
            render();
          } else {
            render();
          }
        };
      });
      if ($("tCancel")) $("tCancel").onclick = hideTaskSheet;
    };
    render();
  }

  function getGfx() {
    if (W.MS_TASK_GFX) return W.MS_TASK_GFX;
    return {
      PAL: { cyan: "#38bdf8", green: "#22c55e", amber: "#facc15", purple: "#a855f7" },
      renderCrtShell: ({ title, subtitle, bodyHtml }) =>
        `<h2>${title}</h2><p>${subtitle}</p>${bodyHtml}<button class="pb d" id="tCancel" style="margin-top:8px">BATAL</button>`,
      drawPixelGrid: (ctx, w, h) => { ctx.fillStyle = "#050914"; ctx.fillRect(0, 0, w, h); },
      drawPixelButton: (lbl, attrs, bg, fg) => `<button class="chip" ${attrs} style="background:${bg};color:${fg}">${lbl}</button>`,
      spawnPixelSparks: () => {},
      stepAndDrawSparks: () => {}
    };
  }

  function openTaskModal(taskType, isTech, onComplete) {
    stopLoop();
    const gfx = getGfx();
    const kind = pickVariedKind(taskType);
    const done = () => {
      toast("TUGAS TERMINAL SELESAI!", "g");
      if (typeof onComplete === "function") onComplete();
    };

    if (kind === "wiring") return playWiring(gfx, isTech, done);
    if (kind === "frequency") return playFrequency(gfx, isTech, done);
    if (kind === "biometric") return playBiometric(gfx, isTech, done);
    if (kind === "fuse") return playFuse(gfx, isTech, done);
    if (kind === "server") return playServer(gfx, isTech, done);
    return playKeypad(gfx, isTech, done);
  }

  W.MS_TASKS = { openTaskModal };
})(window);
