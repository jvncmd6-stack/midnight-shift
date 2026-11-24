"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sanitizeName } = require("../packages/shared/protocol");

const BOT_TOKEN = process.env.BOT_TOKEN || "";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-32chars";
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Verifikasi Telegram WebApp initData sesuai spesifikasi resmi Telegram
 */
function verifyTelegramInitData(initDataRaw) {
  if (!initDataRaw || typeof initDataRaw !== "string" || !BOT_TOKEN) {
    return null;
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get("hash");
    if (!hash) return null;

    // Cek freshness auth_date (maksimal 24 jam = 86400 detik)
    const authDate = Number(params.get("auth_date") || 0);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || Math.abs(nowSec - authDate) > 86400) {
      return null;
    }

    // Susun data_check_string secara alfabetis tanpa parameter hash
    const pairs = [];
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        pairs.push(`${key}=${value}`);
      }
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    // secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const hashBuf = Buffer.from(hash, "hex");
    const compBuf = Buffer.from(computedHash, "hex");
    if (hashBuf.length !== compBuf.length || !crypto.timingSafeEqual(hashBuf, compBuf)) {
      return null;
    }

    const userRaw = params.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (!user || !user.id) return null;

    return {
      telegramId: String(user.id),
      username: user.username ? String(user.username).slice(0, 32) : "",
      displayName: sanitizeName(user.first_name || "Pemain"),
      startParam: params.get("start_param") ? String(params.get("start_param")).slice(0, 64) : ""
    };
  } catch (err) {
    return null;
  }
}

/**
 * Buat JWT sesi pendek untuk WebApp & Socket.IO (berlaku 12 jam)
 */
function signSessionToken(userPayload) {
  return jwt.sign(
    {
      uid: userPayload.id,
      tgId: userPayload.telegramId,
      name: userPayload.displayName
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

/**
 * Verifikasi JWT sesi dari client
 */
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Buat token undangan room bertanda tangan (berlaku 2 jam)
 */
function signInviteToken(roomCode, chatId = null) {
  return jwt.sign(
    { rc: roomCode, cid: chatId ? String(chatId) : null },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function verifyInviteToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Buat identitas tamu acak (hanya aktif di non-production / testing web)
 */
function createGuestIdentity(guestId, name) {
  if (IS_PROD) return null;
  const safeId = String(guestId || crypto.randomBytes(6).toString("hex")).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  return {
    telegramId: `guest_${safeId}`,
    username: "",
    displayName: sanitizeName(name || "Tamu"),
    startParam: ""
  };
}

module.exports = {
  verifyTelegramInitData,
  signSessionToken,
  verifySessionToken,
  signInviteToken,
  verifyInviteToken,
  createGuestIdentity
};
