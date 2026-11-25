(function (W) {
  "use strict";
  const { $, vib, tgw, getUN, setUN, CFG, PG, ME, TABS, TAB_KEYS, SKIN, HAIR, CLR, CAT, PRE, LOCK, ok, owned, rav, saveCfg, toast, openSheet, closeSheet, QUICK_CHATS } = W.MS_CFG;
  const { audioOn, applyAudioCfg, MU } = W.MS_AUDIO;

  let currentTab = 0;
  let cmsg = "";
  let fillWithBots = true;

  function sw(arr, key) {
    return arr.map((c, i) => `<button class="sw${ME[key] === i ? " on" : ""}" style="background:${c}" data-k="${key}" data-v="${i}"></button>`).join("");
  }

  function ch(cat, key) {
    return CAT[cat].map((n, i) => ok(n[1]) ? `<button class="chip${ME[key] === i ? " on" : ""}" data-k="${key}" data-v="${i}">${n[0]}${n[1] === "u" ? " ★" : ""}${owned(cat, i) ? "" : " $" + LOCK[cat][i]}</button>` : "").join("");
  }

  function drawOpts() {
    $("coin").textContent = `KOIN: ${PG.coins}${cmsg ? " · " + cmsg : ""}`;
    cmsg = "";
    $("tabs").innerHTML = TABS.map((t, i) => `<button class="tab${i === currentTab ? " on" : ""}" data-t="${i}">${t}</button>`).join("");
    let h = "";
    if (currentTab === 0) {
      h = `<button class="chip${ME.g === "f" ? " on" : ""}" data-g="f">♀ CEWE</button>` +
          `<button class="chip${ME.g === "m" ? " on" : ""}" data-g="m">♂ COWO</button>` +
          `<div style="width:100%;opacity:.75;line-height:1.8;margin-top:6px">★ = Unisex (bisa dipakai semua)</div>` +
          `<div class="lab">NAMA KARAKTER</div><div class="rw"><input class="ni" id="cn" maxlength="12" value="${getUN()}"></div>`;
    } else if (currentTab === 1) {
      h = `<div class="lab">WARNA KULIT</div><div class="rw">${sw(SKIN, "skin")}</div>`;
    } else if (currentTab === 2) {
      h = `<div class="lab">GAYA RAMBUT</div><div class="rw">${ch("hair", "hair")}</div><div class="lab">WARNA RAMBUT</div><div class="rw">${sw(HAIR, "hairC")}</div>`;
    } else if (currentTab === 3) {
      h = `<div class="lab">BAJU (CASUAL · NATAL · PUNK)</div><div class="rw">${ch("shirt", "shirt")}</div><div class="lab">WARNA BAJU</div><div class="rw">${sw(CLR, "shirtC")}</div>`;
    } else if (currentTab === 4) {
      h = `<div class="lab">BAWAHAN</div><div class="rw">${ch("bot", "bot")}</div><div class="lab">WARNA BAWAHAN</div><div class="rw">${sw(CLR, "botC")}</div>`;
    } else if (currentTab === 5) {
      h = `<div class="lab">AKSESORI</div><div class="rw">${ch("acc", "acc")}</div>`;
    }
    $("opts").innerHTML = h;
    if ($("cn")) {
      $("cn").oninput = (e) => {
        setUN(e.target.value);
        $("who").textContent = tgw ? `Masuk sebagai ${getUN()}` : `Halo, ${getUN()}`;
      };
    }
  }

  const LV = ["MATI", "PELAN", "SEDANG", "KERAS"];
  const SGN = ["OTOMATIS", "MIDNIGHT CITY", "SEMBUNYI", "LOBI SANTAI", "KEJAR-KEJARAN"];

  function openSet() {
    audioOn();
    const chp = (key, arr) =>
      arr.map((l, i) => `<button class="chip${CFG[key] === i ? " on" : ""}" data-s="${key}" data-v="${i}">${l}</button>`).join("");
    const sec = (l, x) => `<div class="lab">${l}</div><div class="rw">${x}</div>`;

    $("sb").innerHTML =
      sec("NAMA KARAKTER", `<input class="ni" id="setNm" maxlength="12" value="${getUN()}">`) +
      sec("GETAR", chp("vib", ["MATI", "NYALA"])) +
      sec("EFEK SUARA", chp("sfx", LV)) +
      sec("VOLUME MUSIK", chp("mus", LV)) +
      sec("PILIHAN LAGU", chp("song", SGN)) +
      sec("KECERAHAN MAP", chp("br", ["NORMAL", "TERANG", "SANGAT TERANG"])) +
      `<div class="kh" style="margin:8px 0">OTOMATIS: LOBI SANTAI, SEMBUNYI SAAT MAIN, KEJAR-KEJARAN SAAT SATPAM DEKAT</div>` +
      `<button class="pb d" id="sr">RESET PENGATURAN</button>`;

    $("set").classList.remove("hide");

    $("setNm").oninput = (e) => {
      setUN(e.target.value);
      $("who").textContent = tgw ? `Masuk sebagai ${getUN()}` : `Halo, ${getUN()}`;
    };

    document.querySelectorAll("#sb .chip[data-s]").forEach((b) => {
      b.onclick = () => {
        CFG[b.dataset.s] = +b.dataset.v;
        applyAudioCfg();
        if (b.dataset.s === "vib") vib(60);
        if (b.dataset.s === "song" || b.dataset.s === "mus") MU.force = 1;
        openSet();
      };
    });

    $("sr").onclick = () => {
      Object.assign(CFG, { vib: 1, sfx: 2, mus: 2, song: 0, br: 0 });
      MU.force = 1;
      applyAudioCfg();
      openSet();
    };
  }

  function bindUi(NET, showScene, getPdir, setPdir) {
    $("mCreate").onclick = () => { audioOn(); NET.createRoom("CLASSIC", true); vib(10); };

    $("mJoin").onclick = async () => {
      audioOn();
      openSheet("<h2>GABUNG ROOM</h2><p>Memuat daftar room...</p>");
      const rooms = await NET.fetchPublicRooms();
      const listHtml = rooms.length
        ? rooms.map((r) => `<div class="vr" data-code="${r.code}" style="justify-content:space-between"><span><b>#${r.code}</b> · ${r.hostName}</span><span style="color:var(--gr)">${r.count}/${r.max}</span></div>`).join("")
        : `<div style="opacity:.6;margin:8px 0">Belum ada room publik. Masukkan kode di bawah:</div>`;

      openSheet(
        `<h2>GABUNG ROOM</h2>${listHtml}` +
        `<div class="lab">KODE ROOM PRIBADI / GRUP</div>` +
        `<div class="rw"><input class="ni" id="inpCode" maxlength="6" placeholder="KODE" style="text-transform:uppercase"></div>` +
        `<button class="pb g" id="bJoinGo">MASUK</button><button class="pb d" id="bJoinClose">BATAL</button>`
      );

      document.querySelectorAll("#box .vr[data-code]").forEach((el) => {
        el.onclick = () => { closeSheet(); NET.joinRoom(el.dataset.code); };
      });
      $("bJoinGo").onclick = () => {
        const c = ($("inpCode").value || "").toUpperCase().trim();
        if (c.length >= 4) { closeSheet(); NET.joinRoom(c); }
      };
      $("bJoinClose").onclick = closeSheet;
    };

    $("mAv").onclick = () => { audioOn(); setPdir(0); showScene("creator"); drawOpts(); vib(10); };
    $("mStat").onclick = () => {
      audioOn();
      openSheet(
        `<h2>STATISTIK</h2><div style="line-height:2;text-align:left">` +
        `KOIN: ${PG.coins}<br>LEVEL: ${Math.floor(PG.xp / 100) + 1} (${PG.xp} XP)<br>` +
        `MAIN: ${PG.games} · MENANG: ${PG.wins}<br>TUGAS SELESAI: ${PG.tasks}</div>` +
        `<button class="pb g" id="sk2">OKE</button>`
      );
      $("sk2").onclick = closeSheet;
    };
    $("mSet").onclick = () => { audioOn(); openSet(); };
    $("mHow").onclick = () => {
      audioOn();
      openSheet(
        `<h2>CARA MAIN</h2><div style="line-height:1.9;text-align:left;margin-bottom:8px">` +
        `1. Sembunyi & tekan NYAMAR jadi benda<br>2. Selesaikan tugas terminal di ruangan<br>` +
        `3. Waspada CEPU yang menyabotase tugas<br>4. Tekan tombol merah di tengah untuk RAPAT<br>` +
        `5. Lari ke PINTU DARURAT kanan saat alarm!</div><button class="pb g" id="hk">OKE</button>`
      );
      $("hk").onclick = closeSheet;
    };

    $("creator").addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      vib(6);
      if (b.dataset.t !== undefined) { currentTab = +b.dataset.t; drawOpts(); }
      else if (b.dataset.g) { Object.assign(ME, PRE[b.dataset.g]); ME.sp = {}; drawOpts(); }
      else if (b.dataset.k) {
        const kk = b.dataset.k, vv = +b.dataset.v, lp = (LOCK[kk] || {})[vv];
        if (lp && !owned(kk, vv)) {
          const res = await NET.saveCustomizationServer({ buyItemKey: `${kk}:${vv}`, price: lp });
          if (res && res.user) { PG.coins = res.user.coins; PG.unl = res.user.unlockedItems; cmsg = `DIBELI -${lp}`; }
          else { cmsg = "KOIN KURANG"; drawOpts(); return; }
        }
        ME[kk] = vv; ME.sp = {}; saveCfg(); drawOpts();
      }
    });

    const dirOrder = [0, 2, 1, 3];
    $("rr").onclick = () => setPdir(dirOrder[(dirOrder.indexOf(getPdir()) + 1) % 4]);
    $("rl").onclick = () => setPdir(dirOrder[(dirOrder.indexOf(getPdir()) + 3) % 4]);
    $("rz").onclick = () => {
      const b = rav();
      Object.assign(ME, b);
      TAB_KEYS.forEach((c) => { if (!owned(c, ME[c])) ME[c] = 0; });
      ME.sp = {}; saveCfg(); drawOpts(); vib(10);
    };
    $("ok").onclick = async () => {
      saveCfg();
      const { sp, ...cleanAv } = ME;
      await NET.saveCustomizationServer({ displayName: getUN(), avatar: cleanAv });
      showScene(NET.getRoom() ? "lobby" : "splash");
    };

    $("bShare").onclick = () => {
      const r = NET.getRoom();
      if (!r) return;
      const shareText = `🔦 Yuk mabar Midnight Shift! Kode Room: ${r.code} (atau ketik /join ${r.code} di bot)`;
      openSheet(
        `<h2>UNDANG TEMAN</h2><p>Bagikan kode room ini ke teman atau grup Telegram:</p>` +
        `<div class="seq" style="font-size:20px;margin:12px 0">#${r.code}</div>` +
        `<button class="pb g" id="bTgShare">KIRIM KE GRUP TELEGRAM</button>` +
        `<button class="pb" id="bCopyCode">SALIN KODE</button><button class="pb d" id="bCloseShare">TUTUP</button>`
      );
      $("bTgShare").onclick = () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(location.origin)}&text=${encodeURIComponent(shareText)}`;
        if (tgw && tgw.openTelegramLink) tgw.openTelegramLink(url);
        else window.open(url, "_blank");
      };
      $("bCopyCode").onclick = () => {
        if (navigator.clipboard) navigator.clipboard.writeText(r.code).catch(() => {});
        toast(`KODE #${r.code} DISALIN!`, "g");
      };
      $("bCloseShare").onclick = closeSheet;
    };

    $("bLeave").onclick = () => { NET.leaveRoom(); showScene("splash"); };
    $("bReady").onclick = () => NET.toggleReady();
    $("ed").onclick = () => { showScene("creator"); drawOpts(); };
    $("stg").onclick = openSet;
    $("hs").onclick = openSet;
    $("bMode").onclick = () => {
      const r = NET.getRoom();
      if (!r) return;
      const modes = ["CLASSIC", "QUICK", "CHAOS"];
      NET.updateRoomSettings({ mode: modes[(modes.indexOf(r.mode) + 1) % modes.length] });
    };
    $("bBotFill").onclick = () => {
      fillWithBots = !fillWithBots;
      $("bBotFill").textContent = `BOT: ${fillWithBots ? "NYALA" : "MATI"}`;
    };
    $("go").onclick = () => NET.startMatch(fillWithBots);

    $("bSendChat").onclick = () => {
      const inp = $("chatInp");
      if (inp.value.trim()) { NET.sendChat(inp.value.trim()); inp.value = ""; }
    };
    $("bQChat").onclick = () => {
      const btns = QUICK_CHATS.map((q, i) => `<button class="chip" data-qi="${i}">${q}</button>`).join("");
      openSheet(`<h2>QUICK CHAT</h2><div class="opts">${btns}</div><button class="pb d" id="qcX">TUTUP</button>`);
      document.querySelectorAll("#box .chip[data-qi]").forEach((b) => {
        b.onclick = () => { NET.sendChat("", +b.dataset.qi); closeSheet(); };
      });
      $("qcX").onclick = closeSheet;
    };
    $("sx").onclick = () => {
      $("set").classList.add("hide");
      if ($("cn")) $("cn").value = getUN();
    };
  }

  W.MS_LOBBY_UI = { bindUi };
})(window);
