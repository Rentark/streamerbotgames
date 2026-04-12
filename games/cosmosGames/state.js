import logger from '../../utils/logger.js';
import gameConfigCosmos from './cosmosConfig.js';

// Re-export central enable flag (added to games/gameState.js)
export { cosmosEnabled, setCosmosEnabled } from '../gameState.js';

// ── Rate Limiting ─────────────────────────────────────────────────────────────

/**
 * Per-user rate limit timestamps.
 * @type {Map<string, number[]>}
 */
const rateLimits = new Map();

/**
 * Global warning throttle (prevents bot spam on rate-limit messages).
 * @type {number[]}
 */
const globalWarningTimes = [];

// ── Username helpers ──────────────────────────────────────────────────────────

/**
 * Normalize a Twitch username to lowercase trimmed string.
 * @param {string} name
 * @returns {string}
 */
export function normalizeUsername(name) {
  if (!name || typeof name !== 'string') {
    logger.warn('CosmosGame state: invalid username', { name });
    return '';
  }
  return name.toLowerCase().trim();
}

// ── Command rate limiting ─────────────────────────────────────────────────────

/**
 * Check whether `username` can fire a command right now.
 * Uses a sliding window. Mutates the internal timestamp list.
 *
 * @param {string} username
 * @param {Object} [rateLimitConfig] - defaults to gameConfigCosmos.rateLimit
 * @returns {boolean}
 */
export function canUseCommand(username, rateLimitConfig = gameConfigCosmos.rateLimit) {
  if (!username || typeof username !== 'string') return false;

  const now = Date.now();
  const { windowMs, maxUses } = rateLimitConfig;

  let timestamps = rateLimits.get(username) ?? [];
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxUses) {
    rateLimits.set(username, timestamps);
    logger.debug('CosmosGame: rate limit hit', { username, count: timestamps.length, maxUses });
    return false;
  }

  timestamps.push(now);
  rateLimits.set(username, timestamps);
  return true;
}

/**
 * Global warning rate limiter — prevents the bot from spamming
 * "slow down!" messages when many users hit the rate limit at once.
 *
 * @param {{ windowMs: number, maxWarnings: number }} [config]
 * @returns {boolean}
 */
export function canSendWarning(config = { windowMs: 30_000, maxWarnings: 1 }) {
  const now = Date.now();
  const { windowMs, maxWarnings } = config;

  while (globalWarningTimes.length && now - globalWarningTimes[0] > windowMs) {
    globalWarningTimes.shift();
  }

  if (globalWarningTimes.length >= maxWarnings) return false;

  globalWarningTimes.push(now);
  return true;
}

// ── Helpers (testing / manual resets) ────────────────────────────────────────

export function clearUserRateLimit(username) {
  rateLimits.delete(username);
  logger.debug('CosmosGame: rate limit cleared', { username });
}

export function clearAllRateLimits() {
  rateLimits.clear();
  globalWarningTimes.length = 0;
  logger.info('CosmosGame: all rate limits cleared');
}
