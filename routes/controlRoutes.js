import logger from '../utils/logger.js';
import { setKnockEnabled, knockEnabled, setStarfallEnabled, starfallEnabled, enableBothGames, disableBothGames, setRetypeWordEnabled, retypeWordEnabled, setCosmosEnabled, cosmosEnabled } from '../games/gameState.js';
import StarFallGame from '../games/starfallGame/starfallGame.js';
import { serverMessages } from '../config/config.js';

/**
 * Route handlers for the control server
 * All routes are GET endpoints with token authentication
 * 
 * Available Routes:
 * - GET /knock/disable - Disable knock game
 * - GET /knock/enable - Enable knock game
 * - GET /knock/status - Get knock game status
 * - GET /starfall/disable - Disable starfall game
 * - GET /starfall/enable - Enable starfall game
 * - GET /starfall/start - Start starfall game
 * - GET /starfall/status - Get starfall game status
 * - GET /games/enable-all - Enable both games simultaneously
 * - GET /status - Get overall status of both games
 * - GET /health - Health check endpoint
 */

/**
 * Send a JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Get status text based on boolean value
 * @param {boolean} value - Boolean value (enabled/running)
 * @returns {string} Status text
 */
function getStatusText(value) {
  return value ? serverMessages.statusTexts.enabled : serverMessages.statusTexts.disabled;
}

/**
 * Replace template parameters in a message string
 * @param {string} template - Message template with placeholders
 * @param {Object} params - Parameters to replace
 * @returns {string} Message with replaced parameters
 */
function replaceTemplateParams(template, params) {
  let message = template;
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(`{${key}}`, value);
  }
  return message;
}

/**
 * Route handlers factory - creates handlers with access to game instances and services
 * @param {Object} context - Context object with game instances and services
 * @param {Function} getCurrentstarfallGame - Getter function for currentstarfallGame
 * @param {Function} setCurrentstarfallGame - Setter function to update currentstarfallGame
 */
export function createRouteHandlers({ knockGame, retypeWordGame, cosmosGame, messageService, messageTemplate, sendTwitchMessage }, getCurrentstarfallGame, setCurrentstarfallGame) {
  /**
   * Prepare and send a Twitch message
   * @param {string} templateKey - Key in controlMessages object
   * @param {Object} params - Parameters for message template
   */
  function prepareAndSendTwitchMessage(templateKey, params = {}) {
    const template = serverMessages.controlMessages[templateKey];
    if (!template) {
      logger.warn(`Message template not found: ${templateKey}`);
      return;
    }

    const message = messageTemplate
      ? messageTemplate.prepareMessage(template, params)
      : replaceTemplateParams(template, params);

    sendTwitchMessage(message);
  }

  /**
   * Send Twitch message and JSON response
   * @param {Object} res - HTTP response object
   * @param {number} statusCode - HTTP status code
   * @param {Object} data - JSON response data
   * @param {string} templateKey - Key in controlMessages object
   * @param {Object} params - Parameters for message template
   */
  function sendResponse(res, statusCode, data, templateKey, params = {}) {
    prepareAndSendTwitchMessage(templateKey, params);
    sendJson(res, statusCode, data);
  }

  return {
    /**
     * GET /knock/disable - Disable knock game
     */
    '/knock/disable': async (req, res) => {
      setKnockEnabled(false);
      sendResponse(res, 200, { message: '!knock disabled', enabled: false }, 'knockDisabled');
      logger.info('Knock game disabled via HTTP control');
    },

    /**
     * GET /knock/enable - Enable knock game
     */
    '/knock/enable': async (req, res) => {
      setKnockEnabled(true);
      sendResponse(res, 200, { message: '!knock enabled', enabled: true }, 'knockEnabled');
      logger.info('Knock game enabled via HTTP control');
    },

    /**
     * GET /knock/status - Get knock game status
     */
    '/knock/status': async (req, res) => {
      const state = knockGame ? knockGame.getState() : { enabled: knockEnabled, isRunning: false };
      const statusText = getStatusText(state.enabled);
      sendResponse(res, 200, state, 'knockStatus', { status: statusText });
    },

    /**
 * GET /retype/disable - Disable retype game
 */
    '/retype/disable': async (req, res) => {
      setRetypeWordEnabled(false);
      sendResponse(res, 200, { message: '!meh disabled', enabled: false }, 'mehDisabled');
      logger.info('RetypeWord game disabled via HTTP control');
    },

    /**
     * GET /retype/enable - Enable retype game
     */
    '/retype/enable': async (req, res) => {
      setRetypeWordEnabled(true);
      sendResponse(res, 200, { message: '!meh enabled', enabled: true }, 'mehEnabled');
      logger.info('RetypeWord game enabled via HTTP control');
    },

    /**
     * GET /retype/status - Get retype game status
     */
    '/retype/status': async (req, res) => {
      const state = retypeWordGame ? retypeWordGame.getState() : { enabled: retypeWordEnabled, isRunning: false };
      const statusText = getStatusText(state.enabled);
      sendResponse(res, 200, state, 'mehStatus', { status: statusText });
    },

    '/cosmos/disable': async (req, res) => {
      setCosmosEnabled(false);
      sendResponse(res, 200, { message: 'cosmos casino disabled', enabled: false }, 'cosmosDisabled');
      logger.info('Cosmos casino disabled via HTTP control');
    },

    '/cosmos/enable': async (req, res) => {
      setCosmosEnabled(true);
      sendResponse(res, 200, { message: 'cosmos casino enabled', enabled: true }, 'cosmosEnabled');
      logger.info('Cosmos casino enabled via HTTP control');
    },

    '/cosmos/status': async (req, res) => {
      const state = cosmosGame
        ? cosmosGame.getState()
        : { enabled: cosmosEnabled, isRunning: false };
      const statusText = getStatusText(state.enabled);
      sendResponse(res, 200, state, 'cosmosStatus', { status: statusText });
    },

    /**
     * GET /starfall/disable - Disable starfall game
     */
    '/starfall/disable': async (req, res) => {
      setStarfallEnabled(false);
      sendResponse(res, 200, { message: 'starfall game disabled', enabled: false }, 'starfallDisabled');
      logger.info('starfall game disabled via HTTP control');
    },

    /**
     * GET /starfall/enable - Enable starfall game
     */
    '/starfall/enable': async (req, res) => {
      setStarfallEnabled(true);
      sendResponse(res, 200, { message: 'starfall game enabled', enabled: true }, 'starfallEnabled');
      logger.info('starfall game enabled via HTTP control');
    },

    /**
     * GET /starfall/start - Start starfall game
     */
    '/starfall/start': async (req, res) => {
      if (!starfallEnabled) {
        sendJson(res, 400, { error: 'starfall game is disabled' });
        return;
      }

      const currentstarfallGame = getCurrentstarfallGame();
      if (currentstarfallGame && currentstarfallGame.isRunning) {
        sendJson(res, 400, { error: 'starfall game is already running' });
        return;
      }

      // Start a new starfall game asynchronously
      (async () => {
        try {
          const newGame = new StarFallGame();
          await newGame.connect();
          logger.info('starfall game started via HTTP control');

          // Update the current game reference
          if (setCurrentstarfallGame) {
            setCurrentstarfallGame(newGame);
          }
        } catch (error) {
          logger.error('Failed to start starfall game', { error });
          if (setCurrentstarfallGame) {
            setCurrentstarfallGame(null);
          }
        }
      })();

      sendJson(res, 200, { message: 'starfall game started' });
    },

    /**
     * GET /starfall/status - Get starfall game status
     */
    '/starfall/status': async (req, res) => {
      const currentstarfallGame = getCurrentstarfallGame();
      const isRunning = currentstarfallGame ? currentstarfallGame.isRunning : false;
      const statusText = getStatusText(starfallEnabled);
      sendResponse(res, 200, { enabled: starfallEnabled, isRunning }, 'starfallStatus', { status: statusText });
    },

    /**
     * GET /games/enable-all - Enable both games simultaneously
     */
    '/games/enable-all': async (req, res) => {
      enableBothGames();
      sendResponse(res, 200, { message: 'Both games enabled', knockEnabled: true, starfallEnabled: true }, 'bothGamesEnabled');
      logger.info('Both games enabled via HTTP control');
    },

    /**
     * GET /games/disable-all - Disable both games simultaneously
     */
    '/games/disable-all': async (req, res) => {
      disableBothGames();
      sendResponse(res, 200, { message: 'All games disabled', knockEnabled: true, starfallEnabled: true }, 'bothGamesDisabled');
      logger.info('Both games enabled via HTTP control');
    },

    /**
     * GET /status - Get overall status of both games
     */
    '/status': async (req, res) => {
      const currentstarfallGame = getCurrentstarfallGame();
      const knockState = knockGame ? knockGame.getState() : { enabled: knockEnabled, isRunning: false };
      const starfallState = {
        enabled: starfallEnabled,
        isRunning: currentstarfallGame ? currentstarfallGame.isRunning : false
      };
      const retypeWordState = retypeWordGame ? retypeWordGame.getState() : { enabled: retypeWordEnabled, isRunning: false };
      const knockStatusText = getStatusText(knockState.enabled);
      const starfallStatusText = getStatusText(starfallState.enabled);
      const retypeWordStatusText = getStatusText(retypeWordState.enabled);
      sendResponse(res, 200, {
        knock: knockState,
        starfall: starfallState,
        retypeWord: retypeWordState
      }, 'overallStatus', {
        knockStatus: knockStatusText,
        starfallStatus: starfallStatusText,
        retypeWordStatus: retypeWordStatusText
      });
    },

    /**
     * GET /health - Health check endpoint
     */
    '/health': async (req, res) => {
      sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() }, 'healthCheck');
    }
  };
}
