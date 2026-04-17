import { LuckService } from './LuckService.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * SlotsService — outcome-first 3-reel slot machine.
 *
 * NEW ARCHITECTURE (replaces weight-on-symbol approach):
 *
 * 1. Payout keys carry their own `weight` — this is what gets luck-adjusted
 *    and randomly selected. Win rates are now directly readable in config.
 * 2. Symbols are **categories** with multiple `emojis`. One random emoji is
 *    picked per category at display time.
 * 3. Reel display is generated *after* the outcome is chosen, ensuring
 *    consistency (e.g. triple_diamond always shows 3 of the SAME emoji —
 *    either all 💎 or all 💍, never mixed).
 *
 * Config shape expected (cosmosConfig.js):
 * ```js
 * reels: {
 *   symbols: [
 *     { id: 'jackpot', emojis: ['🌟', '⭐'],   dust: false },
 *     { id: 'diamond', emojis: ['💎', '💍'],   dust: false },
 *     { id: 'dust',    emojis: ['💨', '🌫️'], dust: true  },
 *   ],
 *   payouts: {
 *     triple_jackpot: { mult: 20, xp: 100, weight: 1,  label: '...' },
 *     triple_diamond: { mult: 10, xp: 50,  weight: 3,  label: '...' },
 *     triple_any:     { mult: 5,  xp: 25,  weight: 15, label: '...' },
 *     double_jackpot: { mult: 3,  xp: 15,  weight: 20, label: '...' },
 *     double_any:     { mult: 1.5,xp: 5,   weight: 50, label: '...' },
 *     none:           { mult: 0,  xp: 2,   weight: 200,label: null  },
 *   },
 * }
 * ```
 *
 * Does NOT handle SE balance — callers manage points via MessageService.
 */
export class SlotsService {
  constructor(config = gameConfigCosmos) {
    this.config = config;
    this.luckService = new LuckService(config);
  }

  // ── Outcome selection ──────────────────────────────────────────────────────

  /**
   * Pick a payout outcome weighted by payout.weight, luck-adjusted.
   * Luck boosts winning outcomes (mult > 0) and penalises none/dust outcomes.
   *
   * @param {number} luck - player's effective luck (≥ 1.0)
   * @returns {{ key: string, payout: Object }}
   */
  _selectOutcome(luck) {
    const payouts  = this.config.reels.payouts;
    const entries  = Object.entries(payouts);

    const adjusted = entries.map(([key, p]) => ({
      key,
      payout: p,
      weight: p.mult === 0 ? p.weight : p.weight * luck,
    }));

    const total = adjusted.reduce((s, e) => s + e.weight, 0);
    let r       = Math.random() * total;

    for (const entry of adjusted) {
      if (r < entry.weight) return entry;
      r -= entry.weight;
    }

    // Fallback: 'none'
    const noneEntry = adjusted.find(e => e.key === 'none') ?? adjusted[adjusted.length - 1];
    return noneEntry;
  }

  // ── Display generation ─────────────────────────────────────────────────────

  /**
   * Pick one random emoji from a symbol category by id.
   * @param {string} categoryId
   * @returns {string} emoji
   */
  _emojiFor(categoryId) {
    const cat = this.config.reels.symbols.find(s => s.id === categoryId);
    if (!cat || !cat.emojis?.length) return '❓';
    return cat.emojis[Math.floor(Math.random() * cat.emojis.length)];
  }

  /**
   * Return all category ids that do NOT have their own specific payout for a
   * given combination prefix (e.g. 'triple_' or 'double_').
   * Used by triple_any / double_any to pick a non-specific category.
   *
   * @param {string} prefix  e.g. 'triple_' or 'double_'
   * @returns {string[]}     array of category ids
   */
  _categoriesWithoutSpecific(prefix) {
    const specificIds = new Set(
      Object.keys(this.config.reels.payouts)
        .filter(k => k.startsWith(prefix) && k !== `${prefix}any`)
        .map(k => k.slice(prefix.length))
    );
    return this.config.reels.symbols
      .filter(s => !specificIds.has(s.id))
      .map(s => s.id);
  }

  /**
   * Pick a random item from an array.
   * @param {Array} arr
   * @returns {*}
   */
  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generate three reel emoji strings consistent with the given outcome key.
   *
   * Rules:
   *   triple_X      → 3× same emoji from category X
   *   triple_any    → 3× same emoji from a non-specific category
   *   double_X      → 2× same emoji from category X + 1 different emoji/category
   *   double_any    → 2× same emoji from a non-specific category + 1 different
   *   none          → 3 different emojis from 3 different categories (no match)
   *
   * @param {string} outcomeKey
   * @returns {string[]}  array of 3 emoji strings  e.g. ['💎', '💎', '🌟']
   */
  _generateReels(outcomeKey) {
    const symbols = this.config.reels.symbols;

    // ── triple ────────────────────────────────────────────────────────────────
    if (outcomeKey.startsWith('triple_')) {
      const catId = outcomeKey === 'triple_any'
        ? this._pick(this._categoriesWithoutSpecific('triple_'))
        : outcomeKey.slice('triple_'.length);

      const emoji = this._emojiFor(catId);
      return [emoji, emoji, emoji];
    }

    // ── double ────────────────────────────────────────────────────────────────
    if (outcomeKey.startsWith('double_')) {
      const catId = outcomeKey === 'double_any'
        ? this._pick(this._categoriesWithoutSpecific('double_'))
        : outcomeKey.slice('double_'.length);

      const winEmoji = this._emojiFor(catId);

      // Third reel: pick a category that is NOT the winning category
      const otherCats = symbols.map(s => s.id).filter(id => id !== catId);
      const otherCatId = otherCats.length ? this._pick(otherCats) : catId;
      const otherEmoji = this._emojiFor(otherCatId);

      // Randomly arrange: double can appear at any 2 of the 3 positions
      const positions = this._shuffleDouble(winEmoji, otherEmoji);
      return positions;
    }

    // ── none (no match) ───────────────────────────────────────────────────────
    // Pick 3 *different* categories if possible, then a random emoji from each
    const shuffled = [...symbols].sort(() => Math.random() - 0.5);
    const c1 = shuffled[0]?.id;
    const c2 = shuffled[1]?.id ?? c1;
    const c3 = shuffled[2]?.id ?? c2;

    // Make sure none results in an accidental double — re-roll if same emoji
    let e1 = this._emojiFor(c1);
    let e2 = this._emojiFor(c2);
    let e3 = this._emojiFor(c3);

    // In edge cases where the pool is tiny and two identical emojis land,
    // just accept it — the outcome key is authoritative, not the display.
    return [e1, e2, e3];
  }

  /**
   * Arrange one winning emoji (appears 2×) and one other emoji (appears 1×)
   * into a random 3-reel order.
   *
   * @param {string} win    emoji that appears twice
   * @param {string} other  emoji that appears once
   * @returns {string[]}
   */
  _shuffleDouble(win, other) {
    const patterns = [
      [win, win, other],
      [win, other, win],
      [other, win, win],
    ];
    return this._pick(patterns);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Perform a full slot spin. Pure computation — no side effects.
   *
   * @param {number} bet   - validated integer bet amount
   * @param {number} luck  - player's effective luck from LuckService.computeLuck()
   * @returns {{
   *   reelDisplay: string,   // "💎 💎 🌟"
   *   outcomeKey:  string,   // payout key used
   *   win:         number,   // points won (0 on loss)
   *   net:         number,   // win - bet
   *   xp:          number,
   *   label:       string|null
   * }}
   */
  spin(bet, luck) {
    const { key, payout } = this._selectOutcome(luck);
    const reels           = this._generateReels(key);
    const win             = Math.floor(bet * payout.mult);

    return {
      reelDisplay: reels.join(' '),
      outcomeKey:  key,
      win,
      net:         win - bet,
      xp:          payout.xp ?? 2,
      label:       payout.label ?? null,
    };
  }
}
