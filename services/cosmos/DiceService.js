import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * DiceService
 * Simple dice / roulette mini-game.
 *
 * Win/loss is determined by a luck-adjusted probability threshold.
 * An optional `streakWinChanceBonus` can be passed in by the command handler
 * (sourced from StreakService) to further boost the win probability after
 * a configured number of consecutive losses.
 *
 * Config knobs (under config.dice):
 *   winChance              - base win probability (0-1, e.g. 0.45)
 *   winMult                - win payout multiplier (e.g. 2.0 = double)
 *   maxLuckWinChanceBonus  - max extra win probability from luck
 *   luckWinAmountBonus     - if true, luck also scales the win amount
 *   maxLuckWinAmountMult   - max fractional bonus applied to win when above is true
 *
 * Does NOT manage SE balance — callers handle money via MessageService.
 */
export class DiceService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
  }

  /**
   * Roll the dice for a player.
   * Pure computation — no side effects.
   *
   * @param {number} bet                    - validated integer bet amount
   * @param {number} luck                   - player's effective luck (≥ 1.0)
   * @param {number} [streakWinChanceBonus] - extra win probability from streak protection (default 0)
   * @returns {{
   *   diceValue: number,   // 1–6 display value
   *   won: boolean,
   *   win: number,         // points won (0 on loss)
   *   net: number,         // win - bet (negative on loss)
   *   xp: number,          // raw xp config value (percentage of bet, calculated by caller)
   *   winChance: number    // final adjusted probability used
   * }}
   */
  roll(bet, luck, streakWinChanceBonus = 0) {
    const cfg = this.config.dice;

    // Luck factor: 0.0 (luck = 1.0) → 1.0 (luck = maxTotalLuck)
    const maxLuck    = this.config.maxTotalLuck ?? 2.0;
    const luckFactor = Math.min(Math.max((luck - 1.0) / (maxLuck - 1.0), 0), 1);

    // Win chance: base + luck bonus + streak bonus, hard-capped at 0.95
    const winChance = Math.min(
      cfg.winChance
        + luckFactor * cfg.maxLuckWinChanceBonus
        + streakWinChanceBonus,
      0.95
    );

    const roll = Math.random();
    const won  = roll < winChance;

    // d6 display value
    const diceValue = Math.min(6, Math.floor(roll * 6) + 1);

    let win = 0;
    if (won) {
      win = Math.floor(bet * cfg.winMult);

      // Optional: luck also boosts win amount
      if (cfg.luckWinAmountBonus) {
        const amountBonus = 1 + luckFactor * cfg.maxLuckWinAmountMult;
        win = Math.floor(win * amountBonus);
      }
    }

    return {
      diceValue,
      won,
      win,
      net:       won ? win - bet : -bet,
      xp:        won ? (cfg.xpWin ?? 15) : (cfg.xpLose ?? 3),
      winChance,
    };
  }
}
