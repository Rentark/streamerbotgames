import {
  getJackpot, seedJackpot, contributeJackpot, resetJackpot
} from '../../db/queries.js';
import logger from '../../utils/logger.js';

/**
 * JackpotService
 * Manages one or more named progressive jackpots for Cosmos Casino.
 *
 * Each jackpot is identified by a string `id` (e.g. "cosmic").
 * Balances are persisted in SQLite so they survive restarts.
 *
 * Lifecycle per bet:
 *   1. service.contribute(id, bet)          — add a fraction to the pool
 *   2. service.tryTrigger(id, bet, luck)    — returns true if jackpot hit
 *   3. If triggered: service.claim(id, winner, seedAmount) — award + reset
 *
 * Configuration lives in cosmosConfig.js under `jackpots`:
 * ```js
 * jackpots: {
 *   cosmic: {
 *     name: 'Космічний Джекпот',
 *     seedAmount: 1000,          // reset value after a win
 *     contributionRate: 0.01,    // fraction of each bet that feeds the pool
 *     baseChance: 0.001,         // 0.1% per bet at base luck
 *     maxLuckBonus: 0.002,       // luck can add up to +0.2% on top
 *     betChanceBonus: 0.001,     // +0.1% when betting max (scales linearly)
 *     emoji: '🌌',
 *   }
 * }
 * ```
 */
export class JackpotService {
  /**
   * @param {Object} config - full cosmosConfig (needs config.jackpots and config.maxBet)
   */
  constructor(config) {
    this.config = config;
    this._ensureSeeded();
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  /**
   * Insert seed rows for any jackpot defined in config that doesn't yet exist in DB.
   * Safe to call multiple times — uses INSERT OR IGNORE.
   */
  _ensureSeeded() {
    if (!this.config.jackpots) return;
    for (const [id, cfg] of Object.entries(this.config.jackpots)) {
      seedJackpot.run(id, cfg.seedAmount ?? 1000);
      logger.debug('JackpotService: seeded jackpot if new', { id });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get current jackpot amount for a given id.
   * @param {string} id
   * @returns {number} current jackpot pool (0 if not found)
   */
  getAmount(id) {
    const row = getJackpot.get(id);
    return row?.amount ?? 0;
  }

  /**
   * Add a contribution from a player bet.
   * contribution = floor(bet × contributionRate)
   *
   * @param {string} id
   * @param {number} bet
   */
  contribute(id, bet) {
    const cfg = this.config.jackpots?.[id];
    if (!cfg) return;

    const contribution = Math.max(1, Math.floor(bet * (cfg.contributionRate ?? 0.01)));
    contributeJackpot.run(contribution, id);
    logger.debug('JackpotService: contribution added', { id, bet, contribution });
  }

  /**
   * Check whether the jackpot fires this bet.
   * Probability = baseChance + (bet/maxBet) × betChanceBonus + luckFactor × maxLuckBonus
   * where luckFactor = (luck - 1) / (maxTotalLuck - 1)  (0 → 1)
   *
   * @param {string} id
   * @param {number} bet
   * @param {number} luck - player's effective luck (from LuckService)
   * @returns {boolean}
   */
  tryTrigger(id, bet, luck) {
    const cfg = this.config.jackpots?.[id];
    if (!cfg) return false;

    const row = getJackpot.get(id);
    if (!row || row.amount < (cfg.seedAmount ?? 1000)) return false; // not enough in pool yet

    const maxLuck    = this.config.maxTotalLuck ?? 2.0;
    const luckFactor = Math.min(Math.max((luck - 1) / (maxLuck - 1), 0), 1);
    const betFactor  = Math.min(bet / (this.config.maxBet ?? 5000), 1);

    const chance = (cfg.baseChance ?? 0.001)
      + betFactor  * (cfg.betChanceBonus ?? 0.001)
      + luckFactor * (cfg.maxLuckBonus   ?? 0.002);

    const triggered = Math.random() < chance;
    logger.debug('JackpotService: trigger check', { id, chance, triggered });
    return triggered;
  }

  /**
   * Claim the jackpot for a winner and reset the pool to seed.
   * Returns the jackpot amount that was won.
   *
   * @param {string} id
   * @param {string} winnerUsername
   * @returns {number} amount won
   */
  claim(id, winnerUsername) {
    const row = getJackpot.get(id);
    if (!row) return 0;

    const won = row.amount;
    const seed = this.config.jackpots?.[id]?.seedAmount ?? 1000;

    resetJackpot.run(seed, Date.now(), winnerUsername, id);
    logger.info('JackpotService: jackpot claimed', { id, winnerUsername, won, resetTo: seed });
    return won;
  }

  /**
   * Human-readable summary of all jackpots.
   * @returns {Array<{ id, name, amount, emoji }>}
   */
  getAllJackpots() {
    if (!this.config.jackpots) return [];
    return Object.entries(this.config.jackpots).map(([id, cfg]) => ({
      id,
      name:   cfg.name,
      amount: this.getAmount(id),
      emoji:  cfg.emoji ?? '🌌',
    }));
  }
}
