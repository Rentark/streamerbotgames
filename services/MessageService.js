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
    // Use provided client or fall back to stored client
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
      let reconnectClient = TwitchChatMonitor.getInstance();
      if (!reconnectClient.isConnectedToStreamerbot()) { await reconnectClient.connect(); }
      else throw error;
    }
  }

  async setStreamElementsRewardMulti(winners) {
    logger.info('Setting multi reward on StreamElements', { winners });

      const response = await sendRequest({
        url: this.streamElementsConfig.url,
        method: 'PUT',
        headers: this.streamElementsConfig.headers,
        payload: { 
          users: winners, 
          mode: "add" 
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

  async setStreamElementsReward(user, amount) {
    logger.info('Setting reward on StreamElements', { user });

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

  // Method to update client reference (needed because client is initialized after MessageService)
  setClient(client) {
    this.client = client;
  }
}
