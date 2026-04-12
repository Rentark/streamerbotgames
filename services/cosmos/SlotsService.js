import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * SlotsService
 * Handles a single slot spin: validates bet, picks outcome, mutates player balance.
 */
export class SlotsService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);
  }

  /**
   * Spin the slots for a player.
   * Mutates player.stardust in place.
   *
   * @param {{ stardust: number, level: number, base_luck: number }} player
   * @param {number} bet
   * @returns {{
   *   error?: 'bet_too_low' | 'bet_too_high' | 'no_funds',
   *   outcome?: string,
   *   emoji?: string,
   *   label?: string | null,
   *   win?: number,
   *   bet?: number,
   *   xp?: number
   * }}
   */
  spin(player, bet) {
    if (bet < this.config.minBet) {
      return { error: 'bet_too_low' };
    }

    if (bet > this.config.maxBet) {
      return { error: 'bet_too_high' };
    }

    if (player.stardust < bet) {
      return { error: 'no_funds' };
    }

    player.stardust -= bet;

    const luck = this.luckService.computeLuck(player);
    const adjustedOutcomes = this.luckService.applyLuckToOutcomes(
      this.config.slots.outcomes,
      luck
    );

    const outcome = this.luckService.weightedPick(adjustedOutcomes);
    const win = Math.floor(bet * outcome.mult);

    player.stardust += win;

    return {
      outcome: outcome.type,
      emoji:   outcome.emoji,
      label:   outcome.label,
      win,
      bet,
      xp: outcome.xp
    };
  }
}
