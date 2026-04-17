import { db } from './db.js';
import logger from '../utils/logger.js';

/**
 * User-related queries
 */
export const insertUser = db.prepare(`
  INSERT INTO users (username, created_at)
  VALUES (?, ?)
  ON CONFLICT(username) DO NOTHING
`);

export const getUserIdStmt = db.prepare(`
  SELECT id FROM users WHERE username = ?
`);

/**
 * Knock-related queries
 */
export const incKnock = db.prepare(`
  INSERT INTO knocks (
    user_id,
    target_id,
    count,
    stars,
    updated_at
  )
  VALUES (?, ?, 1, ?, ?)
  ON CONFLICT(user_id, target_id)
  DO UPDATE SET
    count = count + 1,
    stars = stars + excluded.stars,
    updated_at = excluded.updated_at
  RETURNING count, stars
`);

export const topKnockers = db.prepare(`
  SELECT u.username, sum(k.count) as count, sum(k.stars) as stars
  FROM knocks k
  JOIN users u ON u.id = k.user_id
  GROUP BY u.id
  ORDER BY count DESC
  LIMIT 10
`);

/**
 * Get knock count for a specific user-target pair
 */
export const getKnockCount = db.prepare(`
  SELECT count FROM knocks
  WHERE user_id = ? AND target_id = ?
`);

/**
 * Get total knocks received by a user
 */
export const getTotalKnocksReceived = db.prepare(`
  SELECT SUM(count) as total
  FROM knocks
  WHERE target_id = ?
`);

export const getPlayer = db.prepare(`
  SELECT * FROM cosmos_players WHERE username = ?
`);
 
export const createPlayer = db.prepare(`
  INSERT OR IGNORE INTO cosmos_players
    (username, stardust, level, xp, base_luck, shield, last_daily, created_at)
  VALUES (?, 500, 1, 0, 1.0, 0, 0, ?)
`);
 
/**
 * Full player update — always pass all fields.
 * Parameter order: stardust, level, xp, base_luck, shield, last_daily, username
 */
export const updatePlayer = db.prepare(`
  UPDATE cosmos_players
  SET stardust   = ?,
      level      = ?,
      xp         = ?,
      base_luck  = ?,
      shield     = ?,
      last_daily = ?
  WHERE username = ?
`);
 
// ── Leaderboards ─────────────────────────────────────────────────────────────
 
export const getTopByLevel = db.prepare(`
  SELECT username, level, xp
  FROM cosmos_players
  ORDER BY level DESC, xp DESC
  LIMIT 10
`);

/** Get a jackpot row by id. Returns undefined if not found. */
export const getJackpot = db.prepare(`
  SELECT * FROM cosmos_jackpots WHERE id = ?
`);
 
/** Upsert a jackpot row with a starting amount (used during seeding). */
export const seedJackpot = db.prepare(`
  INSERT OR IGNORE INTO cosmos_jackpots (id, amount) VALUES (?, ?)
`);
 
/** Add contribution to jackpot (atomic integer add). */
export const contributeJackpot = db.prepare(`
  UPDATE cosmos_jackpots SET amount = amount + ? WHERE id = ?
`);
 
/** Reset jackpot to seed after a win. */
export const resetJackpot = db.prepare(`
  UPDATE cosmos_jackpots
  SET amount = ?, last_won_at = ?, last_won_by = ?
  WHERE id = ?
`);