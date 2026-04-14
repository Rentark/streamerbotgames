import {
  _setTurnTimeout,
  _challengerStand,
  _dealerStand,
} from './blackjackCommand.js';

/**
 * !hit
 * Current player draws one card. If they bust, the other side wins immediately.
 */
export const blackjackHitCommand = {
  name: 'hit',
  aliases: new Set(['!hit', '!bjhit', '!ще']),

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { blackjackSessions, blackjackService, progression,
            messageService, template, config, db, sendMessage } = services;
    const bjCfg = config.blackjack;

    // Find the session this user belongs to (challenger or PvP dealer)
    const session = _findSession(user, blackjackSessions);
    if (!session) {
      return reply(template.prepareMessage(config.messages.bjNoActiveGame, { username: user }));
    }

    const isChallengerTurn = session.state === 'challenger_turn' && user === session.challenger;
    const isDealerTurn     = session.state === 'dealer_turn'     && user === session.dealer;

    if (!isChallengerTurn && !isDealerTurn) {
      return reply(template.prepareMessage(config.messages.bjNotYourTurn, { username: user }));
    }

    // Clear existing turn timer, it restarts below
    if (session.turnTimeoutHandle) {
      clearTimeout(session.turnTimeoutHandle);
      session.turnTimeoutHandle = null;
    }

    const hand = isChallengerTurn ? session.challengerHand : session.dealerHand;
    hand.push(blackjackService.dealCard(session.deck));

    const handSummary = blackjackService.formatHandSummary(hand);

    if (blackjackService.isBust(hand)) {
      // Bust message
      const dealerName = session.botIsDealer ? 'Бот' : `@${session.dealer}`;
      const winnerName = isChallengerTurn ? dealerName : `@${session.challenger}`;
      const loserName  = isChallengerTurn ? `@${session.challenger}` : dealerName;

      await sendMessage(template.prepareMessage(config.messages.bjPlayerBust, {
        username:     loserName,
        hand:         handSummary,
        dealerUsername: winnerName,
        xp:           bjCfg.xpLose,
      }));

      // SE transfer
      if (isChallengerTurn) {
        await messageService.setStreamElementsReward(session.challenger, -session.bet);
        if (!session.botIsDealer && session.dealer) {
          await messageService.setStreamElementsReward(session.dealer, session.bet);
        }
      } else {
        await messageService.setStreamElementsReward(session.challenger, session.bet);
        if (session.dealer) {
          await messageService.setStreamElementsReward(session.dealer, -session.bet);
        }
      }

      // XP
      const loserUsername = isChallengerTurn ? session.challenger : session.dealer;
      if (loserUsername) {
        const loserPlayer = db.getOrCreate(loserUsername);
        progression.addXP(loserPlayer, bjCfg.xpLose);
        db.save(loserPlayer);
      }

      // Cleanup
      if (session.turnTimeoutHandle) clearTimeout(session.turnTimeoutHandle);
      session.state = 'finished';
      blackjackSessions.delete(session.challenger);
      return;
    }

    // No bust — show updated hand and restart timer
    await sendMessage(template.prepareMessage(config.messages.bjPlayerHit, {
      username: `@${user}`,
      hand:     handSummary,
    }));

    _setTurnTimeout(session, services, sendMessage, config, template, blackjackService);
  }
};

function _findSession(user, sessions) {
  // Check as challenger
  if (sessions.has(user)) {
    const s = sessions.get(user);
    if (s.state !== 'finished') return s;
  }
  // Check as PvP dealer
  for (const s of sessions.values()) {
    if (s.dealer === user && s.state !== 'finished') return s;
  }
  return null;
}
