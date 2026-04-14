/**
 * calcXp
 * Converts an XP config value (treated as a percentage of the bet) into
 * an actual integer XP amount.
 *
 * Config convention:
 *   xp: 5   →  5% of bet
 *   xp: 10  → 10% of bet
 *
 * Examples:
 *   calcXp(5, 1000)  →  50
 *   calcXp(10, 250)  →  25
 *   calcXp(0, 500)   →   1  (minimum 1 XP always awarded)
 *
 * @param {number} xpPercent  - The `xp` field from config (percentage, 0–100)
 * @param {number} bet        - The player's bet amount
 * @returns {number}          - Integer XP ≥ 1
 */
export function calcXp(xpPercent, bet) {
  if (!xpPercent || !bet) return 1;
  return Math.max(1, Math.floor(bet * xpPercent / 100));
}
