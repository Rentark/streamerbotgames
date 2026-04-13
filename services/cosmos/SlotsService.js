import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * SlotsService — 3-reel single-row slot machine.
 *
 * Each spin builds three independent reels from the symbol pool in config.
 * Symbol weights are adjusted by the player's luck before each reel pick.
 * Higher luck shifts the distribution toward rarer (higher-value) symbols.
 *
 * Payout is determined by the combination of the three reel results.
 * Does NOT handle SE balance — callers manage money via MessageService.
 */
export class SlotsService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);
  }

  // ── Reel builder ────────────────────────────────────────────────────────────

  /** Pick one symbol from the pool with luck-adjusted weights. */
  _pickSymbol(luck) {
    const adjusted = this.config.reels.symbols.map(s => ({
      ...s,
      weight: s.dust ? s.weight / luck : s.weight * luck
    }));
    return this.luckService.weightedPick(adjusted);
  }

  /** Spin all three reels independently. */
  _spinReels(luck) {
    return [this._pickSymbol(luck), this._pickSymbol(luck), this._pickSymbol(luck)];
  }

  /**
   * Determine payout key from 3 reel results.
   * Priority: triple_specific > triple_any > double_specific > double_any > none
   */
  _evaluateReels(reels) {
    const [a, b, c] = reels.map(r => r.id);
    const payouts = this.config.reels.payouts;

    if (a === b && b === c) {
      const specific = `triple_${a}`;
      return payouts[specific] ? specific : 'triple_any';
    }

    const doubled = (a === b) ? a : (b === c) ? b : (a === c) ? a : null;
    if (doubled) {
      const specific = `double_${doubled}`;
      return payouts[specific] ? specific : 'double_any';
    }

    return 'none';
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Perform a full slot spin. Pure computation — no side effects.
   *
   * @param {number} bet   - validated integer bet amount
   * @param {number} luck  - player's effective luck from LuckService.computeLuck()
   * @returns {{
   *   reelDisplay: string,  // "🌟 💎 🌟"
   *   outcomeKey: string,
   *   win: number,          // points won (0 on loss)
   *   net: number,          // win - bet
   *   xp: number,
   *   label: string|null
   * }}
   */
  spin(bet, luck) {
    const reels  = this._spinReels(luck);
    const key    = this._evaluateReels(reels);
    const payout = this.config.reels.payouts[key] ?? this.config.reels.payouts['none'];
    const win    = Math.floor(bet * payout.mult);

    return {
      reelDisplay: reels.map(r => r.emoji).join(' '),
      outcomeKey:  key,
      win,
      net:         win - bet,
      xp:          payout.xp,
      label:       payout.label ?? null,
    };
  }
}
