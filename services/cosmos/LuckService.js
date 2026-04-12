import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * LuckService
 * - Computes a player's effective luck multiplier from base_luck + level perks
 * - Applies that multiplier to a list of weighted outcomes
 * - Performs weighted random selection
 */
export class LuckService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
  }

  /**
   * Compute total effective luck for a player.
   * Base luck (1.0 default) + perk bonuses, capped at maxTotalLuck.
   * @param {{ base_luck: number, level: number }} player
   * @returns {number}
   */
  computeLuck(player) {
    let luck = player.base_luck;

    for (const [requiredLevel, perk] of Object.entries(this.config.levelPerks)) {
      if (player.level >= Number(requiredLevel) && perk.luckBonus) {
        luck += perk.luckBonus;
      }
    }

    return Math.min(luck, this.config.maxTotalLuck);
  }

  /**
   * Skew a weight table so that winning outcomes are boosted
   * and losing outcomes (mult === 0) are penalised.
   * @param {Array<{ mult: number, weight: number }>} outcomes
   * @param {number} luck
   * @returns {Array}
   */
  applyLuckToOutcomes(outcomes, luck) {
    return outcomes.map(o => ({
      ...o,
      weight: o.mult === 0 ? o.weight / luck : o.weight * luck
    }));
  }

  /**
   * Weighted random pick from an outcomes array.
   * @param {Array<{ weight: number }>} outcomes
   * @returns {{ weight: number, [key: string]: any }}
   */
  weightedPick(outcomes) {
    const total = outcomes.reduce((sum, o) => sum + o.weight, 0);
    let r = Math.random() * total;

    for (const outcome of outcomes) {
      if (r < outcome.weight) return outcome;
      r -= outcome.weight;
    }

    // Fallback to last entry (floating-point safety)
    return outcomes[outcomes.length - 1];
  }
}
