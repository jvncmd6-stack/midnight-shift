(function (W) {
  "use strict";
  const { tgw, getUN, setUN, PG, ME, saveCfg, toast } = W.MS_CFG;

  const socket = W.io({ transports: ["websocket", "polling"] });
  let myTgId = null;
  let currentRoom = null;
  let latestSnapshot = null;
  const lobbyPeers = new Map();

  function getInitData() {
    if (tgw && tgw.initData) return tgw.initData;
    let devId = localStorage.getItem("ms_dev_id");
    if (!devId) {
      devId = "dev_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("ms_dev_id", devId);
    }
    return "dev:" + devId;
  }

  function getStartRoomCode() {
    const param = tgw && tgw.initDataUnsafe && tgw.initDataUnsafe.start_param;
    if (param && param.startsWith("room_")) {
      return param.replace("room_", "").toUpperCase().trim();
    }
    const qs = new URLSearchParams(location.search).get("room");
    return qs ? qs.toUpperCase().trim() : null;
  }

  function authenticate() {
    return new Promise((resolve) => {
      const done = (res) => {
        if (!res || !res.ok) {
          toast((res && res.error) || "Gagal terhubung ke server", "b");
          return resolve(false);
        }
        myTgId = String(res.user.tgId);
        PG.coins = res.user.coins || 0;
        PG.xp = res.user.xp || 0;
        PG.games = res.user.games || 0;
        PG.wins = res.user.wins || 0;
        PG.tasks = res.user.tasks || 0;
        PG.unl = res.user.unlockedItems || [];
        if (res.user.displayName) setUN(res.user.displayName);
        if (res.user.avatar && typeof res.user.avatar === "object") {
          Object.assign(ME, res.user.avatar);
          ME.sp = {};
        }
        saveCfg();

        const autoCode = getStartRoomCode();
        if (autoCode) {
          joinRoom(autoCode);
        }
        resolve(true);
      };

      const { sp, ...cleanAv } = ME;
      socket.emit("auth:hello", {
        initData: getInitData(),
        displayName: getUN(),
        avatar: cleanAv
      }, done);
    });
  }

  function createRoom(mode = "CLASSIC", isPublic = true) {
    socket.emit("room:create", { mode, isPublic }, (res) => {
      if (res && res.error) toast(res.error, "b");
      else if (res && res.room) handleRoomUpdate(res.room);
    });
  }

  function joinRoom(code) {
    if (!code) return;
    socket.emit("room:join", { code: String(code).toUpperCase().trim() }, (res) => {
      if (res && res.error) toast(res.error, "b");
      else if (res && res.room) handleRoomUpdate(res.room);
    });
  }

  function leaveRoom() {
    if (!currentRoom) return;
    socket.emit("room:leave", { code: currentRoom.code });
    currentRoom = null;
    latestSnapshot = null;
    lobbyPeers.clear();
  }

  function toggleReady() {
    if (!currentRoom) return;
    socket.emit("room:ready", { code: currentRoom.code });
  }

  function updateRoomSettings(settings) {
    if (!currentRoom) return;
    socket.emit("room:settings", { code: currentRoom.code, ...settings });
  }

  function startMatch(fillWithBots = true) {
    if (!currentRoom) {
      toast("Belum masuk ke room", "b");
      return;
    }
    toast("Memulai permainan...", "i");
    socket.emit("match:start", { code: currentRoom.code, fillWithBots }, (res) => {
      if (res && res.error) toast(res.error, "b");
    });
  }

  function fetchPublicRooms() {
    return new Promise((resolve) => {
      socket.emit("room:list", {}, (res) => {
        resolve((res && res.rooms) || []);
      });
    });
  }

  function saveCustomizationServer(payload) {
    return new Promise((resolve) => {
      socket.emit("user:customize", payload, (res) => {
        if (res && res.error) toast(res.error, "b");
        resolve(res);
      });
    });
  }

  function sendChat(text, quickIdx = null) {
    if (!currentRoom) return;
    socket.emit("room:chat", { code: currentRoom.code, text, quickIdx });
  }

  function sendLobbyMove(x, z, dir, em, jy) {
    if (!currentRoom) return;
    socket.emit("lobby:move", { code: currentRoom.code, x, z, dir, em, jy });
  }

  function sendPlayerInput(seq, ix, iy, angle) {
    if (!currentRoom) return;
    socket.emit("match:input", { code: currentRoom.code, seq, ix, iy, angle });
  }

  function sendPlayerAction(action, data = {}) {
    if (!currentRoom) return;
    socket.emit("match:action", { code: currentRoom.code, action, ...data });
  }

  function handleRoomUpdate(room) {
    currentRoom = room;
    const activeIds = new Set();
    (room.members || []).forEach((m) => {
      const id = String(m.tgId);
      if (id === myTgId) return;
      activeIds.add(id);
      if (!lobbyPeers.has(id)) {
        lobbyPeers.set(id, {
          tgId: id,
          name: m.name || "Teman",
          avatar: m.avatar || ME,
          x: m.x || 24,
          z: m.z || 13,
          tx: m.x || 24,
          tz: m.z || 13,
          dir: m.dir || 0,
          em: m.em || 0,
          jy: m.jy || 0
        });
      } else {
        const p = lobbyPeers.get(id);
        p.name = m.name || p.name;
        if (m.avatar) p.avatar = m.avatar;
      }
    });
    for (const key of lobbyPeers.keys()) {
      if (!activeIds.has(key)) lobbyPeers.delete(key);
    }

    if (W.MS_APP && W.MS_APP.onRoomUpdated) {
      W.MS_APP.onRoomUpdated(room);
    }
  }

  /* ---------- Socket Listeners ---------- */
  socket.on("room:updated", handleRoomUpdate);

  socket.on("lobby:peer_move", (d) => {
    const id = String(d.tgId);
    if (id === myTgId) return;
    const p = lobbyPeers.get(id);
    if (p) {
      p.tx = d.x;
      p.tz = d.z;
      p.dir = d.dir || 0;
      p.em = d.em || 0;
      p.jy = d.jy || 0;
    }
  });

  socket.on("room:chat_msg", (m) => {
    const box = document.getElementById("chatLog");
    if (!box) return;
    const line = document.createElement("div");
    line.innerHTML = `<b style="color:var(--ac)">${m.name}:</b> ${m.text}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  });

  socket.on("match:started", (info) => {
    latestSnapshot = null;
    if (W.MS_APP && W.MS_APP.onMatchStarted) {
      W.MS_APP.onMatchStarted(info);
    }
  });

  socket.on("match:snapshot", (snap) => {
    latestSnapshot = snap;
  });

  socket.on("match:event", (ev) => {
    if (ev && ev.msg) toast(ev.msg, ev.type || "i");
  });

  socket.on("match:meeting", (m) => {
    if (W.MS_APP && W.MS_APP.onMeetingUpdate) {
      W.MS_APP.onMeetingUpdate(m);
    }
  });

  socket.on("match:ended", (res) => {
    latestSnapshot = null;
    if (W.MS_APP && W.MS_APP.onMatchResult) {
      W.MS_APP.onMatchResult(res);
    }
  });

  socket.on("error:msg", (msg) => {
    toast(String(msg || "Terjadi kesalahan"), "b");
  });

  W.MS_NET = {
    socket,
    authenticate,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updateRoomSettings,
    startMatch,
    fetchPublicRooms,
    saveCustomizationServer,
    sendChat,
    sendLobbyMove,
    sendPlayerInput,
    sendPlayerAction,
    lobbyPeers,
    getMyTgId: () => myTgId,
    getRoom: () => currentRoom,
    getSnapshot: () => latestSnapshot
  };
})(window);(function (W) {
  "use strict";
  const { $, tgw, getUN, setUN, PG, ME, saveCfg, toast, openSheet, closeSheet } = W.MS_CFG;

  let socket = null;
  let authToken = "";
  let myTgId = "";
  let currentRoom = null;
  let matchSnapshot = null;
  let myRoleInfo = null;
  const lobbyPeers = new Map();

  function getOrCreateGuestId() {
    let gid = localStorage.getItem("ms_guest_id");
    if (!gid) {
      gid = "g_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("ms_guest_id", gid);
    }
    return gid;
  }

  function showRetry(msg) {
    const sp = $("sp2");
    if (!sp) return;
    sp.classList.remove("hide", "bl");
    sp.style.color = "#ff5d6c";
    sp.innerHTML = `${msg}<br><button class="pb g" id="bRetryAuth" style="margin-top:12px">COBA LAGI</button>`;
    const btn = $("bRetryAuth");
    if (btn) {
      btn.onclick = () => {
        sp.style.color = "#fff";
        sp.classList.add("bl");
        sp.textContent = "MENGHUBUNGKAN...";
        authenticate().then((okAuth) => {
          if (okAuth) {
            $("ldw").classList.add("hide");
            sp.classList.add("hide");
            $("menu").classList.remove("hide");
          }
        });
      };
    }
  }

  async function authenticate() {
    try {
      const initData = tgw && tgw.initData ? tgw.initData : "";
      const startParam =
        (tgw && tgw.initDataUnsafe && tgw.initDataUnsafe.start_param) ||
        new URLSearchParams(location.search).get("startapp") ||
        "";

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          initData,
          guestId: getOrCreateGuestId(),
          guestName: getUN()
        })
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showRetry(errData.message || `GAGAL LOGIN (${res.status})`);
        return false;
      }

      const data = await res.json();
      authToken = data.token;
      myTgId = data.user.telegramId;
      setUN(data.user.displayName);

      PG.coins = data.user.coins || 0;
      PG.xp = data.user.xp || 0;
      PG.games = data.user.gamesPlayed || 0;
      PG.wins = data.user.wins || 0;
      PG.tasks = data.user.tasksDone || 0;
      PG.cepu = data.user.cepuEjected || 0;
      PG.best = data.user.bestEscapeSec || 0;
      PG.unl = data.user.unlockedItems || [];
      if (data.user.avatar) {
        Object.assign(ME, data.user.avatar);
        ME.sp = {};
      }
      saveCfg();

      connectSocket(data.startParam || startParam);
      return true;
    } catch (err) {
      showRetry(err.name === "AbortError" ? "SERVER LAMBAT / TIMEOUT" : "KONEKSI TERPUTUS");
      return false;
    }
  }

  function connectSocket(autoStartParam) {
    if (typeof W.io !== "function") {
      showRetry("SOCKET.IO GAGAL DIMUAT");
      return;
    }

    socket = W.io({ auth: { token: authToken }, transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      $("who").textContent = `Online: ${getUN()}`;
      if (autoStartParam && autoStartParam.startsWith("room_")) {
        const code = autoStartParam.replace("room_", "").toUpperCase();
        joinRoom(code);
        autoStartParam = "";
      }
    });

    socket.on("connect_error", (err) => {
      $("who").textContent = `Offline (${err.message})`;
    });

    socket.on("room:update", (room) => {
      currentRoom = room;
      syncLobbyPeers(room);
      if (W.MS_APP) W.MS_APP.onRoomUpdated(room);
    });

    socket.on("lobby:peerMove", (p) => {
      if (p.tgId === myTgId) return;
      const peer = lobbyPeers.get(p.tgId);
      if (peer) {
        peer.tx = p.x;
        peer.tz = p.z;
        peer.dir = p.dir;
        peer.em = p.em;
        peer.jy = p.jy;
      }
    });

    socket.on("chat:message", (msg) => {
      const log = $("chatLog");
      if (!log) return;
      const line = document.createElement("div");
      line.innerHTML = `<span style="color:var(--ac)">${msg.name}:</span> ${msg.text}`;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    });

    socket.on("role:assigned", (data) => {
      myRoleInfo = data;
      matchSnapshot = null;
      if (W.MS_APP) W.MS_APP.onMatchStarted(data);
    });

    socket.on("match:snapshot", (snap) => {
      matchSnapshot = snap;
    });

    socket.on("game:toast", (t) => {
      toast(t.text, t.type);
    });

    socket.on("meeting:update", (m) => {
      if (W.MS_APP) W.MS_APP.onMeetingUpdate(m);
    });

    socket.on("meeting:result", (r) => {
      closeSheet();
      toast(r.message, r.ejectedName ? "b" : "i");
    });

    socket.on("match:result", (res) => {
      if (W.MS_APP) W.MS_APP.onMatchResult(res);
    });
  }

  function syncLobbyPeers(room) {
    const activeIds = new Set();
    (room.members || []).forEach((m) => {
      if (m.tgId === myTgId) return;
      activeIds.add(m.tgId);
      if (!lobbyPeers.has(m.tgId)) {
        lobbyPeers.set(m.tgId, {
          tgId: m.tgId,
          name: m.name,
          avatar: m.avatar,
          x: m.x || 24,
          z: m.z || 13,
          tx: m.x || 24,
          tz: m.z || 13,
          dir: m.dir || 0,
          em: 0,
          jy: 0
        });
      } else {
        const p = lobbyPeers.get(m.tgId);
        p.name = m.name;
        p.avatar = m.avatar;
      }
    });
    for (const id of lobbyPeers.keys()) {
      if (!activeIds.has(id)) lobbyPeers.delete(id);
    }
  }

  function createRoom(mode = "CLASSIC", isPublic = true) {
    if (!socket) return;
    socket.emit("room:create", { mode, isPublic }, (res) => {
      if (!res || !res.ok) toast("GAGAL MEMBUAT ROOM", "b");
    });
  }

  function joinRoom(code) {
    if (!socket || !code) return;
    socket.emit("room:join", { code }, (res) => {
      if (!res || !res.ok) {
        toast((res && res.message) || "ROOM TIDAK DITEMUKAN", "b");
      }
    });
  }

  function leaveRoom() {
    if (socket) socket.emit("room:leave");
    currentRoom = null;
    matchSnapshot = null;
    lobbyPeers.clear();
  }

  function toggleReady() { if (socket) socket.emit("room:ready"); }
  function updateRoomSettings(s) { if (socket) socket.emit("room:settings", s); }
  function startMatch(fillWithBots) {
    if (socket) socket.emit("room:start", { fillWithBots }, (res) => {
      if (res && res.error) toast(res.message, "b");
    });
  }

  function sendLobbyMove(x, z, dir, em, jy) {
    if (socket && currentRoom) socket.emit("lobby:move", { x, z, dir, em, jy });
  }

  function sendChat(text, quickIdx) {
    if (socket && currentRoom) socket.emit("chat:send", { text, quickIdx });
  }

  function sendPlayerInput(seq, ix, iy, aim) {
    if (socket && matchSnapshot) socket.emit("player:input", { seq, ix, iy, aim });
  }

  function sendPlayerAction(type, payload = {}) {
    if (socket && matchSnapshot) socket.emit("player:action", { type, ...payload });
  }

  async function saveCustomizationServer(payload) {
    if (!authToken) return null;
    const res = await fetch("/api/customize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(payload)
    });
    return res.ok ? res.json() : null;
  }

  async function fetchPublicRooms() {
    const res = await fetch("/api/rooms");
    return res.ok ? (await res.json()).rooms : [];
  }

  W.MS_NET = {
    authenticate,
    getMyTgId: () => myTgId,
    getRoom: () => currentRoom,
    getSnapshot: () => matchSnapshot,
    getRoleInfo: () => myRoleInfo,
    lobbyPeers,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    updateRoomSettings,
    startMatch,
    sendLobbyMove,
    sendChat,
    sendPlayerInput,
    sendPlayerAction,
    saveCustomizationServer,
    fetchPublicRooms
  };
})(window);
