// Starfall Game - Refactored Class-based Version
import logger from '../../utils/logger.js';
import { gameConfigStarfall } from '../gameConfig.js';
import { MessageService } from '../../services/MessageService.js';
import { RewardService } from '../../services/RewardService.js';
import { ParticipantManager } from '../../managers/ParticipantManager.js';
import { GameTimer } from '../../utils/GameTimer.js';
import { StarfallMessageTemplate } from '../../utils/messageTemplates/StarfallMessageTemplate.js';
import { TwitchChatMonitor } from '../../services/TwitchChatMonitor.js';
import { starfallEnabled } from '../gameState.js';

class StarfallGame {
  constructor(config = gameConfigStarfall) {
    this.config = config;
    this.isRunning = false;
    this.gameId = `starfall-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.gameState = {
      userCount: 0,
      winners: null,
      reward: 0,
      winnerCount: 0,
      currentGameLength: config.gameLength
    };

    // Initialize services and managers
    this.messageService = new MessageService();
    this.rewardService = new RewardService(config);
    this.participantManager = new ParticipantManager();
    this.gameTimer = new GameTimer();
    this.StarfallMessageTemplate = new StarfallMessageTemplate(config);

    // Get singleton instance of Twitch chat monitor
    this.chatMonitor = TwitchChatMonitor.getInstance();
  }

  handleConnect = async () => {
    logger.info("Connected to Streamer.bot via TwitchChatMonitor");
    // Cache client reference for this game instance and set in MessageService
    this.client = this.chatMonitor.getClient();
    if (this.client) {
      this.messageService.setClient(this.client);
    }
    try {
      await this.startGame();
    } catch (error) {
      logger.error("Error during game execution:", error);
    }
  }

  handleDisconnect = async () => {
    logger.info("Disconnected from Streamer.bot");
  }

  handleChatMessage = async ({ message, username }) => {
    if (message && message.toLowerCase().startsWith(this.config.gameJoinMessage)) {
      if (username === "gous_stickmen" && !this.participantManager.hasParticipant("gous_stickmen")) {
        await this.messageService.sendTwitchMessage(
          this.config.stickmenJoinMessage[Math.floor(Math.random() * this.config.stickmenJoinMessage.length)]
        );
      }
      
      this.participantManager.addParticipant(username);
      this.gameState.userCount = this.participantManager.getParticipantCount();
    }
  }

  async prepareGame() {
    this.gameState.winnerCount = this.config.randomWinnerCount
      ? this.rewardService.getRandomWinnerCount()
      : this.config.maxWinners;
    
    this.gameState.reward = this.rewardService.generateRandomReward();
    this.gameState.currentGameLength = this.config.gameLength;
    
    logger.info("Game prepared", { 
      winnerCount: this.gameState.winnerCount,
      reward: this.gameState.reward 
    });
  }

  async startGame() {
    if (this.isRunning) {
      logger.warn("Game is already running");
      return;
    }

    if (!starfallEnabled) {
      logger.warn("Starfall game is disabled, cannot start");
      return;
    }

    this.isRunning = true;
    logger.info("Starting Starfall game...");
    
    await this.prepareGame();
    
    const startMessage = this.StarfallMessageTemplate.prepareMessage(
      this.config.gameStartMessage, 
      { 
        reward: this.gameState.reward, 
        currentGameLength: this.gameState.currentGameLength,
        winnerCount: this.gameState.winnerCount 
      }
    );
    
    await this.messageService.sendTwitchMessage(startMessage);
    // logger.info("Waiting for players to join...");
    
    await this.runGameLoop();
  }

  async runGameLoop() {
    const intervals = this.config.gameEndNotifIntervals;
    
    for (const interval of intervals) {
      await this.gameTimer.wait(interval);
      this.gameState.currentGameLength -= interval;
      // logger.info("Current game length", { currentGameLength: this.gameState.currentGameLength });
      
      const notificationMessage = this.StarfallMessageTemplate.formatGameEndNotification(
        this.config.gameEndNotifMessage, 
        this.gameState.reward, 
        this.gameState.currentGameLength,
        this.gameState.winnerCount
      );
      
      await this.messageService.sendTwitchMessage(notificationMessage);
    }

    // const remainingTime = this.gameState.currentGameLength - 
    //   intervals.reduce((acc, interval) => acc + interval, 0);
    // logger.info("Remaining time", { remainingTime });
    logger.info("Waiting before ending...");
    await this.gameTimer.wait(this.gameState.currentGameLength);

    await this.endGame();
  }

  async endGame() {
    if (this.config.endingMessage.length !== 0) {
      const endMessage = this.StarfallMessageTemplate.prepareMessage(this.config.endingMessage, {
        reward: this.gameState.reward
      });
      await this.messageService.sendTwitchMessage(endMessage);
    }
    
    await this.decideWinner();
    
    // logger.info("Waiting 1 second before unregistering...");
    await this.gameTimer.wait(1000);
    
    // Unregister this game from the monitor (but don't disconnect if other games are running)
    this.chatMonitor.unregisterGame(this.gameId);
    this.isRunning = false;
    logger.info("Game ended and unregistered from monitor.");
  }

  async decideWinner() {
    if (this.gameState.userCount === 0) {
      logger.info("No one joined!");
      const noJoinMessage = this.StarfallMessageTemplate.prepareMessage(this.config.noJoinMessage);
      await this.messageService.sendTwitchMessage(noJoinMessage);
      return;
    }

    const winnerIds = this.participantManager.getWinners(this.gameState.winnerCount);
    // logger.info("Winner IDs selected", { winnerIds });
    
    this.gameState.winners = this.gameState.winnerCount === 1
      ? [this.participantManager.findUser(winnerIds)]
      : winnerIds.map(id => this.participantManager.findUser(id));
    
    logger.info("Winners selected", { winners: this.gameState.winners });

    const winnerMessage = this.StarfallMessageTemplate.formatWinners(
      this.gameState.winners, 
      this.gameState.reward
    );
    
    // await this.messageService.setTwitchReward(winnerMessage, this.client);
    
    const rewardPerWinner = Math.floor(this.gameState.reward / this.gameState.winners.length);
    const winnersWithRewards = this.gameState.winners.map(winner => ({
      username: winner,
      current: rewardPerWinner
    }));
    
    let starfallReward = await this.messageService.setStreamElementsRewardMulti(winnersWithRewards);
    if (!starfallReward.success) {
      this.messageService.sendTwitchMessage(this.StarfallMessageTemplate.prepareMessage(this.config.rewardFailMessage, { statusCode: starfallReward.response.statusCode }, false));
      return;
    }
    await this.messageService.sendTwitchMessage(winnerMessage);
  }

  async stop() {
    this.isRunning = false;
    if (this.chatMonitor) {
      // Unregister this game (monitor will handle disconnection if no games remain)
      this.chatMonitor.unregisterGame(this.gameId);
    }
  }

  /**
   * Connect to Streamer.bot and start monitoring chat
   * Registers this game instance with the singleton monitor
   */
  async connect() {
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect: this.handleConnect.bind(this),
      onDisconnect: this.handleDisconnect.bind(this),
      onChatMessage: this.handleChatMessage.bind(this)
    });
  }
}

export default StarfallGame;
