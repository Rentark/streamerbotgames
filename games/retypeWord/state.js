import logger from '../../utils/logger.js';
import { gameConfigRetypeWord } from '../gameConfig.js';
import { retypeWordEnabled, setRetypeWordEnabled } from '../gameState.js';

/**
 * RetypeWord - game-specific state and throttling.
 * Mirrors the idea of `knockGame/state.js`, but uses in-memory caches
 * (no DB lookups for per-user identity in this bot).
 */

// Re-export to keep a consistent import style across games
export { retypeWordEnabled, setRetypeWordEnabled };

/**
 * In-memory cache: Map<normalizedUsername, lastMessage>
 */
const lastMessagesByUser = new Map();

/**
 * Rate limiting storage: Map<normalizedUsername, timestamp[]>
 */
const rateLimits = new Map();

/**
 * Bot message throttling: sliding window timestamps
 */
const botMessageTimes = [];

/**
 * Normalize username to lowercase
 * @param {string} name
 * @returns {string}
 */
export function normalizeUsername(name) {
  if (!name || typeof name !== 'string') {
    logger.warn('Invalid username provided for retypeWord normalization', { name });
    return '';
  }
  return name.toLowerCase().trim();
}

/**
 * Get cached previous message for user
 * @param {string} normalizedUsername
 * @returns {string|undefined}
 */
export function getLastMessage(normalizedUsername) {
  if (!normalizedUsername) return undefined;
  return lastMessagesByUser.get(normalizedUsername);
}

/**
 * Update cached last message for user
 * @param {string} normalizedUsername
 * @param {string} message
 */
export function setLastMessage(normalizedUsername, message) {
  if (!normalizedUsername) return;
  if (!message || typeof message !== 'string') return;
  lastMessagesByUser.set(normalizedUsername, message);
}

/**
 * Check if user can use !meh (rate limiting)
 * @param {string} normalizedUsername
 * @param {Object} [rateLimitConfig]
 * @returns {boolean}
 */
export function canUseMeh(normalizedUsername, rateLimitConfig = gameConfigRetypeWord.rateLimit) {
  if (!normalizedUsername || typeof normalizedUsername !== 'string') {
    logger.warn('Invalid username provided for retypeWord rate limit check', { normalizedUsername });
    return false;
  }

  const now = Date.now();
  const { windowMs, maxUses } = rateLimitConfig;

  let timestamps = rateLimits.get(normalizedUsername) ?? [];
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxUses) {
    rateLimits.set(normalizedUsername, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimits.set(normalizedUsername, timestamps);
  return true;
}

/**
 * Bot speaking throttling: sliding window
 * @param {Object} [botMessagesConfig]
 * @returns {boolean}
 */
export function canBotSpeak(botMessagesConfig = gameConfigRetypeWord.botMessages) {
  const now = Date.now();
  const { windowMs, maxMessages } = botMessagesConfig;

  while (botMessageTimes.length && now - botMessageTimes[0] > windowMs) {
    botMessageTimes.shift();
  }

  if (botMessageTimes.length >= maxMessages) {
    return false;
  }

  botMessageTimes.push(now);
  return true;
}

/**
 * Clear cached state for a user (useful for testing/debugging)
 * @param {string} normalizedUsername
 */
export function clearUserState(normalizedUsername) {
  if (!normalizedUsername) return;
  lastMessagesByUser.delete(normalizedUsername);
  rateLimits.delete(normalizedUsername);
}

/**
 * Clear all cached state (useful for testing/debugging)
 */
export function clearAllState() {
  lastMessagesByUser.clear();
  rateLimits.clear();
  botMessageTimes.length = 0;
}

