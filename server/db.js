"use strict";

const { Pool } = require("pg");
const Redis = require("ioredis");
const { sanitizeAvatar, sanitizeName } = require("../packages/shared/protocol");

const DATABASE_URL = process.env.DATABASE_URL || "";
const REDIS_URL = process.env.REDIS_URL || "";

let pool = null;
let redis = null;

// Fallback memori lokal jika Redis belum dipasang saat development
const memCache = new Map();

async function initDatabases() {
  if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true
    });
    redis.on("error", (err) => console.error("[Redis Error]", err.message));
  } else {
    console.warn("[DB] REDIS_URL tidak ditemukan, memakai memory fallback (single-instance).");
  }

  if (DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 15,
      idleTimeoutMillis: 30000
    });
    await runMigrations();
  } else {
    console.warn("[DB] DATABASE_URL tidak ditemukan, progres pemain tidak tersimpan permanen.");
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(64) UNIQUE NOT NULL,
        username VARCHAR(64) DEFAULT '',
        display_name VARCHAR(32) NOT NULL DEFAULT 'Pemain',
        avatar JSONB NOT NULL DEFAULT '{"g":"f","skin":1,"hair":1,"hairC":0,"shirt":2,"shirtC":0,"bot":1,"botC":7,"acc":0}'::jsonb,
        unlocked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        coins INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        tasks_done INTEGER NOT NULL DEFAULT 0,
        cepu_ejected INTEGER NOT NULL DEFAULT 0,
        best_escape_sec INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reward_transactions (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(64) NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        coins_earned INTEGER NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(match_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS group_lobbies (
        chat_id VARCHAR(64) PRIMARY KEY,
        room_code VARCHAR(12) NOT NULL,
        message_id BIGINT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Ambil atau buat profil pemain saat login Telegram
 */
async function upsertUser({ telegramId, username, displayName }) {
  if (!pool) {
    const key = `user:${telegramId}`;
    if (!memCache.has(key)) {
      memCache.set(key, {
        id: Math.floor(Math.random() * 1000000),
        telegramId,
        username: username || "",
        displayName: sanitizeName(displayName),
        avatar: sanitizeAvatar(null),
        unlockedItems: [],
        coins: 0,
        xp: 0,
        gamesPlayed: 0,
        wins: 0,
        tasksDone: 0,
        cepuEjected: 0,
        bestEscapeSec: 0
      });
    }
    return memCache.get(key);
  }

  const res = await pool.query(
    `INSERT INTO users (telegram_id, username, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = EXCLUDED.username,
           updated_at = NOW()
     RETURNING *`,
    [telegramId, username || "", sanitizeName(displayName)]
  );
  return formatUserRow(res.rows[0]);
}

function formatUserRow(r) {
  return {
    id: r.id,
    telegramId: r.telegram_id,
    username: r.username,
    displayName: r.display_name,
    avatar: sanitizeAvatar(r.avatar),
    unlockedItems: Array.isArray(r.unlocked_items) ? r.unlocked_items : [],
    coins: r.coins,
    xp: r.xp,
    gamesPlayed: r.games_played,
    wins: r.wins,
    tasksDone: r.tasks_done,
    cepuEjected: r.cepu_ejected,
    bestEscapeSec: r.best_escape_sec
  };
}

/**
 * Simpan perubahan avatar, nama, atau pembelian item kosmetik dengan validasi koin server-side
 */
async function updateUserCustomization(userId, { displayName, avatar, buyItemKey, price }) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const curRes = await client.query("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!curRes.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }
    const u = curRes.rows[0];
    let coins = u.coins;
    let unlocked = Array.isArray(u.unlocked_items) ? [...u.unlocked_items] : [];

    if (buyItemKey && typeof price === "number" && price > 0 && !unlocked.includes(buyItemKey)) {
      if (coins < price) {
        await client.query("ROLLBACK");
        return { error: "KOIN_KURANG", user: formatUserRow(u) };
      }
      coins -= price;
      unlocked.push(buyItemKey);
    }

    const cleanName = displayName ? sanitizeName(displayName) : u.display_name;
    const cleanAv = avatar ? sanitizeAvatar(avatar) : u.avatar;

    const upd = await client.query(
      `UPDATE users
       SET display_name = $1, avatar = $2::jsonb, unlocked_items = $3::jsonb, coins = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [cleanName, JSON.stringify(cleanAv), JSON.stringify(unlocked), coins, userId]
    );
    await client.query("COMMIT");
    return { user: formatUserRow(upd.rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Commit hasil pertandingan secara atomik (Anti-Duplicate Reward per match_id + user_id)
 */
async function commitMatchReward(matchId, userId, { coins, xp, win, tasksDone, cepuEjected, escapeSec }) {
  if (!pool) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO reward_transactions (match_id, user_id, coins_earned, xp_earned)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (match_id, user_id) DO NOTHING
       RETURNING id`,
      [matchId, userId, Math.max(0, coins), Math.max(0, xp)]
    );

    if (!ins.rows.length) {
      await client.query("ROLLBACK");
      return false; // Sudah pernah diklaim
    }

    await client.query(
      `UPDATE users SET
        coins = coins + $1,
        xp = xp + $2,
        games_played = games_played + 1,
        wins = wins + $3,
        tasks_done = tasks_done + $4,
        cepu_ejected = cepu_ejected + $5,
        best_escape_sec = CASE
          WHEN $6 > 0 AND (best_escape_sec = 0 OR $6 < best_escape_sec) THEN $6
          ELSE best_escape_sec
        END,
        updated_at = NOW()
       WHERE id = $7`,
      [
        Math.max(0, coins),
        Math.max(0, xp),
        win ? 1 : 0,
        Math.max(0, tasksDone || 0),
        Math.max(0, cepuEjected || 0),
        Math.max(0, Math.round(escapeSec || 0)),
        userId
      ]
    );

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    return false;
  } finally {
    client.release();
  }
}

async function getLeaderboard(limit = 10) {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT display_name, wins, xp, games_played
     FROM users
     WHERE games_played > 0
     ORDER BY wins DESC, xp DESC
     LIMIT $1`,
    [Math.min(25, limit)]
  );
  return res.rows;
}

// Rate limiter sederhana berbasis Redis / Memory
async function checkRateLimit(key, maxHits, windowSec) {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count <= maxHits;
  }
  const now = Date.now();
  const item = memCache.get(key);
  if (!item || item.exp < now) {
    memCache.set(key, { c: 1, exp: now + windowSec * 1000 });
    return true;
  }
  item.c++;
  return item.c <= maxHits;
}

module.exports = {
  initDatabases,
  upsertUser,
  updateUserCustomization,
  commitMatchReward,
  getLeaderboard,
  checkRateLimit,
  getPool: () => pool,
  getRedis: () => redis
};
