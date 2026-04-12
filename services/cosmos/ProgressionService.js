import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * ProgressionService
 * Manages XP gains, level-ups, and perk lookups.
 */
export class ProgressionService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
  }

  /**
   * XP needed to advance from `level` to `level + 1`.
   * Formula: floor(base * multiplier^level)
   * @param {number} level
   * @returns {number}
   */
  xpToNextLevel(level) {
    const { base, multiplier } = this.config.xpFormula;
    return Math.floor(base * Math.pow(multiplier, level));
  }

  /**
   * Add XP to a player object (mutates in place).
   * Handles multi-level-up in a single call.
   * Level-20 perk (doubleXP) is applied before adding.
   *
   * @param {{ xp: number, level: number }} player
   * @param {number} amount - raw XP to add
   * @returns {{ leveled: boolean, newLevel: number, perksUnlocked: string[] }}
   */
  addXP(player, amount) {
    // Level 20 perk: double XP
    if (player.level >= 20 && this.config.levelPerks[20]?.doubleXP) {
      amount = amount * 2;
    }

    player.xp += amount;

    let leveled = false;
    const perksUnlocked = [];

    while (player.xp >= this.xpToNextLevel(player.level)) {
      player.xp -= this.xpToNextLevel(player.level);
      player.level++;
      leveled = true;

      const perk = this.config.levelPerks[player.level];
      if (perk) {
        perksUnlocked.push(perk.description);
      }
    }

    return { leveled, newLevel: player.level, perksUnlocked };
  }

  /**
   * All perk objects that are active at the given level (accumulated).
   * @param {number} level
   * @returns {Array<Object>}
   */
  getActivePerks(level) {
    return Object.entries(this.config.levelPerks)
      .filter(([reqLevel]) => level >= Number(reqLevel))
      .map(([, perk]) => perk);
  }

  /**
   * Human-readable summary of active perks for display.
   * @param {number} level
   * @returns {string[]}
   */
  getPerkDescriptions(level) {
    return this.getActivePerks(level).map(p => p.description);
  }
}
