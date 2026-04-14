/**
 * BlackjackService
 * Pure card logic for the Cosmos Casino blackjack mini-game.
 * Stateless — callers (cosmosGame.js) own session state.
 *
 * Lite rules:
 *  - Standard 52-card deck, shuffled fresh each game.
 *  - Ace = 1 or 11 (best value that doesn't bust).
 *  - J / Q / K = 10.
 *  - Blackjack = 21 with exactly 2 cards.
 *  - Dealer must hit until ≥ dealerHitUntil (configurable, default 17).
 *    When streak protection is active for the challenger, the threshold is
 *    reduced by StreakService.getDealerThresholdReduction(), making the bot
 *    dealer stand earlier and more likely to bust.
 *  - No splits, no insurance, no double-down.
 */
export class BlackjackService {
  constructor() {
    this.suits  = ['♥', '♦', '♣', '♠'];
    this.values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  }

  // ── Deck ──────────────────────────────────────────────────────────────────

  /**
   * Create and shuffle a fresh 52-card deck.
   * @returns {Array<{ suit: string, value: string }>}
   */
  createDeck() {
    const deck = [];
    for (const suit of this.suits) {
      for (const value of this.values) {
        deck.push({ suit, value });
      }
    }
    return this._shuffle(deck);
  }

  /**
   * Draw the top card from deck (mutates deck).
   * @param {Array} deck
   * @returns {{ suit: string, value: string }}
   */
  dealCard(deck) {
    return deck.pop();
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  /**
   * Calculate the best possible hand value.
   * @param {Array<{ value: string }>} hand
   * @returns {number}
   */
  getHandValue(hand) {
    let total = 0;
    let aces  = 0;

    for (const card of hand) {
      if (card.value === 'A') {
        aces++;
        total += 11;
      } else if (['J', 'Q', 'K'].includes(card.value)) {
        total += 10;
      } else {
        total += parseInt(card.value, 10);
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  /** @param {Array} hand @returns {boolean} */
  isBust(hand) {
    return this.getHandValue(hand) > 21;
  }

  /** Blackjack = 21 with exactly 2 cards. */
  isBlackjack(hand) {
    return hand.length === 2 && this.getHandValue(hand) === 21;
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  formatCard(card) {
    return `${card.value}${card.suit}`;
  }

  /**
   * @param {Array} hand
   * @param {boolean} hideFirst – replace first card with "??"
   * @returns {string}
   */
  formatHand(hand, hideFirst = false) {
    return hand
      .map((c, i) => (i === 0 && hideFirst ? '??' : this.formatCard(c)))
      .join(' ');
  }

  /**
   * Full hand summary with total.
   * @param {Array} hand
   * @param {boolean} hideFirst
   * @returns {string}  e.g. "[K♥ 5♦ = 15]"
   */
  formatHandSummary(hand, hideFirst = false) {
    const display = this.formatHand(hand, hideFirst);
    if (hideFirst) {
      const knownValue = this.getHandValue(hand.slice(1));
      return `[${display} = ?+${knownValue}]`;
    }
    return `[${display} = ${this.getHandValue(hand)}]`;
  }

  // ── Bot dealer logic ──────────────────────────────────────────────────────

  /**
   * Determine whether the bot dealer should hit.
   *
   * @param {Array} hand
   * @param {number} [hitUntil=17] - dealer hits while hand value is below this.
   *   Pass a reduced value (e.g. 15) when streak protection is active for the
   *   challenger — the dealer stands earlier, increasing bust probability.
   * @returns {boolean}
   */
  botShouldHit(hand, hitUntil = 17) {
    return this.getHandValue(hand) < hitUntil;
  }

  // ── Result evaluation ─────────────────────────────────────────────────────

  /**
   * @param {Array} challengerHand
   * @param {Array} dealerHand
   * @returns {'challenger' | 'dealer' | 'push'}
   */
  determineWinner(challengerHand, dealerHand) {
    const challengerBust = this.isBust(challengerHand);
    const dealerBust     = this.isBust(dealerHand);
    const cBJ            = this.isBlackjack(challengerHand);
    const dBJ            = this.isBlackjack(dealerHand);
    const cVal           = this.getHandValue(challengerHand);
    const dVal           = this.getHandValue(dealerHand);

    if (challengerBust)      return 'dealer';
    if (dealerBust)          return 'challenger';
    if (cBJ && !dBJ)         return 'challenger';
    if (dBJ && !cBJ)         return 'dealer';
    if (cVal > dVal)         return 'challenger';
    if (dVal > cVal)         return 'dealer';
    return 'push';
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
