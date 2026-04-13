import logger from '../../utils/logger.js';
import { MessageService }    from '../../services/MessageService.js';
import { TwitchChatMonitor } from '../../services/TwitchChatMonitor.js';
import { HttpControlService } from '../../services/HttpControlService.js';
import { CommandBus }        from '../../services/CommandBus.js';
import {
  safeExecutionMiddleware,
  loggingMiddleware,
  createGameEnabledMiddleware,
  createBotThrottleMiddleware,
} from '../../services/middlewares/index.js';
import { KnockMessageTemplate } from '../../utils/messageTemplates/KnockMessageTemplate.js';
import { RewardService }     from '../../services/RewardService.js';
import {
  getUserId, normalizeUsername,
  canUseKnock, canSendWarning,
  setKnockEnabled, knockEnabled,
} from './state.js';
import { gameConfigKnock }   from '../gameConfig.js';
import { httpControl }       from '../../config/config.js';
import { registerKnockModule } from './knockModule.js';

/**
 * KnockGame
 * Users type "тик" or "!тик" to knock themselves or others.
 * Architecture: CommandBus + middleware pipeline.
 * Economy: StreamElements points.
 */
class KnockGame {
  constructor(config = gameConfigKnock, options = {}) {
    this.config          = config;
    this.gameId          = `knockgame-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning       = false;
    this.startHttpServer = options.startHttpServer !== false;

    this._botMessageTimes = [];

    this.messageService = new MessageService();
    this.chatMonitor    = TwitchChatMonitor.getInstance();
    this.httpControl    = new HttpControlService(httpControl);
    this.rewardService  = new RewardService(config);
    this.template       = new KnockMessageTemplate(config);

    this.services = {
      messageService: this.messageService,
      rewardService:  this.rewardService,
      template:       this.template,
      config,
    };

    // Per-command rate limiting sits outside the middleware chain here because
    // KnockGame uses a sliding-window model (canUseKnock) rather than a simple cooldown.
    // The raw handleChatMessage guards it before dispatching to the bus.
    this.commandBus = new CommandBus({
      middlewares: [
        safeExecutionMiddleware,
        loggingMiddleware,
        createGameEnabledMiddleware(() => knockEnabled),
        createBotThrottleMiddleware(() => this._canBotSpeak()),
      ],
    });

    registerKnockModule({ bus: this.commandBus });

    this.handleConnect     = this.handleConnect.bind(this);
    this.handleDisconnect  = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  handleConnect = async () => {
    logger.info('KnockGame connected to Streamer.bot via TwitchChatMonitor');
    this.client = this.chatMonitor.getClient();
    if (this.client) this.messageService.setClient(this.client);
  }

  handleDisconnect = async () => {
    logger.info('KnockGame disconnected from Streamer.bot');
  }

  handleChatMessage = async ({ message, username }) => {
    if (!message || !username) return;

    const user    = normalizeUsername(username);
    if (!user) return;

    const parts   = message.trim().split(/\s+/);
    const command = parts[0].toLowerCase().trim();

    // Sliding-window rate limit (knock commands only)
    const isKnockCmd = this.config.commands.knock.includes(command);
    if (isKnockCmd) {
      const userId = getUserId(user);
      if (!canUseKnock(userId, this.config.rateLimit)) {
        if (canSendWarning(this.config.warningRateLimit)) {
          const msg = this.template.prepareMessage(this.config.messages.rateLimitWarning, { sender: username });
          await this._send(msg);
        }
        return;
      }
    }

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
      logger.error('KnockGame: failed to send message', { error, message });
    }
  }

  setEnabled(enabled) {
    setKnockEnabled(enabled);
    logger.info('Knock game enabled state changed', { enabled });
  }

  getState() {
    return {
      isRunning:       this.isRunning,
      enabled:         knockEnabled,
      gameId:          this.gameId,
      registeredCmds:  this.commandBus.listCommands(),
    };
  }

  async connect() {
    if (this.isRunning) { logger.warn('KnockGame already running'); return; }
    logger.info('Connecting KnockGame to TwitchChatMonitor...');
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect:     this.handleConnect,
      onDisconnect:  this.handleDisconnect,
      onChatMessage: this.handleChatMessage,
    });
    this.httpControl.registerGame(this.gameId, {
      setEnabled: (e) => this.setEnabled(e),
      getState:   () => this.getState(),
    });
    if (this.startHttpServer) this.httpControl.start();
    this.isRunning = true;
    logger.info('KnockGame registered and running');
  }

  async stop() {
    if (!this.isRunning) return;
    logger.info('Stopping KnockGame...');
    this.isRunning = false;
    this.chatMonitor.unregisterGame(this.gameId);
    this.httpControl.unregisterGame(this.gameId);
    this.httpControl.stop();
    logger.info('KnockGame stopped');
  }
}

export default KnockGame;
