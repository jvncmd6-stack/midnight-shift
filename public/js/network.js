(function (W) {
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
