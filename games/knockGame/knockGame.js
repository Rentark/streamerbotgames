import logger from '../../utils/logger.js';
import { MessageService } from '../../services/MessageService.js';
import { TwitchChatMonitor } from '../../services/TwitchChatMonitor.js';
import { HttpControlService } from '../../services/HttpControlService.js';
import { KnockMessageTemplate } from '../../utils/messageTemplates/KnockMessageTemplate.js';
import { 
  getUserId, 
  normalizeUsername, 
  canUseKnock, 
  canSendWarning,
  setKnockEnabled,
  knockEnabled
} from './state.js';
import { incKnock, topKnockers } from '../../db/queries.js';
import { gameConfigKnock } from '../gameConfig.js';
import { httpControl } from '../../config/config.js';
import { RewardService } from '../../services/RewardService.js';

/**
 * KnockGame - A Twitch chat game where users can knock themselves or others
 * 
 * Features:
 * - Rate limiting for knock commands
 * - Bot message throttling
 * - HTTP control API for enabling/disabling
 * - Top knockers leaderboard
 */
class KnockGame {
  constructor(config = gameConfigKnock, options = {}) {
    this.config = config;
    this.gameId = `knockgame-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning = false;
    this.startHttpServer = options.startHttpServer !== false; // Default to true
    
    // Bot message throttling
    this.botMessageTimes = [];
    
    // Initialize services
    this.rewardService = new RewardService(config);
    this.messageService = new MessageService();
    this.chatMonitor = TwitchChatMonitor.getInstance();
    this.httpControl = new HttpControlService(httpControl);
    this.KnockMessageTemplate = new KnockMessageTemplate(config);
    
    // Bind methods
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  /**
   * Handle connection to Streamer.bot
   */
  handleConnect = async () => {
    logger.info('KnockGame connected to Streamer.bot via TwitchChatMonitor');
    this.client = this.chatMonitor.getClient();
    if (this.client) {
      this.messageService.setClient(this.client);
    }
  }

  /**
   * Handle disconnection from Streamer.bot
   */
  handleDisconnect = async () => {
    logger.info('KnockGame disconnected from Streamer.bot');
  }

  /**
   * Handle incoming chat messages
   */
  handleChatMessage = async ({ message, username, rawData }) => {
    if (!message || !username) {
      return;
    }

    const parts = message.trim().split(/\s+/);
    const command = parts[0].toLowerCase().trim();

    try {
      if (this.config.commands.knock.includes(command)) {
        await this.handleKnockCommand(username, parts);
      } else if (this.config.commands.knockTop.includes(command)) {
        await this.handleKnockTopCommand();
      }
    } catch (error) {
      logger.error('Error handling chat message', { error, command, username });
    }
  }

  /**
   * Handle !knock command
   */
  async handleKnockCommand(sender, parts) {
    if (!knockEnabled) {
      logger.debug('Knock command ignored - game disabled');
      return;
    }

    const senderNormalized = normalizeUsername(sender);
    if (!senderNormalized) {
      logger.warn('Invalid sender username', { sender });
      return;
    }

    try {
      const senderId = getUserId(senderNormalized);

      // Check rate limit (uses config from state.js defaults, or instance config if provided)
      const rateLimitConfig = this.config.rateLimit;
      if (!canUseKnock(senderId, rateLimitConfig)) {
        // Use global warning rate limit (not per-user) to prevent bot spam
        const warningRateLimitConfig = this.config.warningRateLimit;
        if (canSendWarning(warningRateLimitConfig)) {
          const warningMessage = this.KnockMessageTemplate.prepareMessage(
            this.config.messages.rateLimitWarning,
            { sender }
          );
          await this.sendMessage(warningMessage);
        }
        return;
      }

      // Determine target (default to self)
      let targetName = senderNormalized;
      if (parts[1]?.startsWith('@')) {
        targetName = normalizeUsername(parts[1].slice(1));
      }

      if (!targetName) {
        logger.warn('Invalid target username', { target: parts[1] });
        return;
      }

      let starsAmount = this.rewardService.generateRandomReward();

          // Only process commands (messages starting with !)
    if (targetName.endsWith("_cat") && sender !== targetName)  {
      let onMarseilleKnock = [
        `/me @${sender}, moonos1Cry ти справді хотів забрати в котика зірочки? moonos1Cry `,
        `/me @${sender}, moonos1Slay кітик - боже створіння, нетикабельне moonos1Slay `,
        `/me @${sender}, moonos1Cute май бога в серці - котика тикаєш! moonos1Cute `,
        `/me @${sender}, moonos1Salto кітик ухиляється від тику! moonos1Salto `,
      ]
      let responseMessage = onMarseilleKnock[Math.floor(Math.random() * onMarseilleKnock.length)];
      if (this.rewardService.randomizer(0, 1, true) === 1) {
        responseMessage += `Кітик кусає у відповідь! Відкушено ${starsAmount} зіроч${this.rewardService.getRewardTypeEnd(starsAmount)}!  moonos1Eat `;
        let targetReward = await this.messageService.setStreamElementsReward(targetName, starsAmount);
        await this.messageService.setStreamElementsReward(sender, -starsAmount);
        if (!targetReward.success) {
          logger.info('Failed to set StreamElements reward', { targetReward });
          responseMessage = this.KnockMessageTemplate.prepareMessage(this.config.messages.rewardFailMessage, { statusCode: targetReward.response.statusCode });
          await this.sendMessage(responseMessage);
          return;
        }
      }
       
      await this.sendMessage(responseMessage);

      return;
    }

      const targetId = getUserId(targetName);
      /** @type {{ count: number } | undefined} */
      const result = /** @type {{ count: number } | undefined} */ (incKnock.get(senderId, targetId, starsAmount, Date.now()));

      if (!result || result.count === undefined) {
        logger.error('Failed to get knock count from database', { senderId, targetId });
        return;
      }

      // Format response message using template
      let responseMessage = null;
      if (senderNormalized === targetName) {
        responseMessage = this.KnockMessageTemplate.formatKnockSelf({
          sender: sender,
          reward: starsAmount,
          count: result.count
        });
        let senderReward = await this.messageService.setStreamElementsReward(sender, starsAmount);
        if (!senderReward.success) {
          responseMessage = this.KnockMessageTemplate.prepareMessage(this.config.messages.rewardFailMessage, { statusCode: senderReward.response.statusCode });
          await this.sendMessage(responseMessage);
          return;
        }

      } else {
        responseMessage = this.KnockMessageTemplate.formatKnockOther({
          sender: sender,
          target: targetName,
          reward: starsAmount,
          count: result.count
        });
        let senderReward = await this.messageService.setStreamElementsReward(sender, starsAmount);
        await this.messageService.setStreamElementsReward(targetName, -starsAmount);
        if (!senderReward.success) {
          responseMessage = this.KnockMessageTemplate.prepareMessage(this.config.messages.rewardFailMessage, { statusCode: senderReward.response.statusCode });
          await this.sendMessage(responseMessage);
          return;
        }
      }   

      await this.sendMessage(responseMessage);
      
      // logger.info('Knock recorded', { 
      //   sender: senderNormalized, 
      //   target: targetName, 
      //   count: result.count 
      // });
    } catch (error) {
      logger.error('Error processing knock command', { error, sender });
    }
  }

  /**
   * Handle !knocktop command
   */
  async handleKnockTopCommand() {
    if (!knockEnabled) {
      logger.debug('Knock command ignored - game disabled');
      return;
    }

    try {
      /** @type {Array<{ username: string, count: number, stars: number }>} */
      const rows = /** @type {Array<{ username: string, count: number, stars: number }>} */ (topKnockers.all());
      
      if (!rows || rows.length === 0) {
        const noKnocksMessage = this.KnockMessageTemplate.prepareMessage(
          this.config.messages.noKnocks,
          {}
        );
        await this.sendMessage(noKnocksMessage);
        return;
      }

      const leaderboard = rows
        .map((r, i) => `${i + 1}. ${r.username} (${r.count}) (${r.stars})`)
        .join(' | ');

      const leaderboardMessage = this.KnockMessageTemplate.prepareMessage(
        this.config.messages.leaderboard,
        { leaderboard }
      );
      await this.sendMessage(leaderboardMessage);
      
      // logger.debug('Knock top leaderboard displayed', { rows });
    } catch (error) {
      logger.error('Error processing knocktop command', { error });
    }
  }

  /**
   * Check if bot can send a message (throttling)
   * @returns {boolean} True if bot can speak
   */
  canBotSpeak() {
    const now = Date.now();
    const { windowMs, maxMessages } = this.config.botMessages;

    // Remove old timestamps outside the window
    while (this.botMessageTimes.length && now - this.botMessageTimes[0] > windowMs) {
      this.botMessageTimes.shift();
    }

    // Check if we've exceeded the limit
    if (this.botMessageTimes.length >= maxMessages) {
      // logger.debug('Bot message rate limit exceeded', { 
      //   count: this.botMessageTimes.length, 
      //   max: maxMessages 
      // });
      return false;
    }

    // Add current timestamp
    this.botMessageTimes.push(now);
    return true;
  }

  /**
   * Send a message to Twitch chat (with throttling)
   * @param {string} message - Message to send
   */
  async sendMessage(message) {
    if (!message || typeof message !== 'string') {
      logger.warn('Attempted to send invalid message', { message });
      return;
    }

    if (!this.canBotSpeak()) {
      // logger.debug('Message throttled', { message });
      return;
    }

    try {
      await this.messageService.sendTwitchMessage(message);
    } catch (error) {
      logger.error('Failed to send message', { error, message });
    }
  }

  /**
   * Enable or disable the knock game
   * @param {boolean} enabled - Whether to enable the game
   */
  setEnabled(enabled) {
    setKnockEnabled(enabled);
    logger.info('Knock game enabled state changed', { enabled });
  }

  /**
   * Get current game state
   * @returns {Object} Game state information
   */
  getState() {
    return {
      isRunning: this.isRunning,
      enabled: knockEnabled,
      gameId: this.gameId,
      botMessageCount: this.botMessageTimes.length
    };
  }

  /**
   * Connect to Streamer.bot and start monitoring chat
   */
  async connect() {
    if (this.isRunning) {
      logger.warn('KnockGame is already running');
      return;
    }

    logger.info('Connecting KnockGame to TwitchChatMonitor...');
    
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect: this.handleConnect,
      onDisconnect: this.handleDisconnect,
      onChatMessage: this.handleChatMessage
    });

    // Register with HTTP control service
    this.httpControl.registerGame(this.gameId, {
      setEnabled: (enabled) => this.setEnabled(enabled),
      getState: () => this.getState()
    });

    // Start HTTP control server only if enabled
    if (this.startHttpServer) {
      this.httpControl.start();
    }

    this.isRunning = true;
    logger.info('KnockGame registered and running');
  }

  /**
   * Stop the game and unregister from monitor
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping KnockGame...');
    this.isRunning = false;
    
    if (this.chatMonitor) {
      this.chatMonitor.unregisterGame(this.gameId);
    }

    if (this.httpControl) {
      this.httpControl.unregisterGame(this.gameId);
      this.httpControl.stop();
    }
    
    logger.info('KnockGame stopped');
  }
}

export default KnockGame;
