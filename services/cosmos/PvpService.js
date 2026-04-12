import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * PvpService
 * Manages the full duel lifecycle:
 * - Pending challenge map (in-memory, no DB needed)
 * - Shield check (consumed on block)
 * - Luck-weighted resolution
 */
export class PvpService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);

    /**
     * Pending duels keyed by the TARGET's username.
     * @type {Map<string, { challenger: string, bet: number, expiresAt: number }>}
     */
    this.pendingDuels = new Map();
  }

  canAfford(player, bet) {
    return player.stardust >= bet;
  }

  /**
   * Register a pending challenge from `challenger` to `target`.
   */
  createChallenge(challenger, target, bet) {
    this.pendingDuels.set(target, {
      challenger,
      bet,
      expiresAt: Date.now() + this.config.duelExpiryMs
    });
  }

  /**
   * Get a pending duel for `targetUsername` if it has not expired.
   * Cleans up expired entry automatically.
   * @param {string} targetUsername
   * @returns {{ challenger: string, bet: number, expiresAt: number } | null}
   */
  getPendingDuel(targetUsername) {
    const duel = this.pendingDuels.get(targetUsername);
    if (!duel) return null;

    if (Date.now() > duel.expiresAt) {
      this.pendingDuels.delete(targetUsername);
      return null;
    }

    return duel;
  }

  clearDuel(targetUsername) {
    this.pendingDuels.delete(targetUsername);
  }

  /**
   * Remove all expired pending duels (call periodically if needed).
   */
  pruneExpired() {
    const now = Date.now();
    for (const [target, duel] of this.pendingDuels.entries()) {
      if (now > duel.expiresAt) {
        this.pendingDuels.delete(target);
      }
    }
  }

  /**
   * Resolve a duel between two players.
   * Mutates both players' stardust and p2.shield in place.
   *
   * @param {{ username: string, stardust: number, level: number, base_luck: number, shield: number }} p1 - challenger
   * @param {{ username: string, stardust: number, level: number, base_luck: number, shield: number }} p2 - accepter
   * @param {number} bet
   * @returns {{
   *   blocked: boolean,
   *   shieldHolder?: string,
   *   attacker?: string,
   *   winner?: string,
   *   loser?: string,
   *   winnerBalance?: number,
   *   xp?: number
   * }}
   */
  resolveDuel(p1, p2, bet) {
    // Shield check: p2 (the challenged player) blocks
    if (p2.shield) {
      p2.shield = 0;
      return {
        blocked: true,
        shieldHolder: p2.username,
        attacker: p1.username
      };
    }

    const luck1 = this.luckService.computeLuck(p1);
    const luck2 = this.luckService.computeLuck(p2);

    const roll1 = Math.random() * luck1;
    const roll2 = Math.random() * luck2;

    const [winner, loser] = roll1 >= roll2 ? [p1, p2] : [p2, p1];

    winner.stardust += bet;
    loser.stardust   = Math.max(0, loser.stardust - bet);

    // XP reward scales with bet size
    const xp = Math.max(10, Math.floor(bet * 0.05) + 15);

    return {
      blocked: false,
      winner: winner.username,
      loser:  loser.username,
      winnerBalance: winner.stardust,
      xp
    };
  }
}
