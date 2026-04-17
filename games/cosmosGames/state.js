import logger from '../../utils/logger.js';
import gameConfigCosmos from './cosmosConfig.js';

// Re-export central casino-wide enable flag
export { cosmosEnabled, setCosmosEnabled } from '../gameState.js';

// ── Per-feature enable flags ──────────────────────────────────────────────────
//
// Feature groups and which commands belong to each:
//
//   spin       → spinCommand, jackpotCommand, balanceCommand, perksCommand, topCommand
//   dice       → diceCommand
//   duel       → duelCommand, duelAcceptCommand, duelDeclineCommand, shieldCommand
//   box        → boxCommand
//   daily      → dailyCommand
//   blackjack  → blackjackCommand, blackjackConfirmCommand, blackjackHitCommand,
//                blackjackStandCommand
//
// Defaults are pulled from cosmosConfig.js at startup so the config file is
// the single source of truth for initial values.
// ─────────────────────────────────────────────────────────────────────────────

const defaults = gameConfigCosmos.features ?? {};

/** @type {Map<string, boolean>} featureName → enabled */
const featureFlags = new Map([
  ['spin',      defaults.spin      ?? true],
  ['dice',      defaults.dice      ?? true],
  ['duel',      defaults.duel      ?? true],
  ['box',       defaults.box       ?? true],
  ['daily',     defaults.daily     ?? true],
  ['blackjack', defaults.blackjack ?? true],
]);

/**
 * Check whether a named cosmos feature is currently enabled.
 * Returns true for unknown feature names (fail-open for future additions).
 *
 * @param {string} feature
 * @returns {boolean}
 */
export function isFeatureEnabled(feature) {
  if (!featureFlags.has(feature)) return true;
  return featureFlags.get(feature);
}

/**
 * Set the enabled state for a named cosmos feature.
 *
 * @param {string} feature
 * @param {boolean} enabled
 */
export function setFeatureEnabled(feature, enabled) {
  if (!featureFlags.has(feature)) {
    logger.warn('CosmosGame: attempted to set unknown feature flag', { feature });
    return;
  }
  const prev = featureFlags.get(feature);
  featureFlags.set(feature, Boolean(enabled));
  logger.info('CosmosGame feature toggled', { feature, prev, now: Boolean(enabled) });
}

/**
 * Get a snapshot of all feature flags.
 * @returns {Object<string, boolean>}
 */
export function getAllFeatureFlags() {
  return Object.fromEntries(featureFlags.entries());
}

/**
 * Enable all cosmos features simultaneously.
 */
export function enableAllFeatures() {
  for (const key of featureFlags.keys()) {
    featureFlags.set(key, true);
  }
  logger.info('CosmosGame: all features enabled');
}

/**
 * Disable all cosmos features simultaneously.
 */
export function disableAllFeatures() {
  for (const key of featureFlags.keys()) {
    featureFlags.set(key, false);
  }
  logger.info('CosmosGame: all features disabled');
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

/** @type {Map<string, number[]>} */
const rateLimits = new Map();
const globalWarningTimes = [];

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

/**
 * Check whether `username` can fire a command right now (sliding window).
 * @param {string} username
 * @param {Object} [rateLimitConfig]
 * @returns {boolean}
 */
export function canUseCommand(username, rateLimitConfig = gameConfigCosmos.rateLimit) {
  if (!username) return false;

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
 * Global warning rate limiter.
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

export function clearUserRateLimit(username) {
  rateLimits.delete(username);
}

export function clearAllRateLimits() {
  rateLimits.clear();
  globalWarningTimes.length = 0;
}
