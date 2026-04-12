import logger from '../utils/logger.js';

/**
 * Central game state manager for enable/disable states
 * This is separate from game-specific state files (e.g., knockGame/state.js)
 * which contain game-specific logic like rate limiting
 */

/**
 * Knock game enabled state - controlled via HTTP API
 * Default: disabled
 */
export let knockEnabled = true;

/**
 * Loot drop game enabled state - controlled via HTTP API
 * Default: enabled (can be started on demand)
 */
export let starfallEnabled = true;

/**
 * RetypeWord game enabled state - can be controlled via HTTP API (future)
 * Default: disabled
 */
export let retypeWordEnabled = true;

/**
 * Set the knock game enabled state
 * @param {boolean} value - Whether the game should be enabled
 */
export function setKnockEnabled(value) {
  const previousState = knockEnabled;
  knockEnabled = Boolean(value);
  logger.info('Knock game state changed', { 
    previousState, 
    newState: knockEnabled 
  });
}

/**
 * Set the loot drop game enabled state
 * @param {boolean} value - Whether the game should be enabled
 */
export function setStarfallEnabled(value) {
  const previousState = starfallEnabled;
  starfallEnabled = Boolean(value);
  logger.info('Loot drop game state changed', { 
    previousState, 
    newState: starfallEnabled 
  });
}

/**
 * Set the retypeWord game enabled state
 * @param {boolean} value - Whether the game should be enabled
 */
export function setRetypeWordEnabled(value) {
  const previousState = retypeWordEnabled;
  retypeWordEnabled = Boolean(value);
  logger.info('RetypeWord game state changed', {
    previousState,
    newState: retypeWordEnabled
  });
}

/**
 * Enable both games simultaneously
 */
export function enableBothGames() {
  setKnockEnabled(true);
  setStarfallEnabled(true);
  setRetypeWordEnabled(true);
  logger.info('Both games enabled simultaneously');
}

/**
 * Disable both games simultaneously
 */
export function disableBothGames() {
  setKnockEnabled(false);
  setStarfallEnabled(false);
  setRetypeWordEnabled(false);
  logger.info('Both games disabled simultaneously');
}

/**
 * Get current state of both games
 * @returns {Object} State object with knockEnabled and starfallEnabled
 */
export function getGameStates() {
  return {
    knockEnabled,
    starfallEnabled,
    retypeWordEnabled
  };
}
