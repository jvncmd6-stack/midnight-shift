"use strict";

const { Pool } = require("pg");
const Redis = require("ioredis");
const { DEFAULT_AVATAR, sanitizeAvatar, sanitizeName } = require("../packages/shared/protocol");

const DATABASE_URL = process.env.DATABASE_URL || "";
const REDIS_URL = process.env.REDIS_URL || "";

let pool = null;
let redis = null;

// Fallback penyimpanan sementara jika dev lokal tanpa Postgres/Redis
const memUsers = new Map();
const memRateLimits = new Map();

async function initDatabases() {
  if (DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: 15
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id VARCHAR(64) UNIQUE NOT NULL,
        username VARCHAR(64) DEFAULT '',
        display_name VARCHAR(32) NOT NULL,
        avatar_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        coins INTEGER NOT NULL DEFAULT 0,
        xp INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        tasks_done INTEGER NOT NULL DEFAULT 0,
        cepu_ejected INTEGER NOT NULL DEFAULT 0,
        best_escape_sec INTEGER NOT NULL DEFAULT 0,
        unlocked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS match_rewards (
        match_id VARCHAR(64) NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        coins_earned INTEGER NOT NULL,
        xp_earned INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (match_id, user_id)
      );
    `);

    // Pastikan kolom is_banned ada jika tabel users sudah dibuat sebelumnya
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;`);
    console.log("[DB] PostgreSQL siap.");
  } else {
    console.warn("[DB] DATABASE_URL kosong, menggunakan in-memory fallback.");
  }

  if (REDIS_URL) {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 2 });
    redis.on("error", (err) => console.error("[Redis Error]", err.message));
    console.log("[DB] Redis siap.");
  }
}

function mapUserRow(row) {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username || "",
    displayName: row.display_name,
    avatar: sanitizeAvatar(row.avatar_json),
    coins: row.coins || 0,
    xp: row.xp || 0,
    gamesPlayed: row.games_played || 0,
    wins: row.wins || 0,
    tasksDone: row.tasks_done || 0,
    cepuEjected: row.cepu_ejected || 0,
    bestEscapeSec: row.best_escape_sec || 0,
    unlockedItems: Array.isArray(row.unlocked_items) ? row.unlocked_items : [],
    isBanned: Boolean(row.is_banned)
  };
}

async function upsertUser({ telegramId, username = "", displayName = "Pemain" }) {
  const cleanName = sanitizeName(displayName);
  const cleanUser = String(username || "").slice(0, 64);

  if (!pool) {
    let u = memUsers.get(telegramId);
    if (!u) {
      u = {
        id: memUsers.size + 1,
        telegramId,
        username: cleanUser,
        displayName: cleanName,
        avatar: { ...DEFAULT_AVATAR },
        coins: 0,
        xp: 0,
        gamesPlayed: 0,
        wins: 0,
        tasksDone: 0,
        cepuEjected: 0,
        bestEscapeSec: 0,
        unlockedItems: [],
        isBanned: false
      };
      memUsers.set(telegramId, u);
    }
    return u;
  }

  const res = await pool.query(
    `
    INSERT INTO users (telegram_id, username, display_name, avatar_json)
    VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      updated_at = NOW()
    RETURNING *;
    `,
    [telegramId, cleanUser, cleanName, JSON.stringify(DEFAULT_AVATAR)]
  );
  return mapUserRow(res.rows[0]);
}

async function updateUserCustomization(userId, { displayName, avatar, buyItemKey, price }) {
  if (!pool) {
    for (const u of memUsers.values()) {
      if (u.id === userId) {
        if (displayName) u.displayName = sanitizeName(displayName);
        if (avatar) u.avatar = sanitizeAvatar(avatar);
        if (buyItemKey && price > 0) {
          if (u.coins < price) return { error: "INSUFFICIENT_COINS" };
          if (!u.unlockedItems.includes(buyItemKey)) {
            u.coins -= price;
            u.unlockedItems.push(buyItemKey);
          }
        }
        return { user: u };
      }
    }
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!cur.rows.length) {
      await client.query("ROLLBACK");
      return null;
    }

    const row = cur.rows[0];
    let coins = row.coins;
    const unlocked = Array.isArray(row.unlocked_items) ? [...row.unlocked_items] : [];

    if (buyItemKey && Number.isFinite(price) && price > 0) {
      if (!unlocked.includes(buyItemKey)) {
        if (coins < price) {
          await client.query("ROLLBACK");
          return { error: "INSUFFICIENT_COINS" };
        }
        coins -= Math.floor(price);
        unlocked.push(String(buyItemKey).slice(0, 32));
      }
    }

    const nextName = displayName ? sanitizeName(displayName) : row.display_name;
    const nextAvatar = avatar ? sanitizeAvatar(avatar) : sanitizeAvatar(row.avatar_json);

    const upd = await client.query(
      `
      UPDATE users
      SET display_name = $1, avatar_json = $2::jsonb, coins = $3, unlocked_items = $4::jsonb, updated_at = NOW()
      WHERE id = $5
      RETURNING *;
      `,
      [nextName, JSON.stringify(nextAvatar), coins, JSON.stringify(unlocked), userId]
    );
    await client.query("COMMIT");
    return { user: mapUserRow(upd.rows[0]) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function commitMatchReward(matchId, userId, { coins, xp, win, tasksDone, escapeSec }) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `
      INSERT INTO match_rewards (match_id, user_id, coins_earned, xp_earned)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (match_id, user_id) DO NOTHING
      RETURNING match_id;
      `,
      [matchId, userId, coins, xp]
    );

    if (ins.rowCount > 0) {
      await client.query(
        `
        UPDATE users SET
          coins = coins + $1,
          xp = xp + $2,
          games_played = games_played + 1,
          wins = wins + $3,
          tasks_done = tasks_done + $4,
          best_escape_sec = CASE
            WHEN $5 > 0 AND (best_escape_sec = 0 OR $5 < best_escape_sec) THEN $5
            ELSE best_escape_sec
          END,
          updated_at = NOW()
        WHERE id = $6;
        `,
        [coins, xp, win ? 1 : 0, tasksDone || 0, Math.round(escapeSec || 0), userId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[DB Reward Error]", err.message);
  } finally {
    client.release();
  }
}

async function getLeaderboard(limit = 10) {
  if (!pool) return [];
  const res = await pool.query(
    `SELECT display_name, wins, xp, tasks_done FROM users WHERE is_banned = FALSE ORDER BY wins DESC, xp DESC LIMIT $1`,
    [Math.min(25, limit)]
  );
  return res.rows;
}

/* ---------- Fungsi Khusus Admin ---------- */

async function getServerStats() {
  if (!pool) {
    let banned = 0;
    memUsers.forEach((u) => { if (u.isBanned) banned++; });
    return { totalUsers: memUsers.size, bannedUsers: banned };
  }
  const res = await pool.query(`
    SELECT 
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_banned = TRUE)::int AS banned
    FROM users
  `);
  return {
    totalUsers: res.rows[0]?.total || 0,
    bannedUsers: res.rows[0]?.banned || 0
  };
}

async function adminGiveCoins(telegramId, amount) {
  const tgId = String(telegramId);
  if (!pool) {
    const u = memUsers.get(tgId);
    if (!u) return null;
    u.coins = Math.max(0, u.coins + amount);
    return { display_name: u.displayName, coins: u.coins };
  }
  const res = await pool.query(
    `UPDATE users SET coins = GREATEST(0, coins + $2), updated_at = NOW() WHERE telegram_id = $1 RETURNING display_name, coins`,
    [tgId, amount]
  );
  return res.rows[0] || null;
}

async function setUserBanned(telegramId, banned) {
  const tgId = String(telegramId);
  if (!pool) {
    const u = memUsers.get(tgId);
    if (!u) return false;
    u.isBanned = Boolean(banned);
    return true;
  }
  const res = await pool.query(
    `UPDATE users SET is_banned = $2, updated_at = NOW() WHERE telegram_id = $1 RETURNING id`,
    [tgId, Boolean(banned)]
  );
  return res.rowCount > 0;
}

async function getAllUserTelegramIds() {
  if (!pool) {
    return Array.from(memUsers.values())
      .filter((u) => !u.isBanned)
      .map((u) => u.telegramId);
  }
  const res = await pool.query(`SELECT telegram_id FROM users WHERE is_banned = FALSE ORDER BY updated_at DESC LIMIT 2000`);
  return res.rows.map((r) => r.telegram_id);
}

async function checkRateLimit(key, maxCount, windowSec) {
  if (redis) {
    const count = await redis.incr(`rl:${key}`);
    if (count === 1) await redis.expire(`rl:${key}`, windowSec);
    return count <= maxCount;
  }
  const now = Date.now();
  const item = memRateLimits.get(key);
  if (!item || now > item.resetAt) {
    memRateLimits.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  item.count++;
  return item.count <= maxCount;
}

module.exports = {
  initDatabases,
  upsertUser,
  updateUserCustomization,
  commitMatchReward,
  getLeaderboard,
  getServerStats,
  adminGiveCoins,
  setUserBanned,
  getAllUserTelegramIds,
  checkRateLimit
};
