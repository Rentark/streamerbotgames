/**
 * currencyConfig
 * Single source of truth for the StreamElements point currency name used across
 * all games (Knock, Starfall, Cosmos Casino).
 *
 * Changing `name` / `partialName` / `endings` here propagates everywhere automatically.
 */
export const currencyConfig = {
  /** Full display name, e.g. shown in leaderboard titles */
  name: 'зірочки',

  /** Stem used for declension (endings appended based on number) */
  partialName: 'зіроч',

  /**
   * Ukrainian grammatical endings keyed by last-two-digit rule:
   *   '0'   → numbers ending in 0, or 11–14 (genitive plural)  → зірочок
   *   '1'   → numbers ending in 1 (except 11)                   → зірочку
   *   '2-4' → numbers ending in 2, 3, 4 (except 12–14)          → зірочки
   */
  endings: { '0': 'ок', '1': 'ку', '2-4': 'ки' },

  /** Compact emoji symbol used inline in cosmos messages */
  symbol: '✨',
};

/**
 * Returns the correct grammatical form for any integer amount.
 * Examples: formatCurrency(1) → "1 зірочку"
 *           formatCurrency(21) → "21 зірочку"
 *           formatCurrency(5) → "5 зірочок"
 *           formatCurrency(500) → "500 зірочок"
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const abs  = Math.abs(Math.floor(amount));
  const last2 = abs % 100;
  const last1 = abs % 10;

  let ending;
  if (last2 >= 11 && last2 <= 14) {
    ending = currencyConfig.endings['0'];
  } else if (last1 === 1) {
    ending = currencyConfig.endings['1'];
  } else if (last1 >= 2 && last1 <= 4) {
    ending = currencyConfig.endings['2-4'];
  } else {
    ending = currencyConfig.endings['0'];
  }

  return `${amount} ${currencyConfig.partialName}${ending}`;
}

/**
 * Returns just the grammatical suffix for the amount (no number).
 * Matches the existing `getRewardTypeEnd` pattern in KnockMessageTemplate / StarfallMessageTemplate.
 *
 * @param {number} amount
 * @returns {string}  e.g. "ок", "ку", "ки"
 */
export function getCurrencyEnding(amount) {
  const abs  = Math.abs(Math.floor(amount));
  const last2 = abs % 100;
  const last1 = abs % 10;

  if (last2 >= 11 && last2 <= 14) return currencyConfig.endings['0'];
  if (last1 === 1)                  return currencyConfig.endings['1'];
  if (last1 >= 2 && last1 <= 4)     return currencyConfig.endings['2-4'];
  return currencyConfig.endings['0'];
}
