"use strict";

const { PROPS } = require("./constants");

const PHASE = {
  WAITING: "WAITING",
  COUNTDOWN: "COUNTDOWN",
  PREPARATION: "PREPARATION",
  ACTIVE: "ACTIVE",
  MEETING: "MEETING",
  FINAL_ESCAPE: "FINAL_ESCAPE",
  RESULT: "RESULT"
};

const ERROR_CODES = {
  ROOM_FULL: "Room sudah penuh (maksimal 20 pemain).",
  ROOM_NOT_FOUND: "Kode room tidak ditemukan atau sudah berakhir.",
  MATCH_IN_PROGRESS: "Pertandingan sedang berlangsung, tunggu ronde selesai.",
  INVALID_SESSION: "Sesi tidak valid. Silakan buka ulang dari Telegram.",
  ACTION_DENIED: "Aksi tidak diizinkan pada fase ini.",
  COOLDOWN: "Kemampuan masih cooldown.",
  OUT_OF_RANGE: "Terlalu jauh dari objek.",
  RATE_LIMITED: "Terlalu banyak permintaan, pelan-pelan."
};

const QUICK_CHATS = [
  "Butuh bantuan!",
  "Ikuti aku!",
  "Ada Satpam di dekat sini!",
  "Tugas lagi disabotase!",
  "Aku lagi ngerjain tugas.",
  "Pintu darurat terbuka!",
  "Sus banget gerak-geriknya!",
  "Ayo kumpul rapat!"
];

// Sanitasi teks nama & chat (mencegah XSS & karakter rusak)
function sanitizeText(str, maxLen = 120) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>&"'`]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function sanitizeName(str) {
  const clean = sanitizeText(str, 12);
  return clean.length >= 2 ? clean : "Pemain";
}

// Validasi avatar agar klien tidak bisa kirim index ilegal/crash
function sanitizeAvatar(av) {
  const def = { g: "f", skin: 1, hair: 1, hairC: 0, shirt: 2, shirtC: 0, bot: 1, botC: 7, acc: 0 };
  if (!av || typeof av !== "object") return def;
  const clampInt = (v, min, max, fb) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fb;
  return {
    g: av.g === "m" ? "m" : "f",
    skin: clampInt(av.skin, 0, 5, 1),
    hair: clampInt(av.hair, 0, 11, 1),
    hairC: clampInt(av.hairC, 0, 5, 0),
    shirt: clampInt(av.shirt, 0, 8, 2),
    shirtC: clampInt(av.shirtC, 0, 7, 0),
    bot: clampInt(av.bot, 0, 6, 1),
    botC: clampInt(av.botC, 0, 7, 7),
    acc: clampInt(av.acc, 0, 11, 0)
  };
}

// Validasi paket gerak C -> S (Anti-NaN, Anti-Infinity, Anti-Speedhack)
function validateMoveInput(payload) {
  if (!payload || typeof payload !== "object") return null;
  const seq = Number(payload.seq);
  const ix = Number(payload.ix);
  const iy = Number(payload.iy);
  if (!Number.isFinite(seq) || !Number.isFinite(ix) || !Number.isFinite(iy)) return null;
  const len = Math.hypot(ix, iy);
  const normX = len > 1 ? ix / len : Math.max(-1, Math.min(1, ix));
  const normY = len > 1 ? iy / len : Math.max(-1, Math.min(1, iy));
  return {
    seq: Math.floor(seq),
    ix: normX,
    iy: normY,
    aim: Number.isFinite(payload.aim) ? Number(payload.aim) : 0
  };
}

function validatePropType(type) {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(PROPS, type) ? type : null;
}

module.exports = {
  PHASE,
  ERROR_CODES,
  QUICK_CHATS,
  sanitizeText,
  sanitizeName,
  sanitizeAvatar,
  validateMoveInput,
  validatePropType
};
