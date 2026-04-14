import { _startGame } from './blackjackCommand.js';

/**
 * !bjconfirm
 * Sent by the dealer/opponent to accept the blackjack challenge and start dealing.
 */
export const blackjackConfirmCommand = {
  name: 'bjconfirm',
  aliases: new Set(['!bjconfirm', '!bjyes', '!bjтак']),

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { blackjackSessions, blackjackService, template, config, sendMessage } = services;

    // Find a session where this user is the pending dealer
    let session = null;
    for (const s of blackjackSessions.values()) {
      if (s.state === 'waiting_confirm' && s.dealer === user) {
        session = s;
        break;
      }
    }

    if (!session) {
      return reply(template.prepareMessage(config.messages.bjNoChallengeForYou, { username: user }));
    }

    // Cancel the confirm timeout
    if (session.confirmTimeoutHandle) {
      clearTimeout(session.confirmTimeoutHandle);
      session.confirmTimeoutHandle = null;
    }

    await _startGame(session, services, sendMessage, config, template, blackjackService);
  }
};
