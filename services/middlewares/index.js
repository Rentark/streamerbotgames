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
    // Silently swallow — individual commands can surface errors via ctx.reply if desired
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// loggingMiddleware
// Logs command start/end with timing. Lightweight — only fires when a matching
// command is actually registered and reaching execution.
// ─────────────────────────────────────────────────────────────────────────────
export const loggingMiddleware = async (ctx, next) => {
  const start = Date.now();

  logger.debug('CommandBus: command start', {
    user: ctx.user,
    command: ctx.command,
    args: ctx.args
  });

  await next();

  logger.debug('CommandBus: command end', {
    user: ctx.user,
    command: ctx.command,
    durationMs: Date.now() - start
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// cooldownMiddleware
// Per-user, per-command sliding cooldown based on ctx.meta.cooldown (ms).
// Commands without a cooldown property are passed through immediately.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, number>} key → expiresAt */
const cooldownStore = new Map();

/**
 * Prune expired entries to prevent unbounded map growth on long-running processes.
 * Called lazily on each lookup.
 */
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

  const key = `${user}:${command}`;
  const now = Date.now();
  const expiresAt = cooldownStore.get(key);

  if (expiresAt && now < expiresAt) {
    const remaining = Math.ceil((expiresAt - now) / 1000);
    await reply?.(`/me @${user}, зачекай ще ${remaining}с ⏳`);
    return;
  }

  cooldownStore.set(key, now + meta.cooldown);
  return next();
};

// ─────────────────────────────────────────────────────────────────────────────
// createGameEnabledMiddleware
// Factory — each game creates its own instance bound to its enable flag getter.
// Silently drops the command when the game is disabled.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {() => boolean} isEnabled - getter that returns current enabled state
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
// createBotThrottleMiddleware
// Factory — each game creates its own instance bound to its canBotSpeak check.
// Prevents the bot from being rate-limited by Twitch when multiple commands fire
// in quick succession. Drops the reply (not the execution) when throttled.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {() => boolean} canSpeak - function returning true when bot may send a message
 * @returns {Function} middleware
 */
export const createBotThrottleMiddleware = (canSpeak) => async (ctx, next) => {
  // Replace ctx.reply with a throttled version
  const originalReply = ctx.reply;
  ctx.reply = async (message) => {
    if (!canSpeak()) {
      logger.debug('CommandBus: reply throttled by bot message limit', { command: ctx.command });
      return;
    }
    return originalReply(message);
  };
  return next();
};
