import logger from '../logger.js';
import gameConfigCosmos from '../../games/cosmosGames/cosmosConfig.js';

/**
 * CosmosMessageTemplate
 * All message formatting for Cosmos Casino.
 * Automatically injects {c} = currencyConfig.symbol into every template context
 * so all messages can use {c} as a compact currency token.
 */
export class CosmosMessageTemplate {
  constructor(config = gameConfigCosmos) {
    this.config   = config;
    this.currency = config.currency?.symbol ?? '✨';
  }

  // ── Core ─────────────────────────────────────────────────────────────────────

  /**
   * Replace {key} tokens in a template string.
   * Always injects `{c}` = currency symbol automatically.
   *
   * @param {string} template
   * @param {Object} [context]
   * @returns {string}
   */
  prepareMessage(template, context = {}) {
    if (!template) return '';

    // Inject currency symbol so every template can use {c}
    const ctx = { c: this.currency, ...context };

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = ctx[key];
      if (value === undefined) {
        logger.warn(`CosmosMessageTemplate: variable '{${key}}' not found in context`);
        return match;
      }
      return String(value);
    });
  }

  // ── Player helpers ────────────────────────────────────────────────────────────

  effectiveLuck(player) {
    let luck = player.base_luck;
    for (const [reqLevel, perk] of Object.entries(this.config.levelPerks)) {
      if (player.level >= Number(reqLevel) && perk.luckBonus) {
        luck += perk.luckBonus;
      }
    }
    return Math.min(luck, this.config.maxTotalLuck);
  }

  xpToNextLevel(level) {
    const { base, multiplier } = this.config.xpFormula;
    return Math.floor(base * Math.pow(multiplier, level));
  }

  // ── Formatted messages ────────────────────────────────────────────────────────

  formatBalance(player) {
    return this.prepareMessage(this.config.messages.balance, {
      username:     player.username,
      balance:      player.stardust,
      level:        player.level,
      xp:           player.xp,
      xpNext:       this.xpToNextLevel(player.level),
      luck:         this.effectiveLuck(player).toFixed(2),
      shieldStatus: player.shield ? ' | 🛡️ Щит' : '',
    });
  }

  formatLevelUp(level, perksUnlocked) {
    const perkDesc = perksUnlocked?.length
      ? perksUnlocked.join(', ')
      : `Рівень ${level}!`;
    return this.prepareMessage(this.config.messages.levelUp, { level, perkDesc });
  }

  formatPerks(player) {
    const extras = [];
    if (player.shield)      extras.push('🛡️ Щит активний');
    if (player.level >= 20) extras.push('⚡ 2x XP');
    if (player.level >= 30) extras.push('🌌 КОСМІЧНИЙ');
    if (player.level >= 25) extras.push('📦 -50% ящик');

    return this.prepareMessage(this.config.messages.perks, {
      username: player.username,
      level:    player.level,
      luck:     this.effectiveLuck(player).toFixed(2),
      xp:       player.xp,
      xpNext:   this.xpToNextLevel(player.level),
      extra:    extras.length ? ' | ' + extras.join(' | ') : '',
    });
  }

  formatLeaderboard(players) {
    if (!players?.length) return this.config.messages.noPlayers;
    const leaderboard = players
      .map((p, i) => `${i + 1}. ${p.username} (${p.stardust} ${this.currency} Lvl${p.level})`)
      .join(' | ');
    return this.prepareMessage(this.config.messages.leaderboard, { leaderboard });
  }

  formatDailyReward({ username, amount, balance }) {
    return this.prepareMessage(this.config.messages.dailyReward, { username, amount, balance });
  }

  formatDailyCooldown({ username, remainingMs }) {
    const hours   = Math.floor(remainingMs / 3_600_000);
    const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
    const remaining = hours > 0 ? `${hours}г ${minutes}хв` : `${minutes}хв`;
    return this.prepareMessage(this.config.messages.dailyCooldown, { username, remaining });
  }

  formatJackpotStatus(jackpot) {
    return this.prepareMessage(this.config.messages.jackpotStatus, {
      emoji:  jackpot.emoji,
      name:   jackpot.name,
      amount: jackpot.amount,
    });
  }

  formatJackpotWon({ username, amount, name, emoji }) {
    return this.prepareMessage(this.config.messages.jackpotWon, { username, amount, name, emoji });
  }
}
