import logger from '../../utils/logger.js';
import { gameConfigStarfall }   from '../gameConfig.js';
import { MessageService }       from '../../services/MessageService.js';
import { RewardService }        from '../../services/RewardService.js';
import { ParticipantManager }   from '../../managers/ParticipantManager.js';
import { GameTimer }            from '../../utils/GameTimer.js';
import { StarfallMessageTemplate } from '../../utils/messageTemplates/StarfallMessageTemplate.js';
import { TwitchChatMonitor }    from '../../services/TwitchChatMonitor.js';
import { CommandBus }           from '../../services/CommandBus.js';
import {
  safeExecutionMiddleware,
  createGameEnabledMiddleware,
} from '../../services/middlewares/index.js';
import { starfallEnabled }      from '../gameState.js';
import { registerStarfallModule } from './starfallModule.js';

/**
 * StarfallGame
 * Timed loot-drop game. Players join by typing the join word.
 * Architecture: CommandBus + middleware pipeline.
 * Economy: StreamElements points (batch multi-winner reward).
 */
class StarfallGame {
  constructor(config = gameConfigStarfall) {
    this.config    = config;
    this.gameId    = `starfall-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning = false;
    this.gameState = {
      userCount: 0, winners: null, reward: 0, winnerCount: 0,
      currentGameLength: config.gameLength,
    };

    this.messageService    = new MessageService();
    this.rewardService     = new RewardService(config);
    this.participantManager = new ParticipantManager();
    this.gameTimer         = new GameTimer();
    this.template          = new StarfallMessageTemplate(config);
    this.chatMonitor       = TwitchChatMonitor.getInstance();

    this.commandBus = new CommandBus({
      middlewares: [
        safeExecutionMiddleware,
        createGameEnabledMiddleware(() => starfallEnabled && this.isRunning),
      ],
    });

    registerStarfallModule({
      bus: this.commandBus,
      config,
      services: {
        participantManager: this.participantManager,
        messageService:     this.messageService,
        config,
      },
    });

    this.handleConnect     = this.handleConnect.bind(this);
    this.handleDisconnect  = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  handleConnect = async () => {
    logger.info('StarfallGame connected to Streamer.bot via TwitchChatMonitor');
    this.client = this.chatMonitor.getClient();
    if (this.client) this.messageService.setClient(this.client);
    try { await this.startGame(); }
    catch (error) { logger.error('Error during StarfallGame execution', error); }
  }

  handleDisconnect = async () => { logger.info('StarfallGame disconnected from Streamer.bot'); }

  handleChatMessage = async ({ message, username }) => {
    if (!message || !username) return;

    const parts   = message.trim().split(/\s+/);
    const command = (parts[0] ?? '').toLowerCase().trim();

    const ctx = {
      user:    username.toLowerCase(),
      command,
      args:    parts.slice(1),
      rawMessage: message,
      reply:   (msg) => this.messageService.sendTwitchMessage(msg),
      services: {
        participantManager: this.participantManager,
        messageService:     this.messageService,
        config:             this.config,
      },
      logger,
    };

    await this.commandBus.execute(ctx);

    // Keep gameState.userCount in sync
    this.gameState.userCount = this.participantManager.getParticipantCount();
  }

  async prepareGame() {
    this.gameState.winnerCount = this.config.randomWinnerCount
      ? this.rewardService.getRandomWinnerCount()
      : this.config.maxWinners;
    this.gameState.reward          = this.rewardService.generateRandomReward();
    this.gameState.currentGameLength = this.config.gameLength;
  }

  async startGame() {
    if (this.isRunning) { logger.warn('StarfallGame already running'); return; }
    if (!starfallEnabled) { logger.warn('StarfallGame disabled'); return; }

    this.isRunning = true;
    await this.prepareGame();

    const startMsg = this.template.prepareMessage(this.config.gameStartMessage, {
      reward: this.gameState.reward,
      currentGameLength: this.gameState.currentGameLength,
      winnerCount: this.gameState.winnerCount,
    });
    await this.messageService.sendTwitchMessage(startMsg);
    await this.runGameLoop();
  }

  async runGameLoop() {
    for (const interval of this.config.gameEndNotifIntervals) {
      await this.gameTimer.wait(interval);
      this.gameState.currentGameLength -= interval;
      const notif = this.template.formatGameEndNotification(
        this.config.gameEndNotifMessage,
        this.gameState.reward,
        this.gameState.currentGameLength,
        this.gameState.winnerCount,
      );
      await this.messageService.sendTwitchMessage(notif);
    }

    await this.gameTimer.wait(this.gameState.currentGameLength);
    await this.endGame();
  }

  async endGame() {
    if (this.config.endingMessage.length !== 0) {
      await this.messageService.sendTwitchMessage(
        this.template.prepareMessage(this.config.endingMessage, { reward: this.gameState.reward })
      );
    }
    await this.decideWinner();
    await this.gameTimer.wait(1000);
    this.chatMonitor.unregisterGame(this.gameId);
    this.isRunning = false;
    logger.info('StarfallGame ended');
  }

  async decideWinner() {
    if (this.gameState.userCount === 0) {
      await this.messageService.sendTwitchMessage(
        this.template.prepareMessage(this.config.noJoinMessage)
      );
      return;
    }

    const winnerIds = this.participantManager.getWinners(this.gameState.winnerCount);
    this.gameState.winners = this.gameState.winnerCount === 1
      ? [this.participantManager.findUser(winnerIds[0])]
      : winnerIds.map(id => this.participantManager.findUser(id));

    const rewardPerWinner = Math.floor(this.gameState.reward / this.gameState.winners.length);
    const winnersWithRewards = this.gameState.winners.map(w => ({ username: w, current: rewardPerWinner }));

    const seResult = await this.messageService.setStreamElementsRewardMulti(winnersWithRewards);
    if (!seResult.success) {
      await this.messageService.sendTwitchMessage(
        this.template.prepareMessage(this.config.rewardFailMessage, { statusCode: seResult.response?.statusCode }, false)
      );
      return;
    }

    await this.messageService.sendTwitchMessage(
      this.template.formatWinners(this.gameState.winners, this.gameState.reward)
    );
  }

  async connect() {
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect:     this.handleConnect,
      onDisconnect:  this.handleDisconnect,
      onChatMessage: this.handleChatMessage,
    });
  }

  async stop() {
    this.isRunning = false;
    this.chatMonitor.unregisterGame(this.gameId);
  }
}

export default StarfallGame;
