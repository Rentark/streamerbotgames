process.title = `custom-twitch-bot:${process.pid}`;

// Entry point for the game application
import KnockGame from './games/knockGame/knockGame.js';
import RetypeWordGame from './games/retypeWord/retypeWord.js';
import logger from './utils/logger.js';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { URL } from 'node:url';
import { gameConfigKnock } from './games/gameConfig.js';
import { serverMessages } from './config/config.js';
import { MessageService } from './services/MessageService.js';
import { StarfallMessageTemplate } from './utils/messageTemplates/StarfallMessageTemplate.js';
import { createRouteHandlers } from './routes/controlRoutes.js';
import { httpControl } from './config/config.js';
import { DefaultMessageTemplate } from './utils/messageTemplates/DefaultMessageTemplate.js';

// Ensure working directory is this script's folder so logs resolve correctly
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  process.chdir(__dirname);
} catch {}

// Global crash handlers so errors are logged instead of silent exits
EventEmitter.defaultMaxListeners = 50;
process.on('uncaughtException', (err) => {
  try { logger.error('Uncaught exception', { err }); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  try { logger.error('Unhandled rejection', { reason }); } catch {}
  process.exit(1);
});

// Game instances
let knockGame = null;
let retypeWordGame = null;
let currentStarfallGame = null;

// Services for sending messages
let messageService = null;
let defaultMessageTemplate = null;
let starfallMessageTemplate = null;

/**
 * Send a message to Twitch chat
 * @param {string} message - Message to send
 */
async function sendTwitchMessage(message) {
  if (!messageService || !message) {
    return;
  }

  try {
    // Get client from knockGame if available
    const client = knockGame?.client || knockGame?.chatMonitor?.getClient();
    if (client) {
      await messageService.sendTwitchMessage(message, client);
    } else {
      logger.debug('Cannot send message - client not available');
    }
  } catch (error) {
    logger.error('Failed to send Twitch message', { error, message });
  }
}

/**
 * Start the unified control server for both games
 */
function startControlServer() {
  const config = httpControl;
  const { host, port } = config;

  // Create route handlers with access to game instances and services
  const routes = createRouteHandlers(
    {
      knockGame,
      retypeWordGame,
      messageService,
      defaultMessageTemplate,
      sendTwitchMessage
    },
    () => currentStarfallGame, // Getter
    (newGame) => { currentStarfallGame = newGame; } // Setter
  );

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    // res.setHeader('Access-Control-Allow-Origin', '*');
    // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://127.0.0.1:3001`);
      const path = url.pathname;
      const method = req.method;

      logger.info('Request received', { url, path, method });

      // Route to handler if exists
      if (method === 'GET' && routes[path]) {
        await routes[path](req, res).catch(error => {
          logger.error('Error in route handler', { error, path });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
      logger.error('Error handling HTTP request', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  server.listen(port, host, () => {
    logger.info(`🛂 Control server started on http://${host}:${port}`);
  });
}

async function main() {
  try {
    logger.info('Starting game application...');
    
    // Initialize message services
    messageService = new MessageService();
    defaultMessageTemplate = new DefaultMessageTemplate(serverMessages);
    
    // Start KnockGame - always running, monitors chat
    // Don't start its internal HTTP server since we have a unified one
    knockGame = new KnockGame(gameConfigKnock, { startHttpServer: false });
    await knockGame.connect();
    
    // Set client in message service once knockGame is connected
    const client = knockGame.client || knockGame.chatMonitor?.getClient();
    if (client) {
      messageService.setClient(client);
    }
    
    logger.info('KnockGame started and monitoring chat');

    // Start RetypeWordGame - monitors chat for "!meh" transcription
    retypeWordGame = new RetypeWordGame();
    await retypeWordGame.connect();
    logger.info('RetypeWordGame started and monitoring chat');

    // Start unified control server
    startControlServer();

    // StarfallGame will be started via HTTP endpoint or external timer
    logger.info('Application ready.');

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, stopping games...`);
      
      if (knockGame) {
        await knockGame.stop();
      }

      if (retypeWordGame) {
        await retypeWordGame.stop();
      }
      
      if (currentStarfallGame) {
        await currentStarfallGame.stop();
      }
      
      process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();
