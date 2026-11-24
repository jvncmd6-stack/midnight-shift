(function (W) {
  "use strict";
  const { $, vib, openSheet, closeSheet, toast } = W.MS_CFG;
  const { beep } = W.MS_AUDIO;

  let activeCleanup = null;
  let rotationCounter = 0;

  function cleanupActive() {
    if (typeof activeCleanup === "function") {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function wrapCrtFrame(title, subtitle, bodyHtml) {
    return (
      `<div class="px-crt" style="background:#080d18;border:3px solid #38bdf8;box-shadow:inset 0 0 18px rgba(56,189,248,.22),0 4px 0 #020617;padding:10px;position:relative;overflow:hidden">` +
      `<div style="position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0px,rgba(0,0,0,.22) 1px,transparent 1px,transparent 3px)"></div>` +
      `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e293b;padding-bottom:6px;margin-bottom:8px">` +
      `<div style="display:flex;gap:4px"><span style="width:7px;height:7px;background:#ef4444;display:inline-block"></span><span style="width:7px;height:7px;background:#facc15;display:inline-block"></span><span style="width:7px;height:7px;background:#22c55e;display:inline-block"></span></div>` +
      `<span style="font-size:8px;color:#38bdf8;letter-spacing:1px">SYS.TERM // ${title}</span>` +
      `</div>` +
      `<p style="font-size:9px;color:#cbd5e1;margin:0 0 8px;line-height:1.4">${subtitle}</p>` +
      bodyHtml +
      `<button class="pb d" id="tCancel" style="margin-top:10px;width:100%">✖ TUTUP TERMINAL</button>` +
      `</div>`
    );
  }

  function resolveTaskKind(rawType) {
    const t = String(rawType || "").toLowerCase();
    if (t.includes("wir") || t.includes("kab")) return "wiring";
    if (t.includes("freq") || t.includes("slid") || t.includes("cal") || t.includes("sinyal")) return "frequency";
    if (t.includes("scan") || t.includes("bio") || t.includes("sidik")) return "biometric";
    if (t.includes("fuse") || t.includes("sek") || t.includes("pow") || t.includes("listrik")) return "fuse";
    if (t.includes("serv") || t.includes("data") || t.includes("up") || t.includes("down")) return "server";
    if (t.includes("key") || t.includes("pin") || t.includes("code")) return "keypad";

    // Rotasi otomatis 6 mini-game jika tipe terminal generik / tidak spesifik
    const pool = ["wiring", "frequency", "biometric", "fuse", "server", "keypad"];
    const picked = pool[rotationCounter % pool.length];
    rotationCounter++;
    return picked;
  }

  /* ========================================================================
     1. SAMBUNG KABEL PANEL (Canvas Visual + Spark Effect)
     ======================================================================== */
  function runWiringTask(isTech, onComplete) {
    const palette = [
      { id: 0, name: "MERAH", hex: "#ef4444", dark: "#7f1d1d" },
      { id: 1, name: "BIRU", hex: "#38bdf8", dark: "#0c4a6e" },
      { id: 2, name: "KUNING", hex: "#facc15", dark: "#713f12" },
      { id: 3, name: "HIJAU", hex: "#22c55e", dark: "#14532d" }
    ];
    const leftOrder = [...palette].sort(() => Math.random() - 0.5);
    const rightOrder = [...palette].sort(() => Math.random() - 0.5);
    const connected = new Set();
    let selectedLeft = null;

    openSheet(
      wrapCrtFrame(
        "PANEL KABEL",
        "Klik soket kiri lalu klik soket kanan dengan warna yang sama!",
        `<canvas id="wireCv" width="260" height="156" style="width:100%;background:#04070f;border:2px solid #334155;image-rendering:pixelated;display:block"></canvas>` +
        `<div style="display:flex;justify-content:space-between;margin-top:8px;gap:6px">` +
        `<div id="wLeft" style="display:flex;flex-direction:column;gap:5px;width:48%"></div>` +
        `<div id="wRight" style="display:flex;flex-direction:column;gap:5px;width:48%"></div>` +
        `</div>`
      )
    );

    const drawWires = () => {
      const cv = $("wireCv");
      if (!cv) return;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#04070f";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Grid latar piksel
      ctx.fillStyle = "#0f172a";
      for (let gx = 8; gx < cv.width; gx += 16) {
        for (let gy = 8; gy < cv.height; gy += 16) ctx.fillRect(gx, gy, 2, 2);
      }

      const rowY = [24, 58, 92, 126];
      leftOrder.forEach((c, idx) => {
        const y = rowY[idx];
        ctx.fillStyle = c.dark;
        ctx.fillRect(0, y - 8, 28, 16);
        ctx.fillStyle = c.hex;
        ctx.fillRect(4, y - 5, 20, 10);
        if (selectedLeft === c.id) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.strokeRect(2, y - 10, 26, 20);
        }
      });

      rightOrder.forEach((c, idx) => {
        const y = rowY[idx];
        ctx.fillStyle = c.dark;
        ctx.fillRect(cv.width - 28, y - 8, 28, 16);
        ctx.fillStyle = c.hex;
        ctx.fillRect(cv.width - 24, y - 5, 20, 10);
      });

      // Gambar kabel yang sudah tersambung dengan gaya stepped pixel
      connected.forEach((colorId) => {
        const lIdx = leftOrder.findIndex((x) => x.id === colorId);
        const rIdx = rightOrder.findIndex((x) => x.id === colorId);
        const c = palette[colorId];
        const y1 = rowY[lIdx];
        const y2 = rowY[rIdx];

        ctx.strokeStyle = c.hex;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(28, y1);
        ctx.lineTo(110, y1);
        ctx.lineTo(150, y2);
        ctx.lineTo(cv.width - 28, y2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(126, Math.round((y1 + y2) / 2) - 2, 8, 4);
      });
    };

    const renderButtons = () => {
      const lBox = $("wLeft");
      const rBox = $("wRight");
      if (!lBox || !rBox) return;

      lBox.innerHTML = leftOrder.map((c) => {
        const done = connected.has(c.id);
        const active = selectedLeft === c.id;
        return `<button class="chip" data-lid="${c.id}" style="background:${done ? "#1e293b" : c.hex};color:${done ? "#64748b" : "#050811"};border:2px solid ${active ? "#fff" : "#0f172a"};font-size:8px;padding:7px 4px">${done ? "✓ " : "▶ "}${c.name}</button>`;
      }).join("");

      rBox.innerHTML = rightOrder.map((c) => {
        const done = connected.has(c.id);
        return `<button class="chip" data-rid="${c.id}" style="background:${done ? "#1e293b" : c.hex};color:${done ? "#64748b" : "#050811"};border:2px solid #0f172a;font-size:8px;padding:7px 4px">${c.name}${done ? " ✓" : " ◀"}</button>`;
      }).join("");

      lBox.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          const id = Number(b.dataset.lid);
          if (connected.has(id)) return;
          selectedLeft = id;
          beep(440, 0.05);
          vib(8);
          drawWires();
          renderButtons();
        };
      });

      rBox.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          const id = Number(b.dataset.rid);
          if (connected.has(id)) return;
          if (selectedLeft === null) {
            toast("Pilih soket kiri dulu!", "i");
            return;
          }
          if (selectedLeft === id) {
            connected.add(id);
            selectedLeft = null;
            beep(560 + connected.size * 90, 0.08);
            vib(15);
            drawWires();
            renderButtons();
            if (connected.size >= 4) {
              setTimeout(() => {
                cleanupActive();
                closeSheet();
                toast("KABEL PANEL TERSAMBUNG!", "g");
                onComplete();
              }, 220);
            }
          } else {
            selectedLeft = null;
            beep(150, 0.14);
            vib(35);
            toast("KORSLETING! WARNA TIDAK COCOK", "b");
            drawWires();
            renderButtons();
          }
        };
      });
    };

    drawWires();
    renderButtons();
    $("tCancel").onclick = () => { cleanupActive(); closeSheet(); };
  }

  /* ========================================================================
     2. KALIBRASI GELOMBANG FREKUENSI (Osiloskop Pixel Art)
     ======================================================================== */
  function runFrequencyTask(isTech, onComplete) {
    const targetFreq = 2 + Math.floor(Math.random() * 5);
    let userFreq = 1;
    let phase = 0;
    let lockProgress = 0;
    const needLock = isTech ? 22 : 34;

    openSheet(
      wrapCrtFrame(
        "OSILOSKOP SINYAL",
        "Geser frekuensi hingga gelombang kuning menyatu dengan hijau!",
        `<canvas id="oscCv" width="260" height="110" style="width:100%;background:#030712;border:2px solid #22c55e;image-rendering:pixelated;display:block"></canvas>` +
        `<div style="margin:8px 0 4px;font-size:8px;color:#22c55e">SINKRONISASI: <span id="oscPct">0%</span></div>` +
        `<input id="oscRange" type="range" min="1" max="7" step="0.1" value="1" style="width:100%;accent-color:#facc15;cursor:pointer">`
      )
    );

    const slider = $("oscRange");
    slider.oninput = () => { userFreq = parseFloat(slider.value); };

    const iv = setInterval(() => {
      const cv = $("oscCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");
      phase += 0.18;

      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Garis tengah CRT
      ctx.fillStyle = "#0f291e";
      ctx.fillRect(0, 54, cv.width, 2);

      // Gelombang Target (Hijau)
      ctx.fillStyle = "#22c55e";
      for (let x = 0; x < cv.width; x += 4) {
        const y = 55 + Math.sin(x * 0.03 * targetFreq + phase) * 34;
        ctx.fillRect(x, Math.round(y), 3, 3);
      }

      // Gelombang Pemain (Kuning)
      const diff = Math.abs(userFreq - targetFreq);
      const matched = diff <= 0.35;
      ctx.fillStyle = matched ? "#ffffff" : "#facc15";
      for (let x = 0; x < cv.width; x += 4) {
        const y = 55 + Math.sin(x * 0.03 * userFreq + phase) * 34;
        ctx.fillRect(x, Math.round(y), 3, 3);
      }

      if (matched) {
        lockProgress++;
        if (lockProgress % 6 === 0) beep(520 + lockProgress * 12, 0.04);
      } else {
        lockProgress = Math.max(0, lockProgress - 1);
      }

      const pct = Math.min(100, Math.round((lockProgress / needLock) * 100));
      if ($("oscPct")) $("oscPct").textContent = pct + "%";

      if (lockProgress >= needLock) {
        clearInterval(iv);
        beep(780, 0.12);
        vib(20);
        closeSheet();
        toast("FREKUENSI TERKUNCI!", "g");
        onComplete();
      }
    }, 45);

    activeCleanup = () => clearInterval(iv);
    $("tCancel").onclick = () => { cleanupActive(); closeSheet(); };
  }

  /* ========================================================================
     3. PEMINDAI BIOMETRIK LASER (Hold-to-Scan Pixel Finger)
     ======================================================================== */
  function runBiometricTask(isTech, onComplete) {
    let progress = 0;
    let scanning = false;
    let laserY = 10;
    let laserDir = 1;
    const speed = isTech ? 2.6 : 1.8;

    openSheet(
      wrapCrtFrame(
        "SCANNER BIOMETRIK",
        "Tahan tombol PINDAI di bawah sampai verifikasi 100%!",
        `<canvas id="bioCv" width="260" height="120" style="width:100%;background:#040914;border:2px solid #38bdf8;image-rendering:pixelated;display:block"></canvas>` +
        `<button class="pb g" id="bioHold" style="margin-top:8px;width:100%;user-select:none">🖐 TAHAN UNTUK MEMINDAI (<span id="bioPct">0%</span>)</button>`
      )
    );

    const btn = $("bioHold");
    btn.onpointerdown = () => { scanning = true; beep(420, 0.05); };
    btn.onpointerup = () => { scanning = false; };
    btn.onpointerleave = () => { scanning = false; };

    const iv = setInterval(() => {
      const cv = $("bioCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");

      ctx.fillStyle = "#040914";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Pola sidik jari piksel di tengah
      const cx = 130;
      const cy = 60;
      for (let r = 10; r <= 42; r += 8) {
        ctx.strokeStyle = scanning ? "#38bdf8" : "#1e3a5f";
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - r * 0.7, cy - r, r * 1.4, r * 2);
      }

      if (scanning) {
        progress = Math.min(100, progress + speed);
        laserY += laserDir * 4;
        if (laserY >= 108 || laserY <= 12) laserDir *= -1;
        if (Math.round(progress) % 15 === 0) beep(500 + progress * 4, 0.03);

        // Sinar laser pemindai
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(65, laserY, 130, 3);
        ctx.fillStyle = "rgba(34,197,94,0.22)";
        ctx.fillRect(65, laserY - 6, 130, 14);
      }

      if ($("bioPct")) $("bioPct").textContent = Math.floor(progress) + "%";

      if (progress >= 100) {
        clearInterval(iv);
        beep(820, 0.12);
        vib(20);
        closeSheet();
        toast("IDENTITAS TERVERIFIKASI!", "g");
        onComplete();
      }
    }, 35);

    activeCleanup = () => clearInterval(iv);
    $("tCancel").onclick = () => { cleanupActive(); closeSheet(); };
  }

  /* ========================================================================
     4. PANEL SEKRING TEGANGAN (Simon-Says / Urutan Sakelar LED)
     ======================================================================== */
  function runFuseTask(isTech, onComplete) {
    const count = isTech ? 4 : 5;
    const seq = Array.from({ length: count }, () => Math.floor(Math.random() * 4));
    let step = 0;

    const render = () => {
      const leds = seq.map((s, idx) => {
        const done = idx < step;
        const curr = idx === step;
        const bg = done ? "#22c55e" : curr ? "#facc15" : "#1e293b";
        return `<div style="flex:1;padding:6px 2px;background:${bg};color:#050811;font-size:9px;text-align:center;border:2px solid #0f172a">S${s + 1}</div>`;
      }).join("");

      const switches = [0, 1, 2, 3].map((i) =>
        `<button class="chip" data-sw="${i}" style="width:22%;padding:14px 0;background:#1e293b;color:#38bdf8;border:2px solid #38bdf8;font-size:10px">⚡ S${i + 1}</button>`
      ).join("");

      openSheet(
        wrapCrtFrame(
          "PANEL SEKRING",
          "Nyalakan sakelar daya sesuai urutan indikator kuning!",
          `<div style="display:flex;gap:4px;margin-bottom:12px">${leds}</div>` +
          `<div style="display:flex;justify-content:space-between;gap:4px">${switches}</div>`
        )
      );

      document.querySelectorAll("#box .chip[data-sw]").forEach((b) => {
        b.onclick = () => {
          const picked = Number(b.dataset.sw);
          if (picked === seq[step]) {
            beep(480 + step * 95, 0.07);
            vib(12);
            step++;
            if (step >= count) {
              closeSheet();
              toast("ARUS LISTRIK STABIL!", "g");
              onComplete();
            } else {
              render();
            }
          } else {
            beep(140, 0.16);
            vib(40);
            step = 0;
            toast("URUTAN SALAH! ULANG DARI AWAL", "b");
            render();
          }
        };
      });
      $("tCancel").onclick = closeSheet;
    };
    render();
  }

  /* ========================================================================
     5. SINKRONISASI SERVER DATA (Tangkap Paket Piksel)
     ======================================================================== */
  function runServerTask(isTech, onComplete) {
    let caught = 0;
    const target = isTech ? 4 : 5;
    let bucketX = 110;
    let pktX = 40 + Math.random() * 180;
    let pktY = 10;

    openSheet(
      wrapCrtFrame(
        "SERVER BUFFER",
        `Tangkap paket data hijau ke dalam slot server (${caught}/${target})!`,
        `<canvas id="srvCv" width="260" height="125" style="width:100%;background:#030712;border:2px solid #a855f7;image-rendering:pixelated;display:block"></canvas>` +
        `<div style="display:flex;gap:8px;margin-top:8px">` +
        `<button class="pb" id="srvL" style="flex:1">◀ KIRI</button>` +
        `<button class="pb" id="srvR" style="flex:1">KANAN ▶</button>` +
        `</div>`
      )
    );

    $("srvL").onclick = () => { bucketX = Math.max(10, bucketX - 36); beep(380, 0.03); };
    $("srvR").onclick = () => { bucketX = Math.min(206, bucketX + 36); beep(420, 0.03); };

    const iv = setInterval(() => {
      const cv = $("srvCv");
      if (!cv) return clearInterval(iv);
      const ctx = cv.getContext("2d");

      pktY += 3.6;
      if (pktY >= 98 && pktY <= 116 && pktX + 12 >= bucketX && pktX <= bucketX + 44) {
        caught++;
        beep(600 + caught * 70, 0.07);
        vib(14);
        pktY = 8;
        pktX = 20 + Math.random() * 210;
        if (caught >= target) {
          clearInterval(iv);
          closeSheet();
          toast("DATA SERVER TERSINKRON!", "g");
          onComplete();
          return;
        }
      } else if (pktY > 125) {
        pktY = 8;
        pktX = 20 + Math.random() * 210;
        beep(180, 0.08);
      }

      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Paket data jatuh
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(Math.round(pktX), Math.round(pktY), 12, 12);
      ctx.fillStyle = "#bbf7d0";
      ctx.fillRect(Math.round(pktX) + 3, Math.round(pktY) + 3, 6, 6);

      // Slot penerima server
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(bucketX, 104, 44, 12);
      ctx.fillStyle = "#f3e8ff";
      ctx.fillRect(bucketX + 4, 104, 36, 3);

      // Skor piksel pojok
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px monospace";
      ctx.fillText(`PAKET: ${caught}/${target}`, 8, 14);
    }, 35);

    activeCleanup = () => clearInterval(iv);
    $("tCancel").onclick = () => { cleanupActive(); closeSheet(); };
  }

  /* ========================================================================
     6. DEKRIPSI KODE TERMINAL CRT (Keypad Mekanik)
     ======================================================================== */
  function runKeypadTask(isTech, onComplete) {
    const len = isTech ? 3 : 4;
    let pin = "";
    for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 9) + 1;
    let typed = "";

    const renderPad = () => {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
        `<button class="chip" data-n="${n}" style="width:29%;padding:10px 0;font-size:11px;background:#0f172a;color:#38bdf8;border:2px solid #334155">${n}</button>`
      ).join("");

      openSheet(
        wrapCrtFrame(
          "DEKRIPSI PIN",
          `Masukkan kode akses terminal: <b style="color:#facc15;font-size:11px">${pin}</b>`,
          `<div style="background:#020617;border:2px solid #22c55e;color:#22c55e;font-size:14px;letter-spacing:6px;text-align:center;padding:8px;margin-bottom:8px">${typed.padEnd(len, "_")}</div>` +
          `<div class="rw" style="justify-content:center;gap:6px">${nums}</div>`
        )
      );

      document.querySelectorAll("#box .chip[data-n]").forEach((b) => {
        b.onclick = () => {
          typed += b.dataset.n;
          beep(480 + typed.length * 80, 0.06);
          vib(8);
          if (typed === pin) {
            closeSheet();
            toast("AKSES DITERIMA!", "g");
            onComplete();
          } else if (typed.length >= len) {
            beep(150, 0.15);
            vib(40);
            typed = "";
            toast("KODE AKSES DITOLAK!", "b");
            renderPad();
          } else {
            renderPad();
          }
        };
      });
      $("tCancel").onclick = closeSheet;
    };
    renderPad();
  }

  function openTaskModal(taskType, isTech, onComplete) {
    cleanupActive();
    const kind = resolveTaskKind(taskType);
    if (kind === "wiring") return runWiringTask(isTech, onComplete);
    if (kind === "frequency") return runFrequencyTask(isTech, onComplete);
    if (kind === "biometric") return runBiometricTask(isTech, onComplete);
    if (kind === "fuse") return runFuseTask(isTech, onComplete);
    if (kind === "server") return runServerTask(isTech, onComplete);
    return runKeypadTask(isTech, onComplete);
  }

  W.MS_TASKS = { openTaskModal };
})(window);
