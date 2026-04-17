import logger from '../../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// safeExecutionMiddleware
// Wraps the entire downstream pipeline in a try-catch.
// Should always be the FIRST middleware in the chain.
// ─────────────────────────────────────────────────────────────────────────────
export const safeExecutionMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    logger.error('CommandBus: unhandled error in command pipeline', {
      error: err,
      command: ctx.command,
      user: ctx.user
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// loggingMiddleware
// ─────────────────────────────────────────────────────────────────────────────
export const loggingMiddleware = async (ctx, next) => {
  const start = Date.now();
  logger.debug('CommandBus: command start', { user: ctx.user, command: ctx.command, args: ctx.args });
  await next();
  logger.debug('CommandBus: command end', { user: ctx.user, command: ctx.command, durationMs: Date.now() - start });
};

// ─────────────────────────────────────────────────────────────────────────────
// cooldownMiddleware
// Per-user, per-command sliding cooldown based on ctx.meta.cooldown (ms).
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, number>} key → expiresAt */
const cooldownStore = new Map();

function pruneCooldowns() {
  const now = Date.now();
  for (const [key, expiresAt] of cooldownStore.entries()) {
    if (now >= expiresAt) cooldownStore.delete(key);
  }
}

export const cooldownMiddleware = async (ctx, next) => {
  const { user, command, meta, reply } = ctx;
  if (!meta?.cooldown) return next();

  pruneCooldowns();

  const key      = `${user}:${command}`;
  const now      = Date.now();
  const expiresAt = cooldownStore.get(key);

  if (expiresAt && now < expiresAt) {
    const remaining = Math.ceil((expiresAt - now) / 1000);
    await reply?.(`/me @${user}, зачекай ще ${remaining}с`);
    return;
  }

  cooldownStore.set(key, now + meta.cooldown);
  return next();
};

// ─────────────────────────────────────────────────────────────────────────────
// createGameEnabledMiddleware
// Factory — bound to a casino-wide enable flag getter.
// Silently drops the command when the whole game is disabled.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {() => boolean} isEnabled
 * @returns {Function} middleware
 */
export const createGameEnabledMiddleware = (isEnabled) => async (ctx, next) => {
  if (!isEnabled()) {
    logger.debug('CommandBus: command dropped — game disabled', { command: ctx.command });
    return;
  }
  return next();
};

// ─────────────────────────────────────────────────────────────────────────────
// createFeatureMiddleware
// Factory — each feature group (spin, dice, duel, box, daily, blackjack) gets
// its own instance.  Commands carry `ctx.meta.feature` (set at registration
// time in cosmosModule.js); this middleware checks that specific flag.
//
// Silently drops the command when the feature is disabled.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {(feature: string) => boolean} isFeatureEnabled
 *   Function that accepts a feature name and returns its current state.
 * @returns {Function} middleware
 */
export const createFeatureMiddleware = (isFeatureEnabled) => async (ctx, next) => {
  const feature = ctx.meta?.feature;

  // If the command carries no feature tag it is always allowed through
  // (e.g. future utility commands not yet categorised).
  if (!feature) return next();

  if (!isFeatureEnabled(feature)) {
    logger.debug('CommandBus: command dropped — feature disabled', {
      command: ctx.command,
      feature,
    });
    return;
  }

  return next();
};

// ─────────────────────────────────────────────────────────────────────────────
// createBotThrottleMiddleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {() => boolean} canSpeak
 * @returns {Function} middleware
 */
export const createBotThrottleMiddleware = (canSpeak) => async (ctx, next) => {
  const originalReply = ctx.reply;
  ctx.reply = async (message) => {
    if (!canSpeak()) {
      logger.debug('CommandBus: reply throttled', { command: ctx.command });
      return;
    }
    return originalReply(message);
  };
  return next();
};
