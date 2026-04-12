import { insertUser, getUserIdStmt } from '../../db/queries.js';
import logger from '../../utils/logger.js';
import { gameConfigKnock } from '../gameConfig.js';
import { knockEnabled, setKnockEnabled } from '../gameState.js';

/**
 * User ID cache to avoid repeated database lookups
 */
export const userIdCache = new Map();

/**
 * Rate limiting storage: Map<userId, timestamp[]>
 */
const rateLimits = new Map();

/**
 * Global warning rate limit timestamps (not per-user)
 */
const globalWarningTimes = [];

// Re-export knockEnabled and setKnockEnabled from central gameState for backward compatibility
export { knockEnabled, setKnockEnabled };

/**
 * Normalize username to lowercase
 * @param {string} name - Username to normalize
 * @returns {string} Normalized username
 */
export function normalizeUsername(name) {
  if (!name || typeof name !== 'string') {
    logger.warn('Invalid username provided for normalization', { name });
    return '';
  }
  return name.toLowerCase().trim();
}

/**
 * Get or create user ID from database
 * @param {string} username - Username to get ID for
 * @returns {number} User ID
 */
export function getUserId(username) {
  const name = normalizeUsername(username);
  
  if (!name) {
    logger.error('Cannot get user ID for empty username');
    throw new Error('Username cannot be empty');
  }

  // Check cache first
  const cached = userIdCache.get(name);
  if (cached) {
    return cached;
  }

  try {
    // Insert user if doesn't exist (ON CONFLICT does nothing)
    insertUser.run(name, Date.now());
    
    // Get user ID
    /** @type {{ id: number } | undefined} */
    const row = /** @type {{ id: number } | undefined} */ (getUserIdStmt.get(name));
    
    if (!row || !row.id) {
      logger.error('Failed to get user ID from database', { username: name });
      throw new Error(`Failed to get user ID for ${name}`);
    }

    // Cache the result
    userIdCache.set(name, row.id);
    logger.debug('User ID retrieved', { username: name, userId: row.id });
    
    return row.id;
  } catch (error) {
    logger.error('Error getting user ID', { error, username: name });
    throw error;
  }
}

/**
 * Check if user can use knock command (rate limiting)
 * @param {number} userId - User ID to check
 * @param {Object} [rateLimitConfig] - Rate limit configuration { windowMs, maxUses }. Defaults to gameConfigKnock.rateLimit
 * @returns {boolean} True if user can use knock, false otherwise
 */
export function canUseKnock(userId, rateLimitConfig = gameConfigKnock.rateLimit) {
  if (!userId || typeof userId !== 'number') {
    logger.warn('Invalid user ID provided for rate limit check', { userId });
    return false;
  }

  const now = Date.now();
  const { windowMs, maxUses } = rateLimitConfig;

  // Get existing timestamps for this user
  let timestamps = rateLimits.get(userId) ?? [];
  
  // Filter out timestamps outside the window
  timestamps = timestamps.filter(t => now - t < windowMs);

  // Check if user has exceeded rate limit
  if (timestamps.length >= maxUses) {
    rateLimits.set(userId, timestamps);
    logger.debug('Rate limit exceeded', { userId, count: timestamps.length, maxUses });
    return false;
  }

  // Add current timestamp and update map
  timestamps.push(now);
  rateLimits.set(userId, timestamps);
  return true;
}

/**
 * Check if bot can send a warning message (global rate limiting)
 * This prevents the bot from spamming warning messages across all users
 * @param {Object} [warningRateLimitConfig] - Warning rate limit configuration { windowMs, maxWarnings }. Defaults to gameConfigKnock.warningRateLimit
 * @returns {boolean} True if bot can send warning, false otherwise
 */
export function canSendWarning(warningRateLimitConfig = gameConfigKnock.warningRateLimit) {
  const now = Date.now();
  const { windowMs, maxWarnings } = warningRateLimitConfig;

  // Remove old timestamps outside the window
  while (globalWarningTimes.length && now - globalWarningTimes[0] > windowMs) {
    globalWarningTimes.shift();
  }

  // Check if we've exceeded the limit
  if (globalWarningTimes.length >= maxWarnings) {
    logger.debug('Global warning rate limit exceeded', { 
      count: globalWarningTimes.length, 
      max: maxWarnings 
    });
    return false;
  }

  // Add current timestamp
  globalWarningTimes.push(now);
  return true;
}

/**
 * Clear rate limit data for a user (useful for testing or manual resets)
 * @param {number} userId - User ID to clear
 */
export function clearUserRateLimit(userId) {
  rateLimits.delete(userId);
  logger.debug('Rate limit cleared for user', { userId });
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearAllRateLimits() {
  rateLimits.clear();
  globalWarningTimes.length = 0;
  logger.info('All rate limits cleared');
}

/**
 * Get rate limit statistics for a user
 * @param {number} userId - User ID to get stats for
 * @param {Object} [rateLimitConfig] - Rate limit configuration. Defaults to gameConfigKnock.rateLimit
 * @returns {Object} Rate limit stats
 */
export function getRateLimitStats(userId, rateLimitConfig = gameConfigKnock.rateLimit) {
  const now = Date.now();
  const { windowMs, maxUses } = rateLimitConfig;
  const timestamps = rateLimits.get(userId) ?? [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  return {
    userId,
    currentUses: validTimestamps.length,
    maxUses,
    remainingUses: Math.max(0, maxUses - validTimestamps.length),
    windowMs,
    canUse: validTimestamps.length < maxUses
  };
}
