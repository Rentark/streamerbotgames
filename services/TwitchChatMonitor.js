import { StreamerbotClient } from '@streamerbot/client';
import logger from '../utils/logger.js';

/**
 * TwitchChatMonitor - Singleton service for handling Streamer.bot client connection and Twitch chat message monitoring
 * 
 * Why Singleton?
 * - Single WebSocket connection to Streamer.bot (more efficient)
 * - Reduced memory footprint (one client instance instead of multiple)
 * - Better resource management (single connection pool)
 * - Prevents connection conflicts when multiple games run simultaneously
 * 
 * This service can be reused across different games that need to monitor Twitch chat.
 * Each game registers its callbacks and receives messages through the shared connection.
 */
export class TwitchChatMonitor {
  constructor() {
    // Private constructor to enforce singleton pattern
    if (TwitchChatMonitor.instance) {
      return TwitchChatMonitor.instance;
    }

    this.host = '127.0.0.1';
    this.port = 8080;
    this.endpoint = '/';
    
    // Registry of games and their callbacks
    // Map<gameId, { onConnect, onDisconnect, onChatMessage }>
    this.gameCallbacks = new Map();
    
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
    
    TwitchChatMonitor.instance = this;
  }

  /**
   * Get the singleton instance
   */
  static getInstance() {
    if (!TwitchChatMonitor.instance) {
      TwitchChatMonitor.instance = new TwitchChatMonitor();
    }
    return TwitchChatMonitor.instance;
  }

  /**
   * Configure connection settings (optional, defaults are usually fine)
   */
  configure(options = {}) {
    if (this.isConnected) {
      logger.warn('Cannot configure TwitchChatMonitor while connected');
      return;
    }
    
    this.host = options.host || this.host;
    this.port = options.port || this.port;
    this.endpoint = options.endpoint || this.endpoint;
  }

  /**
   * Register a game with its callbacks
   * @param {string} gameId - Unique identifier for the game
   * @param {Object} callbacks - { onConnect, onDisconnect, onChatMessage }
   * @returns {Promise<void>}
   */
  async registerGame(gameId, callbacks = {}) {
    if (!gameId) {
      throw new Error('Game ID is required for registration');
    }

    logger.info(`Registering game: ${gameId}`);
    
    // Store callbacks for this game
    this.gameCallbacks.set(gameId, {
      onConnect: callbacks.onConnect || null,
      onDisconnect: callbacks.onDisconnect || null,
      onChatMessage: callbacks.onChatMessage || null
    });

    // Connect if not already connected
    if (!this.isConnected && !this.connectionPromise) {
      await this.connect();
    } else if (this.connectionPromise) {
      // Wait for existing connection attempt to complete
      await this.connectionPromise;
    }

    // If already connected, notify the new game
    if (this.isConnected && callbacks.onConnect) {
      try {
        await callbacks.onConnect();
      } catch (error) {
        logger.error(`Error in onConnect callback for game ${gameId}`, { error });
      }
    }
  }

  /**
   * Unregister a game and its callbacks
   * @param {string} gameId - Unique identifier for the game
   */
  unregisterGame(gameId) {
    if (!gameId) {
      return;
    }

    logger.info(`Unregistering game: ${gameId}`);
    
    const callbacks = this.gameCallbacks.get(gameId);
    if (callbacks && callbacks.onDisconnect) {
      try {
        callbacks.onDisconnect();
      } catch (error) {
        logger.error(`Error in onDisconnect callback for game ${gameId}`, { error });
      }
    }

    this.gameCallbacks.delete(gameId);

    // If no games are registered, disconnect
    if (this.gameCallbacks.size === 0) {
      logger.info('No games registered, disconnecting...');
      this.disconnect();
    }
  }

  /**
   * Initialize and connect the Streamer.bot client
   */
  async connect() {
    // If already connected, return immediately
    if (this.isConnected) {
      return;
    }

    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create connection promise
    this.connectionPromise = (async () => {
      try {
        logger.info('Connecting to Streamer.bot...');

        this.client = new StreamerbotClient({
          host: this.host,
          port: this.port,
          endpoint: this.endpoint,
          subscribe: {
            'Twitch': ['ChatMessage']
          },
          onConnect: this.handleConnect.bind(this),
          onDisconnect: this.handleDisconnect.bind(this)
        });

        try {
          // Increase listener limit on the underlying emitter to avoid warnings in long runs
          if (typeof this.client.setMaxListeners === 'function') {
            this.client.setMaxListeners(50);
          }
        } catch (error) {
          logger.warn('Could not set max listeners', { error });
        }

        this.setupEventHandlers();
      } catch (error) {
        logger.error('Failed to connect to Streamer.bot', { error });
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Setup event handlers for chat messages
   */
  setupEventHandlers() {
    if (!this.client) {
      logger.error('Cannot setup event handlers: client not initialized');
      return;
    }

    this.client.on('Twitch.ChatMessage', this.handleChatMessage.bind(this));
  }

  /**
   * Handle connection event - notify all registered games
   */
  handleConnect = async () => {
    this.isConnected = true;
    this.connectionPromise = null;
    logger.info('Connected to Streamer.bot via TwitchChatMonitor');
    
    // Notify all registered games
    const notifyPromises = [];
    for (const [gameId, callbacks] of this.gameCallbacks.entries()) {
      if (callbacks.onConnect) {
        notifyPromises.push(
          (async () => {
            try {
              await callbacks.onConnect();
            } catch (error) {
              logger.error(`Error in onConnect callback for game ${gameId}`, { error });
            }
          })()
        );
      }
    }
    
    await Promise.allSettled(notifyPromises);
  }

  /**
   * Handle disconnection event - notify all registered games
   */
  handleDisconnect = async () => {
    this.isConnected = false;
    this.connectionPromise = null;
    logger.info('Disconnected from Streamer.bot');
    
    // Notify all registered games
    const notifyPromises = [];
    for (const [gameId, callbacks] of this.gameCallbacks.entries()) {
      if (callbacks.onDisconnect) {
        notifyPromises.push(
          (async () => {
            try {
              await callbacks.onDisconnect();
            } catch (error) {
              logger.error(`Error in onDisconnect callback for game ${gameId}`, { error });
            }
          })()
        );
      }
    }
    
    await Promise.allSettled(notifyPromises);
  }

  /**
   * Handle incoming chat messages - route to all registered games
   */
  handleChatMessage = async (data) => {
    if (this.gameCallbacks.size === 0) {
      return;
    }

    try {
      const message = data?.data?.message?.message?.trim();
      const username = data?.data?.message?.username;
      
      if (!message || !username) {
        return;
      }

      // Route message to all registered games
      const notifyPromises = [];
      for (const [gameId, callbacks] of this.gameCallbacks.entries()) {
        if (callbacks.onChatMessage) {
          notifyPromises.push(
            (async () => {
              try {
                await callbacks.onChatMessage({
                  message,
                  username,
                  rawData: data
                });
              } catch (error) {
                logger.error(`Error in onChatMessage callback for game ${gameId}`, { error });
              }
            })()
          );
        }
      }
      
      // Process all callbacks in parallel (games can handle messages independently)
      await Promise.allSettled(notifyPromises);
    } catch (error) {
      logger.error('Error processing chat message', { error });
    }
  }

  /**
   * Get the Streamer.bot client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Check if the monitor is connected
   */
  isConnectedToStreamerbot() {
    return this.isConnected;
  }

  /**
   * Get the number of registered games
   */
  getRegisteredGameCount() {
    return this.gameCallbacks.size;
  }

  /**
   * Disconnect from Streamer.bot
   * Note: This will disconnect all games. Use unregisterGame() for individual games.
   */
  async disconnect() {
    if (this.client) {
      logger.info('Disconnecting TwitchChatMonitor...');
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
      this.connectionPromise = null;
      logger.info('TwitchChatMonitor disconnected');
    }
  }
}
