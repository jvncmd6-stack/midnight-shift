(function (W) {
  "use strict";
  const { $, vib, openSheet, closeSheet, toast } = W.MS_CFG;
  const { beep } = W.MS_AUDIO;

  function openTaskModal(taskType, isTech, onComplete) {
    const type = String(taskType || "keypad").toLowerCase();
    const speedBonus = isTech ? 0.65 : 1;

    if (type === "wiring") {
      const colors = [
        { name: "MERAH", hex: "#ef4444" },
        { name: "BIRU", hex: "#38bdf8" },
        { name: "KUNING", hex: "#facc15" },
        { name: "HIJAU", hex: "#22c55e" }
      ];
      let step = 0;
      const order = [...colors].sort(() => Math.random() - 0.5);

      const render = () => {
        const target = order[step];
        const btns = colors.map((c, idx) =>
          `<button class="pb" data-ci="${idx}" style="background:${c.hex};color:#0b0716;border-color:#fff">${c.name}</button>`
        ).join("");
        openSheet(
          `<h2>SAMBUNG KABEL (${step + 1}/4)</h2>` +
          `<p>Sambungkan kabel warna: <b style="color:${target.hex}">${target.name}</b></p>` +
          `<div class="rw" style="flex-direction:column">${btns}</div>` +
          `<button class="pb d" id="tCancel">BATAL</button>`
        );
        document.querySelectorAll("#box .pb[data-ci]").forEach((b) => {
          b.onclick = () => {
            const picked = colors[+b.dataset.ci];
            if (picked.name === target.name) {
              beep(520 + step * 110, 0.08);
              vib(12);
              step++;
              if (step >= 4) {
                closeSheet();
                toast("KABEL TERSAMBUNG!", "g");
                onComplete();
              } else {
                render();
              }
            } else {
              beep(150, 0.15);
              vib(40);
              toast("SALAH KABEL!", "b");
            }
          };
        });
        $("tCancel").onclick = closeSheet;
      };
      render();
      return;
    }

    if (type === "slider" || type === "calibrate") {
      let pos = 0;
      let dir = 1;
      let hits = 0;
      const needHits = isTech ? 2 : 3;

      openSheet(
        `<h2>KALIBRASI DAYA (<span id="calH">0</span>/${needHits})</h2>` +
        `<p>Tekan KUNCI saat indikator berada di zona hijau!</p>` +
        `<div style="position:relative;height:18px;background:#1e293b;border:2px solid #fff;margin:12px 0">` +
        `<div style="position:absolute;left:38%;width:24%;height:100%;background:#22c55e"></div>` +
        `<div id="calBar" style="position:absolute;left:0%;width:6%;height:100%;background:#facc15"></div>` +
        `</div>` +
        `<button class="pb g" id="calLock">KUNCI DAYA</button>` +
        `<button class="pb d" id="tCancel">BATAL</button>`
      );

      const iv = setInterval(() => {
        if (!$("calBar")) return clearInterval(iv);
        pos += dir * (3.2 * speedBonus);
        if (pos >= 94) { pos = 94; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
        $("calBar").style.left = pos + "%";
      }, 25);

      $("calLock").onclick = () => {
        if (pos >= 35 && pos <= 62) {
          hits++;
          beep(640, 0.08);
          vib(15);
          if ($("calH")) $("calH").textContent = hits;
          if (hits >= needHits) {
            clearInterval(iv);
            closeSheet();
            toast("DAYA STABIL!", "g");
            onComplete();
          }
        } else {
          beep(160, 0.12);
          vib(35);
          toast("MELESET! COBA LAGI", "b");
        }
      };
      $("tCancel").onclick = () => { clearInterval(iv); closeSheet(); };
      return;
    }

    // Default: Keypad PIN Keamanan
    const len = isTech ? 3 : 4;
    let pin = "";
    for (let i = 0; i < len; i++) pin += Math.floor(Math.random() * 9) + 1;
    let typed = "";

    const renderPad = () => {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
        `<button class="chip" data-n="${n}" style="width:28%;padding:10px 0;font-size:11px">${n}</button>`
      ).join("");
      openSheet(
        `<h2>KODE TERMINAL</h2>` +
        `<p>Masukkan PIN: <b style="color:var(--ac)">${pin}</b></p>` +
        `<div class="seq">${typed.padEnd(len, "•")}</div>` +
        `<div class="rw" style="justify-content:center;gap:6px">${nums}</div>` +
        `<button class="pb d" id="tCancel" style="margin-top:10px">BATAL</button>`
      );
      document.querySelectorAll("#box .chip[data-n]").forEach((b) => {
        b.onclick = () => {
          typed += b.dataset.n;
          beep(480 + typed.length * 80, 0.06);
          vib(8);
          if (typed === pin) {
            closeSheet();
            toast("TERMINAL AKTIF!", "g");
            onComplete();
          } else if (typed.length >= len) {
            beep(150, 0.15);
            vib(40);
            typed = "";
            toast("PIN SALAH!", "b");
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

  W.MS_TASKS = { openTaskModal };
})(window);
