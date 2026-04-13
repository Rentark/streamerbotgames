import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * MysteryBoxService
 * Opens a cosmic mystery box with luck-weighted outcomes.
 * Mutates only progression fields (base_luck, shield) in place.
 * All SE balance changes are returned as instructions for callers to execute.
 *
 * The "chaos" outcome affects multiple recent chatters — the caller must supply
 * a `recentChatters` iterable and handle the per-chatter SE deductions.
 */
export class MysteryBoxService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);
  }

  /** Box cost, halved at level 25 perk. */
  getCost(playerLevel) {
    const perk = this.config.levelPerks[25];
    if (perk?.boxDiscount && playerLevel >= 25) {
      return Math.floor(this.config.boxCost * (1 - perk.boxDiscount));
    }
    return this.config.boxCost;
  }

  /**
   * Open a mystery box.
   * Mutates `player` in place for luck/shield fields only.
   * Returns a result describing what happened — caller handles SE points.
   *
   * @param {{ level: number, base_luck: number, shield: number }} player - progression only
   * @param {number} currentBalance   - player's current SE points (for no_funds check)
   * @param {Iterable<string>} recentChatters - usernames of recent chatters (for chaos)
   * @returns {{
   *   error?: 'no_funds',
   *   cost?: number,
   *   type?: string,
   *   emoji?: string,
   *   label?: string,
   *   selfDelta?: number,           // SE points change for box opener
   *   chaosChatters?: string[],     // usernames to deduct from (chaos only)
   *   chaosDeductPercent?: number,  // % to deduct from each chatter (chaos only)
   * }}
   */
  openBox(player, currentBalance, recentChatters = []) {
    const cost = this.getCost(player.level);

    if (currentBalance < cost) {
      return { error: 'no_funds', cost };
    }

    const luck = this.luckService.computeLuck(player);
    const adjustedOutcomes = this.luckService.applyLuckToOutcomes(
      this.config.mysteryBox.outcomes,
      luck
    );

    const outcome = this.luckService.weightedPick(adjustedOutcomes);

    const label = outcome.label
      ? outcome.label
          .replace('{value}',    String(Math.abs(outcome.value)))
          .replace('{absValue}', String(Math.abs(outcome.value)))
      : '???';

    const base = { type: outcome.type, emoji: outcome.emoji, label };

    switch (outcome.type) {
      case 'small_win':
      case 'big_win':
      case 'jackpot_win':
        // Net: opener pays cost, gains outcome.value
        return { ...base, selfDelta: outcome.value - cost };

      case 'lose':
        return { ...base, selfDelta: outcome.value - cost }; // outcome.value is negative

      case 'luck_boost':
        player.base_luck = Math.min(player.base_luck + outcome.value, this.config.maxBaseLuck);
        return { ...base, selfDelta: -cost };

      case 'shield':
        player.shield = 1;
        return { ...base, selfDelta: -cost };

      case 'chaos': {
        // Deduct cost from opener; pick chatters to punish
        const cfg = this.config.mysteryBox.chaosConfig;
        const eligibleChatters = [...recentChatters].filter(Boolean);

        let affected;
        if (cfg.affectAll) {
          affected = eligibleChatters;
        } else {
          // Shuffle and take up to maxChattersAffected
          for (let i = eligibleChatters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligibleChatters[i], eligibleChatters[j]] = [eligibleChatters[j], eligibleChatters[i]];
          }
          affected = eligibleChatters.slice(0, cfg.maxChattersAffected);
        }

        return {
          ...base,
          selfDelta: -cost,
          chaosChatters: affected,
          chaosDeductPercent: cfg.deductPercent,
        };
      }

      default:
        return { ...base, selfDelta: -cost };
    }
  }
}
