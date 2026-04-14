import logger from '../../utils/logger.js';
import { MessageService }    from '../../services/MessageService.js';
import { TwitchChatMonitor } from '../../services/TwitchChatMonitor.js';
import { CommandBus }        from '../../services/CommandBus.js';
import {
  safeExecutionMiddleware,
  createGameEnabledMiddleware,
  createBotThrottleMiddleware,
} from '../../services/middlewares/index.js';
import { gameConfigRetypeWord } from '../gameConfig.js';
import {
  retypeWordEnabled, setRetypeWordEnabled,
  normalizeUsername, getLastMessage, setLastMessage, canUseMeh, canBotSpeak,
} from './state.js';
import { registerRetypeWordModule } from './retypeWordModule.js';

/** Lowercase EN → UKR layout map */
const EN_TO_UKR = {
  q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з','[':'х',']':'ї',
  a:'ф',s:'і',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',';':'ж',"'":'є',
  z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь',',':'б','.':'ю','/':'.','`':'ґ',
  Q:'Й',W:'Ц',E:'У',R:'К',T:'Е',Y:'Н',U:'Г',I:'Ш',O:'Щ',P:'З','{':'Х','}':'Ї',
  A:'Ф',S:'І',D:'В',F:'А',G:'П',H:'Р',J:'О',K:'Л',L:'Д',':':'Ж','"':'Є',
  Z:'Я',X:'Ч',C:'С',V:'М',B:'И',N:'Т',M:'Ь','<':'Б','>':'Ю','?':'.','~':'Ґ',
  '@':'"','$':';','^':':','&':'?',
};

/**
 * RetypeWordGame
 * Watches for !мeh / !бля — retypes the user's previous message from EN→UKR layout.
 * Architecture: CommandBus + middleware pipeline.
 */
class RetypeWordGame {
  constructor(config = gameConfigRetypeWord) {
    this.config    = config;
    this.gameId    = `retypeword-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.isRunning = false;

    this.messageService = new MessageService();
    this.chatMonitor    = TwitchChatMonitor.getInstance();

    const transcribe = (text) => this._transcribeEnToUkr(text);

    this.services = { config, transcribe };

    this.commandBus = new CommandBus({
      middlewares: [
        safeExecutionMiddleware,
        createGameEnabledMiddleware(() => retypeWordEnabled),
        createBotThrottleMiddleware(() => canBotSpeak(config.botMessages)),
      ],
    });

    registerRetypeWordModule({ bus: this.commandBus });

    this.handleConnect     = this.handleConnect.bind(this);
    this.handleDisconnect  = this.handleDisconnect.bind(this);
    this.handleChatMessage = this.handleChatMessage.bind(this);
  }

  handleConnect = async () => {
    logger.info('RetypeWordGame connected to Streamer.bot via TwitchChatMonitor');
    this.client = this.chatMonitor.getClient();
    if (this.client) this.messageService.setClient(this.client);
  }

  handleDisconnect = async () => {
    logger.info('RetypeWordGame disconnected from Streamer.bot');
  }

  handleChatMessage = async ({ message, username, userRole, isSubscriber }) => {
    if (!message || !username) return;

    const user = normalizeUsername(username);
    if (!user) return;

    const trimmed = message.trim();
    const parts   = trimmed.split(/\s+/);
    const command = (parts[0] ?? '').toLowerCase();

    // Capture PREVIOUS message BEFORE we overwrite it (meh reads what came before)
    const previousMessage = getLastMessage(user);

    // Sliding-window rate limit for meh command
    const isMehCmd = this.config.commands.meh.has(command);
    if (isMehCmd && !canUseMeh(user, this.config.rateLimit)) {
      // Silent drop on rate limit — no warning message to avoid spam
      setLastMessage(user, trimmed);
      return;
    }

    const ctx = {
      user,
      userRole,
      isSubscriber,
      command,
      args:            parts.slice(1),
      rawMessage:      trimmed,
      previousMessage, // special field consumed by mehCommand
      reply:           (msg) => this._send(msg),
      services:        this.services,
      logger,
    };

    await this.commandBus.execute(ctx);

    // Always update last message AFTER command execution
    setLastMessage(user, trimmed);
  }

  _transcribeEnToUkr(text) {
    if (!text || typeof text !== 'string') return text ?? '';

    const prefixes = this.config.transcription.channelEmojiPrefixes ?? ['moonos1'];
    const parts = text.replace(/'/g, "'").split(/(\s+)/);
    let out = '';
    let wordIndex = 0;

    for (const chunk of parts) {
      if (/^\s+$/.test(chunk)) { out += chunk; continue; }

      const isLeadingMention = wordIndex === 0 && chunk.startsWith('@');
      const isEmoji          = prefixes.some(p => chunk.startsWith(p));

      if (isLeadingMention || isEmoji) {
        out += chunk;
      } else {
        for (const ch of chunk) out += EN_TO_UKR[ch] ?? ch;
      }
      wordIndex++;
    }

    return out;
  }

  async _send(message) {
    if (!message || typeof message !== 'string') return;
    try {
      await this.messageService.sendTwitchMessage(message);
    } catch (error) {
      logger.error('RetypeWordGame: failed to send message', { error, message });
    }
  }

  setEnabled(enabled) { setRetypeWordEnabled(Boolean(enabled)); }
  getState() {
    return { isRunning: this.isRunning, enabled: retypeWordEnabled, gameId: this.gameId };
  }

  async connect() {
    if (this.isRunning) { logger.warn('RetypeWordGame already running'); return; }
    logger.info('Connecting RetypeWordGame to TwitchChatMonitor...');
    await this.chatMonitor.registerGame(this.gameId, {
      onConnect:     this.handleConnect,
      onDisconnect:  this.handleDisconnect,
      onChatMessage: this.handleChatMessage,
    });
    this.isRunning = true;
    logger.info('RetypeWordGame registered and running');
  }

  async stop() {
    if (!this.isRunning) return;
    logger.info('Stopping RetypeWordGame...');
    this.isRunning = false;
    this.chatMonitor.unregisterGame(this.gameId);
    logger.info('RetypeWordGame stopped');
  }
}

export default RetypeWordGame;
