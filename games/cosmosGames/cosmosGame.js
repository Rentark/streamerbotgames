import logger from '../../utils/logger.js';
import { MessageService }      from '../../services/MessageService.js';
import { TwitchChatMonitor }   from '../../services/TwitchChatMonitor.js';
import { CommandBus }          from '../../services/CommandBus.js';
import {
  safeExecutionMiddleware,
  loggingMiddleware,
  cooldownMiddleware,
  createGameEnabledMiddleware,
  createBotThrottleMiddleware,
} from '../../services/middlewares/index.js';
import { SlotsService }        from '../../services/cosmos/SlotsService.js';
import { DiceService }         from '../../services/cosmos/DiceService.js';
import { PvpService }          from '../../services/cosmos/PvpService.js';
import { MysteryBoxService }   from '../../services/cosmos/MysteryBoxService.js';
import { ProgressionService }  from '../../services/cosmos/ProgressionService.js';
import { LuckService }         from '../../services/cosmos/LuckService.js';
import { CosmosMessageTemplate } from '../../utils/messageTemplates/CosmosMessageTemplate.js';
import { getPlayer, createPlayer, updatePlayer } from '../../db/queries.js';
import { registerCosmosModule } from './cosmosModule.js';
import gameConfigCosmos         from './cosmosConfig.js';
import { cosmosEnabled, setCosmosEnabled, normalizeUsername } from './state.js';

// Ensure cosmos tables exist
import '../../db/db.js';

/**
 * CosmosGame
 * Space-themed Twitch chat casino.
 * Economy: StreamElements points (SE API).
 * Progression: level, XP, luck, shield, daily — SQLite.
 * Architecture: CommandBus + middleware pipeline.
 */
class CosmosGame {
  constructor(config = gameConfigCosmos, options = {}) {
    this.config      = config;
    this.gameId      = `cosmos-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning   = false;

    // Bot message throttle (shared across all replies via middleware)
    this._botMessageTimes = [];

    // Track chatters seen in the last chaosConfig.recentWindowMs for chaos box outcome
    // Map<username, lastSeenAt>
    this.recentChatters = new Map();

    // ── Services ──────────────────────────────────────────────────────────────
    this.messageService = new MessageService();
    this.chatMonitor    = TwitchChatMonitor.getInstance();
    this.slotsService   = new SlotsService(config);
    this.diceService    = new DiceService(config);
    this.pvpService     = new PvpService(config);
    this.boxService     = new MysteryBoxService(config);
    this.progression    = new ProgressionService(config);
    this.luckService    = new LuckService(config);
    this.template       = new CosmosMessageTemplate(config);

    /** Shared services object injected into every ctx */
    this.services = {
      messageService: this.messageService,
      slotsService:   this.slotsService,
      diceService:    this.diceService,
      pvpService:     this.pvpService,
      boxService:     this.boxService,
      progression:    this.progression,
      luckService:    this.luckService,
      template:       this.template,
      config,
      recentChatters: this.recentChatters,
      db: {
        getOrCreate: (username) => {
          createPlayer.run(username, Date.now());
          return { ...getPlayer.get(username), username };
        },
        save: (player) => {
          updatePlayer.run(
            0, // stardust unused — SE is source of truth
            player.level,
            player.xp,
            player.base_luck,
            player.shield,
            player.last_daily,
            player.username
          );
        },
      },
    };

    // ── CommandBus ────────────────────────────────────────────────────────────
    this.commandBus = new CommandBus({
      middlewares: [
        safeExecutionMiddleware,
        loggingMiddleware,
        createGameEnabledMiddleware(() => cosmosEnabled),
        createBotThrottleMiddleware(() => this._canBotSpeak()),
        cooldownMiddleware,
      ],
    });

    registerCosmosModule({ bus: this.commandBus, config });

    // Bind callbacks
    this.handleConnect     = this.handleConnect.bind(this);
    this.handleDisconnect  = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  // ── TwitchChatMonitor callbacks ───────────────────────────────────────────

  handleConnect = async () => {
    logger.info('CosmosGame connected to Streamer.bot');
    this.client = this.chatMonitor.getClient();
    if (this.client) this.messageService.setClient(this.client);
  }

  handleDisconnect = async () => {
    logger.info('CosmosGame disconnected from Streamer.bot');
  }

  handleChatMessage = async ({ message, username }) => {
    if (!message || !username) return;

    const user = normalizeUsername(username);
    if (!user) return;

    // Always update recent-chatters map (needed by chaos box outcome)
    this.recentChatters.set(user, Date.now());
    this._pruneRecentChatters();

    const parts   = message.trim().split(/\s+/);
    const command = parts[0].toLowerCase().trim();

    const ctx = {
      user,
      command,
      args:       parts.slice(1),
      rawMessage: message,
      reply:      (msg) => this._send(msg),
      services:   this.services,
      logger,
    };

    await this.commandBus.execute(ctx);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  _canBotSpeak() {
    const now = Date.now();
    const { windowMs, maxMessages } = this.config.botMessages;

    while (this._botMessageTimes.length && now - this._botMessageTimes[0] > windowMs) {
      this._botMessageTimes.shift();
    }
    if (this._botMessageTimes.length >= maxMessages) return false;
    this._botMessageTimes.push(now);
    return true;
  }

  async _send(message) {
    if (!message || typeof message !== 'string') return;
    try {
      await this.messageService.sendTwitchMessage(message);
    } catch (error) {
      logger.error('CosmosGame: failed to send message', { error, message });
    }
  }

  _pruneRecentChatters() {
    const cutoff = Date.now() - this.config.mysteryBox.chaosConfig.recentWindowMs;
    for (const [user, ts] of this.recentChatters.entries()) {
      if (ts < cutoff) this.recentChatters.delete(user);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  setEnabled(enabled) {
    setCosmosEnabled(Boolean(enabled));
    logger.info('CosmosGame enabled state changed', { enabled });
  }

  getState() {
    return {
      isRunning:       this.isRunning,
      enabled:         cosmosEnabled,
      gameId:          this.gameId,
      pendingDuels:    this.pvpService.pendingDuels.size,
      recentChatters:  this.recentChatters.size,
      registeredCmds:  this.commandBus.listCommands(),
    };
  }

  async connect() {
    if (this.isRunning) { logger.warn('CosmosGame already running'); return; }

    logger.info('Connecting CosmosGame to TwitchChatMonitor...');
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect:     this.handleConnect,
      onDisconnect:  this.handleDisconnect,
      onChatMessage: this.handleChatMessage,
    });
    this.isRunning = true;
    logger.info('CosmosGame registered and running');
  }

  async stop() {
    if (!this.isRunning) return;
    logger.info('Stopping CosmosGame...');
    this.isRunning = false;
    this.chatMonitor.unregisterGame(this.gameId);
    logger.info('CosmosGame stopped');
  }
}

export default CosmosGame;
