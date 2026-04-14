import { _challengerStand, _dealerStand } from './blackjackCommand.js';

/**
 * !stand
 * Current player ends their turn without drawing another card.
 */
export const blackjackStandCommand = {
  name: 'stand',
  aliases: new Set(['!stand', '!bjstand', '!стоп', '!досить']),

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { blackjackSessions, blackjackService, template, config, sendMessage } = services;

    const session = _findSession(user, blackjackSessions);
    if (!session) {
      return reply(template.prepareMessage(config.messages.bjNoActiveGame, { username: user }));
    }

    const isChallengerTurn = session.state === 'challenger_turn' && user === session.challenger;
    const isDealerTurn     = session.state === 'dealer_turn'     && user === session.dealer;

    if (!isChallengerTurn && !isDealerTurn) {
      return reply(template.prepareMessage(config.messages.bjNotYourTurn, { username: user }));
    }

    if (session.turnTimeoutHandle) {
      clearTimeout(session.turnTimeoutHandle);
      session.turnTimeoutHandle = null;
    }

    if (isChallengerTurn) {
      await _challengerStand(session, services, sendMessage, config, template, blackjackService);
    } else {
      await _dealerStand(session, services, sendMessage, config, template, blackjackService);
    }
  }
};

function _findSession(user, sessions) {
  if (sessions.has(user)) {
    const s = sessions.get(user);
    if (s.state !== 'finished') return s;
  }
  for (const s of sessions.values()) {
    if (s.dealer === user && s.state !== 'finished') return s;
  }
  return null;
}
