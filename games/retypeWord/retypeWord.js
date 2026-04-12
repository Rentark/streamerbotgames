import logger from '../../utils/logger.js';
import { MessageService } from '../../services/MessageService.js';
import { TwitchChatMonitor } from '../../services/TwitchChatMonitor.js';
import { validateTranscriptionWithLLM } from '../../services/LLMConnectorService.js';
import { gameConfigRetypeWord } from '../gameConfig.js';
import {
  retypeWordEnabled,
  normalizeUsername,
  getLastMessage,
  setLastMessage,
  canUseMeh,
  canBotSpeak,
  setRetypeWordEnabled
} from './state.js';

/** Lowercase EN → UKR layout. Messages are lowercased in TwitchChatMonitor. */
const EN_TO_UKR_KEYBOARD_LAYOUT = {
  // Lowercase
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
  '[': 'х', ']': 'ї',
  'a': 'ф', 's': 'і', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д',
  ';': 'ж', '\'': 'є',
  'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь',
  ',': 'б', '.': 'ю', '/': '.', '`': 'ґ',

  // Uppercase
  'Q': 'Й', 'W': 'Ц', 'E': 'У', 'R': 'К', 'T': 'Е', 'Y': 'Н', 'U': 'Г', 'I': 'Ш', 'O': 'Щ', 'P': 'З',
  '{': 'Х', '}': 'Ї',
  'A': 'Ф', 'S': 'І', 'D': 'В', 'F': 'А', 'G': 'П', 'H': 'Р', 'J': 'О', 'K': 'Л', 'L': 'Д',
  ':': 'Ж', '"': 'Є',
  'Z': 'Я', 'X': 'Ч', 'C': 'С', 'V': 'М', 'B': 'И', 'N': 'Т', 'M': 'Ь',
  '<': 'Б', '>': 'Ю', '?': '.', '~': 'Ґ', 
  
  '@': '"', '$': ';', '^': ':', '&': '?'
};

/**
 * RetypeWordGame
 * - Watches Twitch chat for `!meh`
 * - Takes the chatter's last message before `!meh`
 * - If it looks like it was typed on an English keyboard layout,
 *   transcribes it to a Ukrainian keyboard layout
 * - Validates the transcription via an async LLM/AI stub (placeholder)
 * - Sends the validated text back to Twitch chat
 */
class RetypeWordGame {
  constructor(config = gameConfigRetypeWord) {
    this.config = config;

    this.gameId = `retypeword-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning = false;

    this.chatMonitor = TwitchChatMonitor.getInstance();
    this.messageService = new MessageService();

    // Bind methods
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  handleConnect = async () => {
    logger.info('RetypeWordGame connected to Streamer.bot via TwitchChatMonitor');
    this.client = this.chatMonitor.getClient();
    if (this.client) {
      this.messageService.setClient(this.client);
    }
  }

  handleDisconnect = async () => {
    logger.info('RetypeWordGame disconnected from Streamer.bot');
  }

  async sendMessage(message) {
    if (!message || typeof message !== 'string') {
      logger.warn('Attempted to send invalid message', { message });
      return;
    }

    if (!canBotSpeak()) {
      return;
    }

    try {
      await this.messageService.sendTwitchMessage(message);
    } catch (error) {
      logger.error('Failed to send message', { error, message });
    }
  }

  /**
   * Main chat handler.
   * @param {{ message: string, username: string }} data
   */
  handleChatMessage = async ({ message, username }) => {
    if (!message || !username) {
      return;
    }

    const sender = normalizeUsername(username);
    if (!sender) {
      return;
    }

    const trimmed = message.trim();
    const parts = trimmed.split(/\s+/);
    const command = (parts[0] || '').toLowerCase();

    // IMPORTANT: use the previous message BEFORE we overwrite it with the command itself
    const previousMessage = getLastMessage(sender);

    try {
      if (retypeWordEnabled && this.config.commands.meh.has(command)) {
        await this.handleMehCommand(sender, previousMessage);
        // Do not return; still update last message below
      }
    } catch (error) {
      logger.error('Error handling !meh', { error, sender, previousMessage, message });
    } finally {
      // Always update last message after we handled the command
      setLastMessage(sender, trimmed);
    }
  }

  transcribeEnToUkrKeyboardLayout(text) {
    if (!text || typeof text !== 'string') {
      return text ?? '';
    }

    const prefixes = this.config.transcription.channelEmojiPrefixes ?? ['moonos1'];
    const parts = text.replace(/'/g, "\'").split(/(\s+)/);
    let out = '';
    let wordIndex = 0;

    for (const chunk of parts) {
      if (/^\s+$/.test(chunk)) {
        out += chunk;
        continue;
      }

      const isLeadingMention = wordIndex === 0 && chunk.startsWith('@');
      const isChannelEmoji = prefixes.some((p) => chunk.startsWith(p));
      if (isLeadingMention || isChannelEmoji) {
        out += chunk;
      } else {
        for (let i = 0; i < chunk.length; i++) {
          out += EN_TO_UKR_KEYBOARD_LAYOUT[chunk[i]] ?? chunk[i];
        }
      }
      wordIndex++;
    }

    return out;
  }

  countUkrCyrillicLetters(text) {
    const matches = text.match(/[а-яіїєґ]/gi);
    return matches ? matches.length : 0;
  }

  isInputValid(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const trimmed = text.trim();
    if (trimmed.length < this.config.transcription.minPreviousMessageChars) {
      return false;
    }
    return true;
  }

  async validateTranscription(transcribedText, sender) {
    const result = await validateTranscriptionWithLLM(transcribedText, sender);
    logger.info('LLM validation result', { result });
    return {
      isValid: Boolean(result?.isValid),
      finalText: result?.finalText ?? "Йой, шось пішло не так",
      violations: result?.violations ?? []
    };
  }

  async handleMehCommand(sender, previousMessage) {
    if (!retypeWordEnabled) {
      return;
    }

    if (!canUseMeh(sender)) {
      return;
    }

    if (!previousMessage || typeof previousMessage !== 'string') {
      return;
    }

    const trimmedPrev = previousMessage.trim();
    if (!trimmedPrev || trimmedPrev.startsWith('!') || this.config.commands.meh.has(trimmedPrev)) {
      // Avoid converting previous commands (like "!meh", "!something", etc.)
      return;
    }

    if (!this.isInputValid(trimmedPrev)) {
      return;
    }

    let transcribed = this.transcribeEnToUkrKeyboardLayout(trimmedPrev);
    if (!transcribed || transcribed === trimmedPrev || this.countUkrCyrillicLetters(transcribed) <= this.config.transcription.minUkrCyrillicLetters) {
      return;
    }

    let validation = await this.validateTranscription(transcribed, sender);
    if (!validation.finalText) {
      return;
    }

    const response = this.config.responseTemplate
      .replace('{sender}', sender)
      .replace('{text}', validation.finalText);

    await this.sendMessage(response);
  }

  setEnabled(enabled) {
    setRetypeWordEnabled(Boolean(enabled));
  }

  getState() {
    return {
      isRunning: this.isRunning,
      enabled: retypeWordEnabled,
      gameId: this.gameId
    };
  }

  async connect() {
    if (this.isRunning) {
      logger.warn('RetypeWordGame is already running');
      return;
    }

    logger.info('Connecting RetypeWordGame to TwitchChatMonitor...');

    await this.chatMonitor.registerGame(this.gameId, {
      onConnect: this.handleConnect,
      onDisconnect: this.handleDisconnect,
      onChatMessage: this.handleChatMessage
    });

    this.isRunning = true;
    logger.info('RetypeWordGame registered and running');
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping RetypeWordGame...');
    this.isRunning = false;

    if (this.chatMonitor) {
      this.chatMonitor.unregisterGame(this.gameId);
    }

    logger.info('RetypeWordGame stopped');
  }
}

export default RetypeWordGame;
