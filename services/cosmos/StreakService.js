import logger from '../../utils/logger.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * StreakService
 * Tracks consecutive losses per user (in-memory) and returns game-specific
 * win-probability boosts once the configurable loss threshold is reached.
 *
 * Each game queries a different boost method:
 *   · Slots  — getLuckBonus(username)          → added to effective luck
 *   · Dice   — getWinChanceBonus(username)     → added to win chance
 *   · BJ/Bot — getDealerThresholdReduction(username) → subtracted from dealer hit-until
 *
 * Streaks are reset to 0 on any win and incremented on any loss.
 * In-memory only — streaks reset on process restart (intentional; soft protection).
 */
export class StreakService {
  /**
   * @param {Object} config - cosmosConfig (reads config.streakProtection)
   */
  constructor(config = gameConfigCosmos) {
    this.config = config;

    /**
     * @type {Map<string, number>} username → consecutive loss count
     */
    this.streaks = new Map();
  }

  // ── Streak mutation ───────────────────────────────────────────────────────

  /**
   * Call after any win to reset the user's streak.
   * @param {string} username
   */
  recordWin(username) {
    if (!username) return;
    const prev = this.streaks.get(username) ?? 0;
    if (prev > 0) {
      logger.debug('StreakService: win resets streak', { username, prevStreak: prev });
    }
    this.streaks.set(username, 0);
  }

  /**
   * Call after any loss to increment the user's streak.
   * @param {string} username
   * @returns {number} new streak count
   */
  recordLoss(username) {
    if (!username) return 0;
    const prev  = this.streaks.get(username) ?? 0;
    const next  = prev + 1;
    this.streaks.set(username, next);
    logger.debug('StreakService: loss recorded', { username, streak: next });
    return next;
  }

  /**
   * Current consecutive loss count for a user.
   * @param {string} username
   * @returns {number}
   */
  getStreak(username) {
    return this.streaks.get(username) ?? 0;
  }

  // ── Boost queries ─────────────────────────────────────────────────────────

  /**
   * Whether the streak threshold has been reached for this user.
   * @param {string} username
   * @returns {boolean}
   */
  isStreakActive(username) {
    const cfg = this.config.streakProtection;
    if (!cfg?.enabled) return false;
    return this.getStreak(username) >= cfg.lossesBeforeBoost;
  }

  /**
   * Extra luck multiplier to add to effective luck (used by slots).
   * Returns 0 if streak protection is disabled or threshold not yet reached.
   *
   * @param {string} username
   * @returns {number}
   */
  getLuckBonus(username) {
    if (!this.isStreakActive(username)) return 0;
    return this.config.streakProtection.luckBoost ?? 0;
  }

  /**
   * Extra win-chance probability to add (used by dice, 0-1 range).
   * Returns 0 if streak protection is disabled or threshold not yet reached.
   *
   * @param {string} username
   * @returns {number}
   */
  getWinChanceBonus(username) {
    if (!this.isStreakActive(username)) return 0;
    return this.config.streakProtection.winChanceBoost ?? 0;
  }

  /**
   * How much to reduce the bot dealer's hit-until threshold (used by BJ vs bot).
   * E.g. threshold=17, reduction=2 → dealer stands at 15, making bust more likely.
   * Returns 0 if streak protection is disabled or threshold not yet reached.
   *
   * @param {string} username
   * @returns {number}
   */
  getDealerThresholdReduction(username) {
    if (!this.isStreakActive(username)) return 0;
    return this.config.streakProtection.dealerHitUntilReduction ?? 0;
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  /**
   * Debug summary for a user.
   * @param {string} username
   * @returns {{ streak: number, active: boolean, luckBonus: number, winChanceBonus: number, dealerReduction: number }}
   */
  getInfo(username) {
    return {
      streak:           this.getStreak(username),
      active:           this.isStreakActive(username),
      luckBonus:        this.getLuckBonus(username),
      winChanceBonus:   this.getWinChanceBonus(username),
      dealerReduction:  this.getDealerThresholdReduction(username),
    };
  }

  /** Clear all tracked streaks (useful for testing). */
  clearAll() {
    this.streaks.clear();
    logger.info('StreakService: all streaks cleared');
  }
}
