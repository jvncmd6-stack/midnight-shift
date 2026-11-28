(function (W) {
  "use strict";
  const { tgw, getUN, setUN, PG, ME, saveCfg, toast, closeSheet } = W.MS_CFG;

  const socket = typeof W.io === "function"
    ? W.io({
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      })
    : null;

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
      if (!socket) {
        toast("Socket.io gagal dimuat. Refresh halaman.", "b");
        return resolve(false);
      }

      let settled = false;
      const finish = (ok, errMsg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok && errMsg) toast(errMsg, "b");
        resolve(ok);
      };

      const timer = setTimeout(() => {
        finish(false, "Koneksi ke server lambat. Tekan Coba Lagi.");
      }, 7000);

      const sendHello = () => {
        const { sp, ...cleanAv } = ME;
        socket.emit("auth:hello", {
          initData: getInitData(),
          displayName: getUN(),
          avatar: cleanAv
        }, (res) => {
          if (!res || !res.ok) {
            return finish(false, (res && res.error) || "Gagal terhubung ke server");
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
          if (autoCode) joinRoom(autoCode);
          finish(true);
        });
      };

      if (socket.connected) {
        sendHello();
      } else {
        socket.connect();
        socket.once("connect", sendHello);
        socket.once("connect_error", () => {
          finish(false, "Server sedang offline / gagal terhubung.");
        });
      }
    });
  }

  function createRoom(mode = "CLASSIC", isPublic = true) {
    if (!socket) return;
    socket.emit("room:create", { mode, isPublic }, (res) => {
      if (res && res.error) toast(res.error, "b");
      else if (res && res.room) handleRoomUpdate(res.room);
    });
  }

  function joinRoom(code) {
    if (!socket || !code) return;
    socket.emit("room:join", { code: String(code).toUpperCase().trim() }, (res) => {
      if (res && res.error) toast(res.error, "b");
      else if (res && res.room) handleRoomUpdate(res.room);
    });
  }

  function leaveRoom() {
    if (!socket || !currentRoom) return;
    socket.emit("room:leave", { code: currentRoom.code });
    currentRoom = null;
    latestSnapshot = null;
    lobbyPeers.clear();
  }

  function toggleReady() {
    if (!socket || !currentRoom) return;
    socket.emit("room:ready", { code: currentRoom.code });
  }

  function updateRoomSettings(settings) {
    if (!socket || !currentRoom) return;
    socket.emit("room:settings", { code: currentRoom.code, ...settings });
  }

  function startMatch(fillWithBots = true) {
    if (!socket || !currentRoom) {
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
      if (!socket) return resolve([]);
      socket.emit("room:list", {}, (res) => resolve((res && res.rooms) || []));
    });
  }

  function saveCustomizationServer(payload) {
    return new Promise((resolve) => {
      if (!socket) return resolve(null);
      socket.emit("user:customize", payload, (res) => {
        if (res && res.error) toast(res.error, "b");
        resolve(res);
      });
    });
  }

  function sendChat(text, quickIdx = null) {
    if (!socket || !currentRoom) return;
    socket.emit("room:chat", { code: currentRoom.code, text, quickIdx });
  }

  function sendLobbyMove(x, z, dir, em, jy) {
    if (!socket || !currentRoom) return;
    socket.emit("lobby:move", { code: currentRoom.code, x, z, dir, em, jy });
  }

  function sendPlayerInput(seq, ix, iy, angle) {
    if (!socket || !currentRoom) return;
    socket.emit("match:input", { code: currentRoom.code, seq, ix, iy, angle });
  }

  function sendPlayerAction(action, data = {}) {
    if (!socket || !currentRoom) return;
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
          em: 0,
          jy: 0
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

  if (socket) {
    socket.on("room:update", handleRoomUpdate);
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

    socket.on("role:assigned", (data) => {
      latestSnapshot = null;
      const info = data.roleInfo || {};
      if (W.MS_APP && W.MS_APP.onMatchStarted) {
        W.MS_APP.onMatchStarted({
          role: data.role,
          roleName: info.name || data.role,
          team: info.team || "CIVILIAN",
          quota: data.quota,
          quotaTier: data.quotaTier || ""
        });
      }
    });

    socket.on("match:snapshot", (snap) => {
      if (snap && snap.you && Array.isArray(snap.entities)) {
        const selfEnt = snap.entities.find((e) => String(e.id) === String(snap.you.id));
        if (selfEnt) {
          snap.you.x = selfEnt.x;
          snap.you.z = selfEnt.z;
          snap.you.dir = selfEnt.dir;
          snap.you.propType = selfEnt.propType;
        }
        snap.prog = snap.progress ?? snap.prog ?? 0;
        snap.need = snap.quota ?? snap.need ?? 4;
        snap.you.abCd = snap.you.abilityCd ?? snap.you.abCd ?? 0;
        snap.you.dead = snap.you.alive === false;
      }
      latestSnapshot = snap;
    });

    socket.on("game:toast", (ev) => {
      if (ev && ev.text) toast(ev.text, ev.type || "i");
    });

    socket.on("meeting:start", (m) => {
      if (W.MS_APP && W.MS_APP.onMeetingUpdate) {
        const list = m.eligible || m.candidates || [];
        W.MS_APP.onMeetingUpdate({
          active: true,
          endTime: m.endTime || (Date.now() + (m.duration || 25) * 1000),
          callerName: m.callerName || "Pemain",
          candidates: list,
          votedCount: m.votedCount || 0,
          totalVoters: m.totalVoters || list.length,
          clues: m.clues || [],
          myId: myTgId
        });
      }
    });

    socket.on("meeting:update", (m) => {
      if (W.MS_APP && W.MS_APP.onMeetingUpdate) {
        const list = m.eligible || m.candidates || [];
        W.MS_APP.onMeetingUpdate({
          active: true,
          endTime: m.endTime || (Date.now() + 25000),
          callerName: m.callerName || "Pemain",
          candidates: list,
          votedCount: m.votedCount || 0,
          totalVoters: m.totalVoters || list.length,
          clues: m.clues || [],
          myId: myTgId
        });
      }
    });

    socket.on("meeting:result", (r) => {
      if (closeSheet) closeSheet();
      if (r && r.message) toast(r.message, r.ejectedName ? "g" : "i");
    });

    socket.on("match:result", (res) => {
      latestSnapshot = null;
      if (closeSheet) closeSheet();
      const meResult = (res.players || []).find((p) => String(p.id) === myTgId) || { won: false, coins: 10, xp: 30 };
      if (W.MS_APP && W.MS_APP.onMatchResult) {
        W.MS_APP.onMatchResult({
          reason: res.reason,
          players: res.players || [],
          yourReward: {
            win: !!meResult.won,
            coins: meResult.coins || 10,
            xp: meResult.xp || 30
          }
        });
      }
    });

    socket.on("error:msg", (msg) => {
      toast(String(msg || "Terjadi kesalahan"), "b");
    });
  }

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
})(window);
