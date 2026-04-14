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
 *  - Dealer must hit until ≥ 17 (bot mode).
 *  - No splits, no insurance, no double-down to keep it simple.
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
   * Calculate the best possible hand value (never exceeds 21 unless forced).
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

    // Downgrade aces from 11 → 1 while busted
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

  /**
   * Format a card for display.
   * @param {{ suit: string, value: string }} card
   * @returns {string}  e.g. "K♥"
   */
  formatCard(card) {
    return `${card.value}${card.suit}`;
  }

  /**
   * Format a hand as a space-separated string.
   * @param {Array} hand
   * @param {boolean} hideFirst  – replace first card with "??"
   * @returns {string}  e.g. "K♥ 5♦" or "?? Q♠"
   */
  formatHand(hand, hideFirst = false) {
    return hand
      .map((c, i) => (i === 0 && hideFirst ? '??' : this.formatCard(c)))
      .join(' ');
  }

  /**
   * Full hand summary: cards + total (or "??" for dealer's hidden card).
   * @param {Array} hand
   * @param {boolean} hideFirst
   * @returns {string}  e.g. "[K♥ 5♦ = 15]"
   */
  formatHandSummary(hand, hideFirst = false) {
    const display = this.formatHand(hand, hideFirst);
    if (hideFirst) {
      // Show value of known cards only
      const knownCards = hand.slice(1);
      const knownValue = this.getHandValue(knownCards);
      return `[${display} = ?+${knownValue}]`;
    }
    const value = this.getHandValue(hand);
    return `[${display} = ${value}]`;
  }

  // ── Bot dealer logic ──────────────────────────────────────────────────────

  /**
   * Determine whether the bot dealer should hit.
   * Standard rule: hit until hand value ≥ 17.
   * @param {Array} hand
   * @returns {boolean}
   */
  botShouldHit(hand) {
    return this.getHandValue(hand) < 17;
  }

  /**
   * Auto-play bot dealer from its current hand until it stands or busts.
   * Mutates hand in place, drawing from deck.
   *
   * @param {Array} hand   – dealer's current hand (mutated)
   * @param {Array} deck   – deck to draw from (mutated)
   * @returns {Array}      – the final hand (same reference)
   */
  botPlay(hand, deck) {
    while (this.botShouldHit(hand) && deck.length > 0) {
      hand.push(this.dealCard(deck));
    }
    return hand;
  }

  // ── Result evaluation ─────────────────────────────────────────────────────

  /**
   * Determine the winner given two final hands.
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

    if (challengerBust)                         return 'dealer';
    if (dealerBust)                             return 'challenger';
    if (cBJ && !dBJ)                            return 'challenger';
    if (dBJ && !cBJ)                            return 'dealer';
    if (cVal > dVal)                            return 'challenger';
    if (dVal > cVal)                            return 'dealer';
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
