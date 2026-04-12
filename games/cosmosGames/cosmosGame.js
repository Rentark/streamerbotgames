import logger from '../../utils/logger.js';
import { MessageService }          from '../../services/MessageService.js';
import { TwitchChatMonitor }       from '../../services/TwitchChatMonitor.js';
import { SlotsService }            from '../../services/cosmos/SlotsService.js';
import { PvpService }              from '../../services/cosmos/PvpService.js';
import { MysteryBoxService }       from '../../services/cosmos/MysteryBoxService.js';
import { ProgressionService }      from '../../services/cosmos/ProgressionService.js';
import { CosmosMessageTemplate }   from '../../utils/messageTemplates/CosmosMessageTemplate.js';
import { getPlayer, createPlayer, updatePlayer, getTopByStardust } from '../../db/queries.js';
import gameConfigCosmos             from './cosmosConfig.js';
import {
  cosmosEnabled,
  setCosmosEnabled,
  normalizeUsername,
  canUseCommand,
  canSendWarning
} from './state.js';

// Ensure cosmos tables exist before any query runs
import '../../db/db.js';

/**
 * CosmosGame
 * Space-themed Twitch chat casino with:
 * - Slots  (!spin <bet>)
 * - PvP duels  (!duel @user <bet>  →  target: !accept / !decline)
 * - Mystery boxes  (!box)
 * - Balance, leaderboard, perks, daily reward, shield purchase
 * - Level & XP progression with per-level perk unlocks
 */
class CosmosGames {
  constructor(config = gameConfigCosmos, options = {}) {
    this.config = config;
    this.gameId = `cosmos-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning = false;
    this.startHttpServer = options.startHttpServer !== false;

    // Bot message throttle window
    this.botMessageTimes = [];

    // Services
    this.messageService  = new MessageService();
    this.chatMonitor     = TwitchChatMonitor.getInstance();
    this.slotsService    = new SlotsService(config);
    this.pvpService      = new PvpService(config);
    this.boxService      = new MysteryBoxService(config);
    this.progression     = new ProgressionService(config);
    this.template        = new CosmosMessageTemplate(config);

    // Bind handlers (belt-and-suspenders alongside arrow properties)
    this.handleConnect    = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  // ── TwitchChatMonitor callbacks ───────────────────────────────────────────

  handleConnect = async () => {
    logger.info('CosmosGame connected to Streamer.bot');
    this.client = this.chatMonitor.getClient();
    if (this.client) {
      this.messageService.setClient(this.client);
    }
  }

  handleDisconnect = async () => {
    logger.info('CosmosGame disconnected from Streamer.bot');
  }

  handleChatMessage = async ({ message, username }) => {
    if (!message || !username) return;

    const sender = normalizeUsername(username);
    if (!sender) return;

    if (!cosmosEnabled) return;

    const parts   = message.trim().split(/\s+/);
    const command = parts[0].toLowerCase().trim();
    const cmds    = this.config.commands;

    try {
      if      (cmds.spin.has(command))        await this.handleSpinCommand(sender, parts);
      else if (cmds.duel.has(command))        await this.handleDuelCommand(sender, parts);
      else if (cmds.duelAccept.has(command))  await this.handleDuelAccept(sender);
      else if (cmds.duelDecline.has(command)) await this.handleDuelDecline(sender);
      else if (cmds.box.has(command))         await this.handleBoxCommand(sender);
      else if (cmds.balance.has(command))     await this.handleBalanceCommand(sender);
      else if (cmds.top.has(command))         await this.handleTopCommand();
      else if (cmds.perks.has(command))       await this.handlePerksCommand(sender);
      else if (cmds.daily.has(command))       await this.handleDailyCommand(sender);
      else if (cmds.shield.has(command))      await this.handleShieldCommand(sender);
    } catch (error) {
      logger.error('CosmosGame: error handling message', { error, command, sender });
    }
  }

  // ── Player persistence helpers ────────────────────────────────────────────

  /**
   * Ensure the player row exists, then return it with `username` on the object.
   * @param {string} username - normalized (lowercase)
   * @returns {{ username: string, stardust: number, level: number, xp: number, base_luck: number, shield: number, last_daily: number }}
   */
  getOrCreatePlayer(username) {
    createPlayer.run(username, Date.now());
    return { ...getPlayer.get(username), username };
  }

  /**
   * Persist all mutable fields back to SQLite.
   * @param {{ username: string, stardust: number, level: number, xp: number, base_luck: number, shield: number, last_daily: number }} player
   */
  savePlayer(player) {
    updatePlayer.run(
      Math.max(0, player.stardust),
      player.level,
      player.xp,
      player.base_luck,
      player.shield,
      player.last_daily,
      player.username
    );
  }

  // ── Rate-limit helpers ────────────────────────────────────────────────────

  checkRateLimit(sender, rateLimitConfig) {
    if (!canUseCommand(sender, rateLimitConfig)) {
      if (canSendWarning()) {
        this.sendMessage(
          this.template.prepareMessage(this.config.messages.rateLimitWarning, { username: sender })
        );
      }
      return false;
    }
    return true;
  }

  // ── Progression helper ────────────────────────────────────────────────────

  /**
   * Add XP, check level-up, optionally append level-up text to a message.
   * @param {{ xp: number, level: number }} player
   * @param {number} xpAmount
   * @param {string} baseMessage
   * @returns {string} baseMessage, possibly with level-up suffix appended
   */
  applyXPAndFormat(player, xpAmount, baseMessage) {
    const { leveled, newLevel, perksUnlocked } = this.progression.addXP(player, xpAmount);
    if (leveled) {
      baseMessage += this.template.formatLevelUp(newLevel, perksUnlocked);
    }
    return baseMessage;
  }

  // ── Command: !spin ────────────────────────────────────────────────────────

  async handleSpinCommand(sender, parts) {
    if (!this.checkRateLimit(sender, this.config.rateLimit)) return;

    const bet = parseInt(parts[1], 10);

    if (!parts[1] || isNaN(bet) || bet <= 0) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.spinBetTooLow, {
          username: sender, minBet: this.config.minBet
        })
      );
      return;
    }

    const player = this.getOrCreatePlayer(sender);
    const result = this.slotsService.spin(player, bet);

    if (result.error === 'bet_too_low') {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.spinBetTooLow, {
          username: sender, minBet: this.config.minBet
        })
      );
      return;
    }

    if (result.error === 'bet_too_high') {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.spinBetTooHigh, {
          username: sender, maxBet: this.config.maxBet
        })
      );
      return;
    }

    if (result.error === 'no_funds') {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.spinNoFunds, {
          username: sender, balance: player.stardust, bet
        })
      );
      return;
    }

    let msg;
    if (result.win > 0) {
      msg = this.template.formatSpinWin({
        username: sender,
        emoji:    result.emoji,
        label:    result.label,
        bet:      result.bet,
        win:      result.win,
        balance:  player.stardust,
        xp:       result.xp
      });
    } else {
      msg = this.template.formatSpinLose({
        username: sender,
        emoji:    result.emoji,
        bet:      result.bet,
        balance:  player.stardust,
        xp:       result.xp
      });
    }

    msg = this.applyXPAndFormat(player, result.xp, msg);
    this.savePlayer(player);
    await this.sendMessage(msg);
  }

  // ── Command: !duel ────────────────────────────────────────────────────────

  async handleDuelCommand(sender, parts) {
    if (!this.checkRateLimit(sender, this.config.duelRateLimit)) return;

    const targetRaw = parts[1];
    const bet       = parseInt(parts[2], 10);

    if (!targetRaw || isNaN(bet) || bet <= 0) return;

    const target = normalizeUsername(
      targetRaw.startsWith('@') ? targetRaw.slice(1) : targetRaw
    );
    if (!target) return;

    if (target === sender) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelSelf, { sender })
      );
      return;
    }

    const challenger = this.getOrCreatePlayer(sender);
    if (!this.pvpService.canAfford(challenger, bet)) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelNoFunds, { sender, bet })
      );
      return;
    }

    const targetPlayer = this.getOrCreatePlayer(target);
    if (!this.pvpService.canAfford(targetPlayer, bet)) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelTargetNoFunds, { sender, target, bet })
      );
      return;
    }

    this.pvpService.createChallenge(sender, target, bet);

    await this.sendMessage(
      this.template.prepareMessage(this.config.messages.duelChallenge, { sender, target, bet })
    );

    // Auto-expire: notify chat if target never responds
    setTimeout(async () => {
      const pending = this.pvpService.getPendingDuel(target);
      if (pending && pending.challenger === sender) {
        this.pvpService.clearDuel(target);
        await this.sendMessage(
          this.template.prepareMessage(this.config.messages.duelExpired, { sender, target })
        );
      }
    }, this.config.duelExpiryMs);
  }

  // ── Command: !accept ──────────────────────────────────────────────────────

  async handleDuelAccept(accepter) {
    const pending = this.pvpService.getPendingDuel(accepter);
    if (!pending) return;

    this.pvpService.clearDuel(accepter);

    const p1 = this.getOrCreatePlayer(pending.challenger);
    const p2 = this.getOrCreatePlayer(accepter);
    const bet = pending.bet;

    // Re-validate funds (time may have passed)
    if (!this.pvpService.canAfford(p1, bet)) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelNoFunds, {
          sender: pending.challenger, bet
        })
      );
      return;
    }

    if (!this.pvpService.canAfford(p2, bet)) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelTargetNoFunds, {
          sender: pending.challenger, target: accepter, bet
        })
      );
      return;
    }

    const result = this.pvpService.resolveDuel(p1, p2, bet);

    if (result.blocked) {
      this.savePlayer(p2);
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.duelBlocked, {
          target: result.shieldHolder,
          sender: result.attacker
        })
      );
      return;
    }

    // Award XP to winner
    const winnerObj = result.winner === p1.username ? p1 : p2;
    let msg = this.template.prepareMessage(this.config.messages.duelWin, {
      winner:  result.winner,
      loser:   result.loser,
      bet,
      balance: result.winnerBalance,
      xp:      result.xp
    });

    msg = this.applyXPAndFormat(winnerObj, result.xp, msg);

    this.savePlayer(p1);
    this.savePlayer(p2);
    await this.sendMessage(msg);
  }

  // ── Command: !decline ─────────────────────────────────────────────────────

  async handleDuelDecline(decliner) {
    const pending = this.pvpService.getPendingDuel(decliner);
    if (!pending) return;

    this.pvpService.clearDuel(decliner);

    await this.sendMessage(
      this.template.prepareMessage(this.config.messages.duelDeclined, {
        target: decliner,
        sender: pending.challenger
      })
    );
  }

  // ── Command: !box ─────────────────────────────────────────────────────────

  async handleBoxCommand(sender) {
    if (!this.checkRateLimit(sender, this.config.boxRateLimit)) return;

    const player = this.getOrCreatePlayer(sender);
    const result = this.boxService.openBox(player);

    if (result.error === 'no_funds') {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.boxNoFunds, {
          username: sender, cost: result.cost
        })
      );
      return;
    }

    // Special outcome overrides for luck_boost and shield (need different message keys)
    if (result.type === 'luck_boost') {
      this.savePlayer(player);
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.boxLuckBoost, {
          username: sender, baseLuck: player.base_luck.toFixed(2)
        })
      );
      return;
    }

    if (result.type === 'shield') {
      this.savePlayer(player);
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.boxShield, { username: sender })
      );
      return;
    }

    this.progression.addXP(player, 15);
    this.savePlayer(player);

    await this.sendMessage(
      this.template.prepareMessage(this.config.messages.boxResult, {
        username: sender,
        emoji:    result.emoji,
        result:   result.label,
        balance:  player.stardust
      })
    );
  }

  // ── Command: !balance ─────────────────────────────────────────────────────

  async handleBalanceCommand(sender) {
    const player = this.getOrCreatePlayer(sender);
    await this.sendMessage(this.template.formatBalance(player));
  }

  // ── Command: !ctop ────────────────────────────────────────────────────────

  async handleTopCommand() {
    const rows = getTopByStardust.all();

    if (!rows || rows.length === 0) {
      await this.sendMessage(this.config.messages.noPlayers);
      return;
    }

    await this.sendMessage(this.template.formatLeaderboard(rows));
  }

  // ── Command: !perks ───────────────────────────────────────────────────────

  async handlePerksCommand(sender) {
    const player = this.getOrCreatePlayer(sender);
    await this.sendMessage(this.template.formatPerks(player));
  }

  // ── Command: !daily ───────────────────────────────────────────────────────

  async handleDailyCommand(sender) {
    const player = this.getOrCreatePlayer(sender);
    const now = Date.now();
    const nextAvailableAt = player.last_daily + this.config.dailyCooldownMs;

    if (now < nextAvailableAt) {
      await this.sendMessage(
        this.template.formatDailyCooldown({
          username:    sender,
          remainingMs: nextAvailableAt - now
        })
      );
      return;
    }

    const { min, max } = this.config.dailyReward;
    let amount = Math.floor(min + Math.random() * (max - min + 1));

    // Level 15 perk: extra daily bonus
    if (player.level >= 15 && this.config.levelPerks[15]?.dailyBonus) {
      amount += this.config.levelPerks[15].dailyBonus;
    }

    player.stardust   += amount;
    player.last_daily  = now;

    this.progression.addXP(player, 10);
    this.savePlayer(player);

    await this.sendMessage(
      this.template.formatDailyReward({ username: sender, amount, balance: player.stardust })
    );
  }

  // ── Command: !shield ──────────────────────────────────────────────────────

  async handleShieldCommand(sender) {
    const player = this.getOrCreatePlayer(sender);

    if (player.level < 10) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.shieldLevelRequired, {
          username: sender, level: player.level
        })
      );
      return;
    }

    if (player.shield) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.shieldAlreadyActive, { username: sender })
      );
      return;
    }

    if (player.stardust < this.config.shieldCost) {
      await this.sendMessage(
        this.template.prepareMessage(this.config.messages.shieldNoFunds, {
          username: sender, cost: this.config.shieldCost
        })
      );
      return;
    }

    player.stardust -= this.config.shieldCost;
    player.shield    = 1;
    this.savePlayer(player);

    await this.sendMessage(
      this.template.prepareMessage(this.config.messages.shieldBought, {
        username: sender,
        cost:     this.config.shieldCost,
        balance:  player.stardust
      })
    );
  }

  // ── Bot message throttle ──────────────────────────────────────────────────

  canBotSpeak() {
    const now = Date.now();
    const { windowMs, maxMessages } = this.config.botMessages;

    while (this.botMessageTimes.length && now - this.botMessageTimes[0] > windowMs) {
      this.botMessageTimes.shift();
    }

    if (this.botMessageTimes.length >= maxMessages) return false;

    this.botMessageTimes.push(now);
    return true;
  }

  async sendMessage(message) {
    if (!message || typeof message !== 'string') {
      logger.warn('CosmosGame: attempted to send invalid message', { message });
      return;
    }

    if (!this.canBotSpeak()) return;

    try {
      await this.messageService.sendTwitchMessage(message);
    } catch (error) {
      logger.error('CosmosGame: failed to send message', { error, message });
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  setEnabled(enabled) {
    setCosmosEnabled(Boolean(enabled));
    logger.info('CosmosGame enabled state changed', { enabled });
  }

  getState() {
    return {
      isRunning:        this.isRunning,
      enabled:          cosmosEnabled,
      gameId:           this.gameId,
      botMessageCount:  this.botMessageTimes.length,
      pendingDuels:     this.pvpService.pendingDuels.size
    };
  }

  async connect() {
    if (this.isRunning) {
      logger.warn('CosmosGame is already running');
      return;
    }

    logger.info('Connecting CosmosGame to TwitchChatMonitor...');

    await this.chatMonitor.registerGame(this.gameId, {
      onConnect:    this.handleConnect,
      onDisconnect: this.handleDisconnect,
      onChatMessage: this.handleChatMessage
    });

    this.isRunning = true;
    logger.info('CosmosGame registered and running');
  }

  async stop() {
    if (!this.isRunning) return;

    logger.info('Stopping CosmosGame...');
    this.isRunning = false;

    if (this.chatMonitor) {
      this.chatMonitor.unregisterGame(this.gameId);
    }

    logger.info('CosmosGame stopped');
  }
}

export default CosmosGames;
