/**
 * parseAmount
 * Parses a chat argument into an integer bet/amount, supporting:
 *   - Flat integers:   "100"  → 100
 *   - Percentages:     "50%"  → floor(balance * 0.50)
 *   - All balance:     "all"  → balance
 *
 * Returns null on invalid input or if the balance fetch fails.
 *
 * @param {string|undefined} input        - Raw argument from chat (e.g. "100", "50%", "all")
 * @param {Function} fetchBalance         - Async function () => number | null; only called for % / "all"
 * @returns {Promise<number|null>}
 */
export async function parseAmount(input, fetchBalance) {
  if (!input || typeof input !== 'string') return null;

  const str = input.toLowerCase().trim();

  // ── "all" ────────────────────────────────────────────────────────────────
  if (str === 'all' || str === 'все') {
    const balance = await fetchBalance();
    if (balance == null || balance <= 0) return null;
    return balance;
  }

  // ── Percentage ────────────────────────────────────────────────────────────
  if (str.endsWith('%')) {
    const pct = parseFloat(str);
    if (isNaN(pct) || pct <= 0 || pct > 100) return null;

    const balance = await fetchBalance();
    if (balance == null || balance <= 0) return null;

    return Math.max(1, Math.floor(balance * (pct / 100)));
  }

  // ── Flat integer ─────────────────────────────────────────────────────────
  const amount = parseInt(str, 10);
  if (isNaN(amount) || amount <= 0) return null;
  return amount;
}
