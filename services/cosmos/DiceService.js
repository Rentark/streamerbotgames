import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * DiceService
 * Simple dice / roulette mini-game.
 *
 * The player bets an amount. A single d6 is rolled for display flavor.
 * Win/loss is determined by a luck-adjusted probability threshold.
 *
 * Config knobs:
 *   dice.winChance          - base win probability (0-1, e.g. 0.45)
 *   dice.winMult            - win payout multiplier (e.g. 2.0 = double)
 *   dice.maxLuckWinChanceBonus - max extra win probability from luck (e.g. 0.10)
 *   dice.luckWinAmountBonus    - if true, luck also scales the win amount
 *   dice.maxLuckWinAmountMult  - max fractional bonus applied to win when above is true
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
   * @param {number} bet    - validated integer bet amount
   * @param {number} luck   - player's effective luck (from LuckService.computeLuck, ≥ 1.0)
   * @returns {{
   *   diceValue: number,  // 1–6 display value
   *   won: boolean,
   *   win: number,        // points won (0 on loss)
   *   net: number,        // win - bet (negative on loss)
   *   xp: number,
   *   winChance: number   // the adjusted probability used (for debug/transparency)
   * }}
   */
  roll(bet, luck) {
    const cfg = this.config.dice;

    // Luck factor: 0.0 (luck = 1.0) to 1.0 (luck = maxTotalLuck)
    const maxLuck   = this.config.maxTotalLuck ?? 2.0;
    const luckFactor = Math.min(Math.max((luck - 1.0) / (maxLuck - 1.0), 0), 1);

    // Adjusted win chance: base + up to maxLuckWinChanceBonus
    const winChance = Math.min(
      cfg.winChance + luckFactor * cfg.maxLuckWinChanceBonus,
      0.95  // hard cap — always some risk
    );

    const roll = Math.random();
    const won  = roll < winChance;

    // d6 display value: map the 0-1 roll to 1-6
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
      xp:        won ? cfg.xpWin ?? 15 : cfg.xpLose ?? 3,
      winChance,
    };
  }
}
