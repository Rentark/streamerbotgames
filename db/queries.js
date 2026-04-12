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
