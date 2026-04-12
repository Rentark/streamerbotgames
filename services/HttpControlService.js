import http from 'node:http';
import { URL } from 'node:url';
import logger from '../utils/logger.js';

/**
 * HttpControlService - Simple HTTP server for controlling game state
 * 
 * Provides REST API endpoints for enabling/disabling games and checking status
 * Uses Node's built-in http module (no external dependencies)
 */
export class HttpControlService {
  constructor(config = {}) {
    this.port = config.port || 3000;
    this.authToken = config.authToken || 'CHANGE_ME_SECRET_TOKEN';
    this.server = null;
    this.gameControllers = new Map(); // Map<gameId, { setEnabled, getState }>
  }

  /**
   * Register a game controller
   * @param {string} gameId - Unique game identifier
   * @param {Object} controller - { setEnabled(enabled), getState() }
   */
  registerGame(gameId, controller) {
    if (!gameId || !controller) {
      logger.warn('Invalid game controller registration', { gameId, controller });
      return;
    }

    this.gameControllers.set(gameId, controller);
    logger.info('Game controller registered', { gameId });
  }

  /**
   * Unregister a game controller
   * @param {string} gameId - Unique game identifier
   */
  unregisterGame(gameId) {
    this.gameControllers.delete(gameId);
    logger.info('Game controller unregistered', { gameId });
  }

  /**
   * Verify authentication token
   * @param {string} token - Token to verify
   * @returns {boolean} True if token is valid
   */
  verifyAuth(token) {
    return token === this.authToken;
  }

  /**
   * Handle HTTP requests
   */
  handleRequest = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method;

      // Parse auth token from header or query
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '') || url.searchParams.get('token');

      if (!this.verifyAuth(token)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Route handling
      if (path === '/health' && method === 'GET') {
        this.handleHealth(req, res);
      } else if (path.startsWith('/games/') && method === 'GET') {
        this.handleGetGameState(req, res, path);
      } else if (path.startsWith('/games/') && method === 'POST') {
        this.handleSetGameState(req, res, path);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      logger.error('Error handling HTTP request', { error });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Handle health check endpoint
   */
  handleHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      registeredGames: Array.from(this.gameControllers.keys())
    }));
  }

  /**
   * Handle GET /games/:gameId/state
   */
  handleGetGameState(req, res, path) {
    const gameId = path.split('/')[2];
    const controller = this.gameControllers.get(gameId);

    if (!controller || !controller.getState) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Game not found' }));
      return;
    }

    try {
      const state = controller.getState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ gameId, state }));
    } catch (error) {
      logger.error('Error getting game state', { error, gameId });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get game state' }));
    }
  }

  /**
   * Handle POST /games/:gameId/enabled
   */
  handleSetGameState(req, res, path) {
    const gameId = path.split('/')[2];
    const controller = this.gameControllers.get(gameId);

    if (!controller || !controller.setEnabled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Game not found' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const enabled = data.enabled !== undefined ? Boolean(data.enabled) : null;

        if (enabled === null) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing enabled field' }));
          return;
        }

        controller.setEnabled(enabled);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          gameId, 
          enabled,
          message: `Game ${enabled ? 'enabled' : 'disabled'}` 
        }));
      } catch (error) {
        logger.error('Error setting game state', { error, gameId });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
  }

  /**
   * Start the HTTP server
   */
  start() {
    if (this.server) {
      logger.warn('HTTP control server already running');
      return;
    }

    this.server = http.createServer(this.handleRequest);

    this.server.listen(this.port, () => {
      logger.info(`HTTP control server started on port ${this.port}`);
    });

    this.server.on('error', (error) => {
      logger.error('HTTP control server error', { error, port: this.port });
    });
  }

  /**
   * Stop the HTTP server
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP control server stopped');
      });
      this.server = null;
    }
  }
}
