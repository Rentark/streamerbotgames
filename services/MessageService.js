import logger from '../utils/logger.js';
import sendRequest from '../utils/sendRequest.js';
import { TwitchChatMonitor } from './TwitchChatMonitor.js';

export class MessageService {
  constructor() {
    // Streamer.bot action IDs
    this.actionIds = {
      serverMessage: 'be02f9d8-0b3c-4827-80a3-c590181cecaf'
    };

    // StreamElements configuration
    this.streamElementsConfig = {
      url: `https://api.streamelements.com/kappa/v2/points/${process.env.STREAMELEMENTS_ACCOUNT_ID}`,
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.STREAMELEMENTS_TOKEN}`
      }
    };
  }

  async sendTwitchMessage(message, client = null) {
    const clientToUse = client || this.client;

    if (!clientToUse) {
      throw new Error('Streamer.bot client is required to send Twitch messages. Set client via setClient() or pass as parameter.');
    }

    logger.info(`Sending message to Twitch ${new Date().toISOString()}`, { message });

    try {
      const response = await clientToUse.doAction(this.actionIds.serverMessage, {
        rawInput: message
      });
      logger.info('Twitch message sent successfully', { response });
      return response;
    } catch (error) {
      logger.error('Failed to send Twitch message', { error, message });
      const reconnectClient = TwitchChatMonitor.getInstance();
      if (!reconnectClient.isConnectedToStreamerbot()) { await reconnectClient.connect(); }
      else throw error;
    }
  }

  // ── StreamElements points (read) ─────────────────────────────────────────

  /**
   * Fetch current StreamElements points for a user.
   * Returns null on failure (network error, user not found, etc.).
   * Callers should treat null as "balance unavailable" and surface an error message.
   *
   * @param {string} username - Twitch username (lowercase)
   * @returns {Promise<number|null>}
   */
  async getStreamElementsPoints(username) {
    if (!username) return null;

    try {
      const response = await sendRequest({
        url: `${this.streamElementsConfig.url}/${username}`,
        method: 'GET',
        headers: this.streamElementsConfig.headers,
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        const points = response.points ?? response.body?.points;
        if (typeof points === 'number') {
          logger.debug('SE points fetched', { username, points });
          return points;
        }
      }

      logger.warn('SE points fetch: unexpected response', { username, statusCode: response.statusCode });
      return null;
    } catch (error) {
      logger.error('SE points fetch failed', { error, username });
      return null;
    }
  }

  // ── StreamElements points (write) ─────────────────────────────────────────

  async setStreamElementsRewardMulti(winners) {
    logger.info('Setting multi reward on StreamElements', { winners });

    const response = await sendRequest({
      url: this.streamElementsConfig.url,
      method: 'PUT',
      headers: this.streamElementsConfig.headers,
      payload: {
        users: winners,
        mode: 'add'
      }
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      logger.info('StreamElements reward set successfully', { response });
      return { success: true };
    } else {
      logger.error('Failed to set StreamElements reward', { response, winners });
      return { success: false, response };
    }
  }

  /**
   * Add or deduct points for a single user.
   * Pass a negative `amount` to deduct.
   *
   * @param {string} user
   * @param {number} amount - positive = add, negative = deduct
   * @returns {Promise<{ success: boolean, response?: any }>}
   */
  async setStreamElementsReward(user, amount) {
    logger.info('Setting reward on StreamElements', { user, amount });

    const response = await sendRequest({
      url: `${this.streamElementsConfig.url}/${user}/${amount}`,
      method: 'PUT',
      headers: this.streamElementsConfig.headers,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      logger.info('StreamElements reward set successfully', { response });
      return { success: true };
    } else {
      logger.error('Failed to set StreamElements reward', { response, user });
      return { success: false, response };
    }
  }

  // Method to update client reference
  setClient(client) {
    this.client = client;
  }
}
