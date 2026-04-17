import { calcXp } from '../../../utils/calcXp.js';
import {
  _setTurnTimeout,
  _challengerStand,
  _dealerStand,
} from './blackjackCommand.js';
import { gameConfigCosmos } from './../cosmosConfig.js';

/**
 * !hit
 * Current player draws one card. If they bust, the other side wins immediately.
 * Streak protection is recorded here for challenger busts (bot mode).
 * XP = calcXp(config.blackjack.xpLose, bet) on bust.
 */
export const blackjackHitCommand = {
  name: 'hit',
  aliases: gameConfigCosmos.commands.hit,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { blackjackSessions, blackjackService, progression,
            messageService, streakService, template, config, db, sendMessage } = services;
    const bjCfg = config.blackjack;

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

    const hand = isChallengerTurn ? session.challengerHand : session.dealerHand;
    hand.push(blackjackService.dealCard(session.deck));

    const handSummary = blackjackService.formatHandSummary(hand);

    if (blackjackService.isBust(hand)) {
      const dealerName = session.botIsDealer ? 'Бот' : `@${session.dealer}`;
      const winnerName = isChallengerTurn ? dealerName : `@${session.challenger}`;
      const loserName  = isChallengerTurn ? `@${session.challenger}` : dealerName;

      // XP for bust (loser)
      const xpEarned = calcXp(bjCfg.xpLose, session.bet);

      await sendMessage(template.prepareMessage(config.messages.bjPlayerBust, {
        username:       loserName,
        hand:           handSummary,
        dealerUsername: winnerName,
        xp:             xpEarned,
      }));

      // SE transfer
      if (isChallengerTurn) {
        await messageService.setStreamElementsReward(session.challenger, -session.bet);
        if (!session.botIsDealer && session.dealer) {
          await messageService.setStreamElementsReward(session.dealer, session.bet);
        }
        // Challenger busted → loss streak (bot mode only)
        if (session.botIsDealer) streakService?.recordLoss(session.challenger);
      } else {
        // Dealer (PvP) busted → challenger wins, no streak recording
        await messageService.setStreamElementsReward(session.challenger, session.bet);
        if (session.dealer) {
          await messageService.setStreamElementsReward(session.dealer, -session.bet);
        }
      }

      // XP for loser
      const loserUsername = isChallengerTurn ? session.challenger : session.dealer;
      if (loserUsername) {
        const loserPlayer = db.getOrCreate(loserUsername);
        progression.addXP(loserPlayer, xpEarned);
        db.save(loserPlayer);
      }

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
  if (sessions.has(user)) {
    const s = sessions.get(user);
    if (s.state !== 'finished') return s;
  }
  for (const s of sessions.values()) {
    if (s.dealer === user && s.state !== 'finished') return s;
  }
  return null;
}
