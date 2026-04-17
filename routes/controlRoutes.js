import logger from '../utils/logger.js';
import {
  setKnockEnabled, knockEnabled,
  setStarfallEnabled, starfallEnabled,
  enableBothGames, disableBothGames,
  setRetypeWordEnabled, retypeWordEnabled,
  setCosmosEnabled, cosmosEnabled,
} from '../games/gameState.js';
import { isFeatureEnabled } from '../games/cosmosGames/state.js';
import StarFallGame from '../games/starfallGame/starfallGame.js';
import { serverMessages } from '../config/config.js';

/**
 * Route handlers for the control server
 * All routes are GET endpoints.
 *
 * Cosmos feature routes pattern:
 *   GET /cosmos/feature/:feature/enable
 *   GET /cosmos/feature/:feature/disable
 *   GET /cosmos/feature/:feature/status
 *   GET /cosmos/features          – status of all feature flags
 *
 * Valid feature names: spin | dice | duel | box | daily | blackjack
 */

const COSMOS_FEATURES = ['spin', 'dice', 'duel', 'box', 'daily', 'blackjack'];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getStatusText(value) {
  return value
    ? serverMessages.statusTexts.enabled
    : serverMessages.statusTexts.disabled;
}

function replaceTemplateParams(template, params) {
  let message = template;
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(`{${key}}`, value);
  }
  return message;
}

export function createRouteHandlers(
  { knockGame, retypeWordGame, cosmosGame, messageService, messageTemplate, sendTwitchMessage },
  getCurrentStarfallGame,
  setCurrentStarfallGame
) {
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

  function sendResponse(res, statusCode, data, templateKey, params = {}) {
    prepareAndSendTwitchMessage(templateKey, params);
    sendJson(res, statusCode, data);
  }

  // ── Route registry ─────────────────────────────────────────────────────────

  const routes = {

    // ── Knock ────────────────────────────────────────────────────────────────
    '/knock/disable': async (req, res) => {
      setKnockEnabled(false);
      sendResponse(res, 200, { message: '!knock disabled', enabled: false }, 'knockDisabled');
    },
    '/knock/enable': async (req, res) => {
      setKnockEnabled(true);
      sendResponse(res, 200, { message: '!knock enabled', enabled: true }, 'knockEnabled');
    },
    '/knock/status': async (req, res) => {
      const state = knockGame ? knockGame.getState() : { enabled: knockEnabled, isRunning: false };
      sendResponse(res, 200, state, 'knockStatus', { status: getStatusText(state.enabled) });
    },

    // ── Retype ───────────────────────────────────────────────────────────────
    '/retype/disable': async (req, res) => {
      setRetypeWordEnabled(false);
      sendResponse(res, 200, { message: '!meh disabled', enabled: false }, 'mehDisabled');
    },
    '/retype/enable': async (req, res) => {
      setRetypeWordEnabled(true);
      sendResponse(res, 200, { message: '!meh enabled', enabled: true }, 'mehEnabled');
    },
    '/retype/status': async (req, res) => {
      const state = retypeWordGame ? retypeWordGame.getState() : { enabled: retypeWordEnabled, isRunning: false };
      sendResponse(res, 200, state, 'mehStatus', { status: getStatusText(state.enabled) });
    },

    // ── Cosmos (casino-wide) ─────────────────────────────────────────────────
    '/cosmos/disable': async (req, res) => {
      setCosmosEnabled(false);
      sendResponse(res, 200, { message: 'cosmos casino disabled', enabled: false }, 'cosmosDisabled');
    },
    '/cosmos/enable': async (req, res) => {
      setCosmosEnabled(true);
      sendResponse(res, 200, { message: 'cosmos casino enabled', enabled: true }, 'cosmosEnabled');
    },
    '/cosmos/status': async (req, res) => {
      const state = cosmosGame
        ? cosmosGame.getState()
        : { enabled: cosmosEnabled, isRunning: false };
      sendResponse(res, 200, state, 'cosmosStatus', { status: getStatusText(state.enabled) });
    },

    // ── Cosmos features ───────────────────────────────────────────────────────
    // GET /cosmos/features  — snapshot of all feature flags
    '/cosmos/features': async (req, res) => {
      if (!cosmosGame) {
        return sendJson(res, 404, { error: 'CosmosGame not running' });
      }
      sendJson(res, 200, { features: cosmosGame.getState().features });
    },

    // GET /cosmos/features/enable-all
    '/cosmos/features/enable-all': async (req, res) => {
      if (!cosmosGame) return sendJson(res, 404, { error: 'CosmosGame not running' });
      cosmosGame.enableAllFeatures();
      sendResponse(res, 200, { features: cosmosGame.getState().features }, 'cosmosFeaturesEnabled');
    },

    // GET /cosmos/features/disable-all
    '/cosmos/features/disable-all': async (req, res) => {
      if (!cosmosGame) return sendJson(res, 404, { error: 'CosmosGame not running' });
      cosmosGame.disableAllFeatures();
      sendResponse(res, 200, { features: cosmosGame.getState().features }, 'cosmosFeaturesDisabled');
    },

    // ── Starfall ─────────────────────────────────────────────────────────────
    '/starfall/disable': async (req, res) => {
      setStarfallEnabled(false);
      sendResponse(res, 200, { message: 'starfall game disabled', enabled: false }, 'starfallDisabled');
    },
    '/starfall/enable': async (req, res) => {
      setStarfallEnabled(true);
      sendResponse(res, 200, { message: 'starfall game enabled', enabled: true }, 'starfallEnabled');
    },
    '/starfall/start': async (req, res) => {
      if (!starfallEnabled) {
        return sendJson(res, 400, { error: 'starfall game is disabled' });
      }
      const current = getCurrentStarfallGame();
      if (current?.isRunning) {
        return sendJson(res, 400, { error: 'starfall game is already running' });
      }
      (async () => {
        try {
          const newGame = new StarFallGame();
          await newGame.connect();
          if (setCurrentStarfallGame) setCurrentStarfallGame(newGame);
        } catch (error) {
          logger.error('Failed to start starfall game', { error });
          if (setCurrentStarfallGame) setCurrentStarfallGame(null);
        }
      })();
      sendJson(res, 200, { message: 'starfall game started' });
    },
    '/starfall/status': async (req, res) => {
      const current = getCurrentStarfallGame();
      const isRunning = current ? current.isRunning : false;
      sendResponse(res, 200, { enabled: starfallEnabled, isRunning }, 'starfallStatus', {
        status: getStatusText(starfallEnabled)
      });
    },

    // ── Multi-game ────────────────────────────────────────────────────────────
    '/games/enable-all': async (req, res) => {
      enableBothGames();
      sendResponse(res, 200, { message: 'All games enabled' }, 'bothGamesEnabled');
    },
    '/games/disable-all': async (req, res) => {
      disableBothGames();
      sendResponse(res, 200, { message: 'All games disabled' }, 'bothGamesDisabled');
    },

    // ── Overall status ────────────────────────────────────────────────────────
    '/status': async (req, res) => {
      const current    = getCurrentStarfallGame();
      const knockState = knockGame ? knockGame.getState() : { enabled: knockEnabled, isRunning: false };
      const starState  = { enabled: starfallEnabled, isRunning: current ? current.isRunning : false };
      const retypeState = retypeWordGame ? retypeWordGame.getState() : { enabled: retypeWordEnabled, isRunning: false };
      const cosmosState = cosmosGame ? cosmosGame.getState() : { enabled: cosmosEnabled, isRunning: false };
      sendResponse(res, 200, {
        knock: knockState, starfall: starState, retypeWord: retypeState, cosmos: cosmosState,
      }, 'overallStatus', {
        knockStatus:    getStatusText(knockState.enabled),
        starfallStatus: getStatusText(starState.enabled),
        retypeWordStatus: getStatusText(retypeState.enabled),
        cosmosStatus:   getStatusText(cosmosState.enabled),
      });
    },

    // ── Health ────────────────────────────────────────────────────────────────
    '/health': async (req, res) => {
      sendResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() }, 'healthCheck');
    },
  };

  // ── Dynamic cosmos feature routes ─────────────────────────────────────────
  // These are resolved at request time because the feature name comes from
  // the URL path, not from a static string.
  routes._resolveCosmosFeature = (path) => {
    // Matches: /cosmos/feature/spin/enable
    //          /cosmos/feature/blackjack/disable
    //          /cosmos/feature/dice/status
    const m = path.match(/^\/cosmos\/feature\/([^/]+)\/(enable|disable|status)$/);
    if (!m) return null;

    const [, feature, action] = m;
    if (!COSMOS_FEATURES.includes(feature)) return null;

    return async (req, res) => {
      if (!cosmosGame) {
        return sendJson(res, 404, { error: 'CosmosGame not running' });
      }

      if (action === 'enable') {
        cosmosGame.setFeature(feature, true);
        const msgKey = `cosmos_${feature}_enabled`;
        const fallbackMsg = `cosmos ${feature} enabled`;
        const msg = serverMessages.controlMessages[msgKey] ?? fallbackMsg;
        sendTwitchMessage(msg);
        return sendJson(res, 200, { feature, enabled: true });
      }

      if (action === 'disable') {
        cosmosGame.setFeature(feature, false);
        const msgKey = `cosmos_${feature}_disabled`;
        const fallbackMsg = `cosmos ${feature} disabled`;
        const msg = serverMessages.controlMessages[msgKey] ?? fallbackMsg;
        sendTwitchMessage(msg);
        return sendJson(res, 200, { feature, enabled: false });
      }

      // status
      const enabled = isFeatureEnabled(feature);
      return sendJson(res, 200, { feature, enabled });
    };
  };

  return routes;
}
