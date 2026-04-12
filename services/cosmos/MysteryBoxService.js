import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * MysteryBoxService
 * Opens a cosmic mystery box for a player.
 * Applies luck weighting, handles all outcome types, mutates player in place.
 */
export class MysteryBoxService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);
  }

  /**
   * Cost of opening a box for this player (level-25 perk halves it).
   * @param {{ level: number }} player
   * @returns {number}
   */
  getCost(player) {
    const perk = this.config.levelPerks[25];
    if (perk?.boxDiscount && player.level >= 25) {
      return Math.floor(this.config.boxCost * (1 - perk.boxDiscount));
    }
    return this.config.boxCost;
  }

  /**
   * Open a mystery box.
   * Mutates player in place (stardust, base_luck, shield).
   *
   * @param {{ stardust: number, level: number, base_luck: number, shield: number }} player
   * @returns {{
   *   error?: 'no_funds',
   *   cost?: number,
   *   type?: string,
   *   emoji?: string,
   *   label?: string,
   *   value?: number,
   *   balance?: number,
   *   newBaseLuck?: number
   * }}
   */
  openBox(player) {
    const cost = this.getCost(player);

    if (player.stardust < cost) {
      return { error: 'no_funds', cost };
    }

    player.stardust -= cost;

    const luck = this.luckService.computeLuck(player);
    const adjustedOutcomes = this.luckService.applyLuckToOutcomes(
      this.config.mysteryBox.outcomes,
      luck
    );

    const outcome = this.luckService.weightedPick(adjustedOutcomes);

    const label = outcome.label
      ? outcome.label
          .replace('{value}',    String(outcome.value))
          .replace('{absValue}', String(Math.abs(outcome.value)))
      : '???';

    switch (outcome.type) {
      case 'small_win':
      case 'big_win':
      case 'jackpot_win':
        player.stardust += outcome.value;
        return { type: outcome.type, emoji: outcome.emoji, label, value: outcome.value, balance: player.stardust };

      case 'lose':
        player.stardust = Math.max(0, player.stardust + outcome.value); // value is negative
        return { type: outcome.type, emoji: outcome.emoji, label, value: outcome.value, balance: player.stardust };

      case 'luck_boost':
        player.base_luck = Math.min(
          player.base_luck + outcome.value,
          this.config.maxBaseLuck
        );
        return { type: outcome.type, emoji: outcome.emoji, label, newBaseLuck: player.base_luck, balance: player.stardust };

      case 'shield':
        player.shield = 1;
        return { type: outcome.type, emoji: outcome.emoji, label, balance: player.stardust };

      case 'chaos': {
        // Chaos: lose 15% of current stardust (after box cost was already deducted)
        const loss = Math.floor(player.stardust * 0.15);
        player.stardust = Math.max(0, player.stardust - loss);
        return { type: outcome.type, emoji: outcome.emoji, label, value: -loss, balance: player.stardust };
      }

      default:
        return { type: 'unknown', emoji: '❓', label: '???', balance: player.stardust };
    }
  }
}
