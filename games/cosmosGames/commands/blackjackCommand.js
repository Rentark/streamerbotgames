import { parseAmount } from '../../../utils/parseAmount.js';
import { calcXp }      from '../../../utils/calcXp.js';
import { normalizeUsername } from '../state.js';
import { gameConfigCosmos } from './../cosmosConfig.js';

/**
 * !bj <bet|%|all>          → Mode A: pick random chatter as dealer
 * !bj @user <bet|%|all>    → Mode B: challenge specific player
 *
 * Streak protection (bot-dealer mode only):
 *   When the challenger has >= lossesBeforeBoost consecutive losses,
 *   the bot dealer's hit-until threshold is reduced by
 *   `streakProtection.dealerHitUntilReduction`, making it stand earlier and
 *   more likely to bust.
 *
 * XP: all amounts are calcXp(config.blackjack.xpXxx, bet) — % of bet.
 */
export const blackjackCommand = {
  name: 'blackjack',
  aliases: gameConfigCosmos.commands.blackjack,
  cooldown: 0,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, blackjackSessions, blackjackService,
            template, config, recentChatters, sendMessage } = services;

    const bjCfg = config.blackjack;

    if (blackjackSessions.has(user)) {
      return reply(template.prepareMessage(config.messages.bjAlreadyActive, { username: user }));
    }

    // ── Parse args ────────────────────────────────────────────────────────
    let targetRaw = null;
    let betArg    = args[0];

    if (args[0]?.startsWith('@')) {
      targetRaw = args[0];
      betArg    = args[1];
    }

    const fetchBal = () => messageService.getStreamElementsPoints(user);
    let bet = await parseAmount(betArg, fetchBal);

    if (!bet) bet = bjCfg.minBet;

    if (bet < bjCfg.minBet || bet > bjCfg.maxBet) {
      return reply(template.prepareMessage(config.messages.bjInvalidBet, {
        username: user, minBet: bjCfg.minBet, maxBet: bjCfg.maxBet
      }));
    }

    const balance = await fetchBal();
    if (balance == null || balance < bet) {
      return reply(template.prepareMessage(config.messages.bjNoFunds, {
        username: user, balance: balance ?? 0, bet
      }));
    }

    // ── Determine target ──────────────────────────────────────────────────
    let target    = null;
    let botDealer = false;

    if (targetRaw) {
      target = normalizeUsername(targetRaw.startsWith('@') ? targetRaw.slice(1) : targetRaw);
      if (!target || target === user) {
        return reply(template.prepareMessage(config.messages.duelSelf, { sender: user }));
      }
      const targetBal = await messageService.getStreamElementsPoints(target);
      if (targetBal == null || targetBal < bet) {
        return reply(template.prepareMessage(config.messages.bjTargetNoFunds, { target, bet }));
      }
    } else {
      const candidates = [...recentChatters.keys()].filter(u => u !== user && !blackjackSessions.has(u));
      if (candidates.length) {
        target = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        botDealer = true;
      }
    }

    // ── Create pending session ────────────────────────────────────────────
    const session = {
      id:              `bj_${user}_${Date.now()}`,
      challenger:      user,
      dealer:          botDealer ? null : target,
      botIsDealer:     botDealer,
      bet,
      deck:            [],
      challengerHand:  [],
      dealerHand:      [],
      state:           botDealer ? 'dealing' : 'waiting_confirm',
      confirmTimeoutHandle: null,
      turnTimeoutHandle:    null,
    };

    blackjackSessions.set(user, session);

    if (botDealer) {
      await _startGame(session, services, sendMessage, config, template, blackjackService);
      return;
    }

    const msgKey = targetRaw ? 'bjChallengePvp' : 'bjChallengeRandom';
    await sendMessage(template.prepareMessage(config.messages[msgKey], {
      challenger: user, target, bet
    }));

    session.confirmTimeoutHandle = setTimeout(async () => {
      const s = blackjackSessions.get(user);
      if (!s || s.state !== 'waiting_confirm') return;
      s.botIsDealer = true;
      s.dealer      = null;
      await sendMessage(template.prepareMessage(config.messages.bjBotDealer, { dealer: target }));
      await _startGame(s, services, sendMessage, config, template, blackjackService);
    }, bjCfg.confirmTimeoutMs);
  }
};

// ── Game-start helper ─────────────────────────────────────────────────────────

export async function _startGame(session, services, sendMessage, config, template, blackjackService) {
  session.state = 'challenger_turn';
  session.deck  = blackjackService.createDeck();

  session.challengerHand.push(blackjackService.dealCard(session.deck));
  session.dealerHand.push(    blackjackService.dealCard(session.deck));
  session.challengerHand.push(blackjackService.dealCard(session.deck));
  session.dealerHand.push(    blackjackService.dealCard(session.deck));

  if (blackjackService.isBlackjack(session.challengerHand)) {
    await _resolveBlackjack(session, services, sendMessage, config, template, blackjackService);
    return;
  }

  const dealerName = session.botIsDealer ? 'Бот' : `@${session.dealer}`;
  await sendMessage(template.prepareMessage(config.messages.bjDeal, {
    challenger:     `@${session.challenger}`,
    challengerHand: blackjackService.formatHandSummary(session.challengerHand),
    dealerHand:     blackjackService.formatHandSummary(session.dealerHand, true),
    dealer:         dealerName,
  }));

  _setTurnTimeout(session, services, sendMessage, config, template, blackjackService);
}

// ── Turn timeout helper ───────────────────────────────────────────────────────

export function _setTurnTimeout(session, services, sendMessage, config, template, blackjackService) {
  if (session.turnTimeoutHandle) clearTimeout(session.turnTimeoutHandle);
  const { blackjackSessions } = services;

  session.turnTimeoutHandle = setTimeout(async () => {
    const s = blackjackSessions.get(session.challenger);
    if (!s || s.state === 'finished') return;

    const activeUser = s.state === 'challenger_turn' ? s.challenger : s.dealer;
    await sendMessage(template.prepareMessage(config.messages.bjTimeout, { username: `@${activeUser}` }));

    if (s.state === 'challenger_turn') {
      await _challengerStand(s, services, sendMessage, config, template, blackjackService);
    } else if (s.state === 'dealer_turn') {
      await _dealerStand(s, services, sendMessage, config, template, blackjackService);
    }
  }, config.blackjack.turnTimeoutMs);
}

// ── Challenger stands ─────────────────────────────────────────────────────────

export async function _challengerStand(session, services, sendMessage, config, template, blackjackService) {
  if (session.botIsDealer) {
    await _botDealerPlay(session, services, sendMessage, config, template, blackjackService);
  } else {
    session.state = 'dealer_turn';
    await sendMessage(template.prepareMessage(config.messages.bjDealerTurnPvp, {
      dealer: `@${session.dealer}`,
      hand:   blackjackService.formatHandSummary(session.dealerHand),
    }));
    _setTurnTimeout(session, services, sendMessage, config, template, blackjackService);
  }
}

// ── Dealer stands (PvP) ───────────────────────────────────────────────────────

export async function _dealerStand(session, services, sendMessage, config, template, blackjackService) {
  await _resolveGame(session, services, sendMessage, config, template, blackjackService);
}

// ── Bot dealer auto-play ──────────────────────────────────────────────────────

export async function _botDealerPlay(session, services, sendMessage, config, template, blackjackService) {
  // Reveal dealer hand
  await sendMessage(template.prepareMessage(config.messages.bjDealerReveal, {
    dealer: 'Бот',
    hand:   blackjackService.formatHandSummary(session.dealerHand),
  }));

  // ── Streak protection: reduce dealer hit-until threshold ──────────────
  const { streakService } = services;
  const reduction    = streakService?.getDealerThresholdReduction(session.challenger) ?? 0;
  const hitUntil     = Math.max(12, config.blackjack.dealerHitUntil - reduction);
  // floor at 12 so the dealer never stands on anything absurd

  // Hit until threshold
  while (blackjackService.botShouldHit(session.dealerHand, hitUntil)) {
    session.dealerHand.push(blackjackService.dealCard(session.deck));
    await sendMessage(template.prepareMessage(config.messages.bjDealerHit, {
      dealer: 'Бот',
      hand:   blackjackService.formatHandSummary(session.dealerHand),
    }));

    if (blackjackService.isBust(session.dealerHand)) {
      await _dealerBust(session, services, sendMessage, config, template, blackjackService);
      return;
    }
  }

  await _resolveGame(session, services, sendMessage, config, template, blackjackService);
}

// ── Dealer bust ───────────────────────────────────────────────────────────────

async function _dealerBust(session, services, sendMessage, config, template, blackjackService) {
  const { messageService, progression, streakService, db, blackjackSessions } = services;
  const bjCfg    = config.blackjack;
  const dealerName = session.botIsDealer ? 'Бот' : `@${session.dealer}`;

  await messageService.setStreamElementsReward(session.challenger, session.bet);

  const xpEarned = calcXp(bjCfg.xpWin, session.bet);
  const player = db.getOrCreate(session.challenger);
  const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
  db.save(player);

  // Record win for streak (bot mode only)
  if (session.botIsDealer) streakService?.recordWin(session.challenger);

  let msg = template.prepareMessage(config.messages.bjDealerBust, {
    dealer:     dealerName,
    hand:       blackjackService.formatHandSummary(session.dealerHand),
    challenger: `@${session.challenger}`,
    bet:        session.bet,
    xp:         xpEarned,
  });
  if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
  await sendMessage(msg);

  _cleanupSession(session, blackjackSessions);
}

// ── Blackjack (instant win) ───────────────────────────────────────────────────

async function _resolveBlackjack(session, services, sendMessage, config, template, blackjackService) {
  const { messageService, progression, streakService, db, blackjackSessions } = services;
  const bjCfg = config.blackjack;

  await messageService.setStreamElementsReward(session.challenger, session.bet);

  const xpEarned = calcXp(bjCfg.xpBlackjack, session.bet);
  const player = db.getOrCreate(session.challenger);
  const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
  db.save(player);

  if (session.botIsDealer) streakService?.recordWin(session.challenger);

  let msg = template.prepareMessage(config.messages.bjPlayerBlackjack, {
    username: `@${session.challenger}`,
    hand:     blackjackService.formatHandSummary(session.challengerHand),
    bet:      session.bet,
    xp:       xpEarned,
  });
  if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
  await sendMessage(msg);

  _cleanupSession(session, blackjackSessions);
}

// ── Final resolution ──────────────────────────────────────────────────────────

export async function _resolveGame(session, services, sendMessage, config, template, blackjackService) {
  const { messageService, progression, streakService, db, blackjackSessions } = services;
  const bjCfg    = config.blackjack;
  const winner   = blackjackService.determineWinner(session.challengerHand, session.dealerHand);
  const cVal     = blackjackService.getHandValue(session.challengerHand);
  const dVal     = blackjackService.getHandValue(session.dealerHand);
  const dealerName = session.botIsDealer ? 'Бот' : `@${session.dealer}`;

  let msg;

  if (winner === 'challenger') {
    await messageService.setStreamElementsReward(session.challenger, session.bet);
    if (!session.botIsDealer && session.dealer) {
      await messageService.setStreamElementsReward(session.dealer, -session.bet);
    }
    if (session.botIsDealer) streakService?.recordWin(session.challenger);

    const xpEarned = calcXp(bjCfg.xpWin, session.bet);
    const player = db.getOrCreate(session.challenger);
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
    db.save(player);

    msg = template.prepareMessage(config.messages.bjWinChallenger, {
      challenger: `@${session.challenger}`, challengerVal: cVal,
      dealer: dealerName, dealerVal: dVal, bet: session.bet, xp: xpEarned,
    });
    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);

  } else if (winner === 'dealer') {
    await messageService.setStreamElementsReward(session.challenger, -session.bet);
    if (!session.botIsDealer && session.dealer) {
      await messageService.setStreamElementsReward(session.dealer, session.bet);
    }
    if (session.botIsDealer) streakService?.recordLoss(session.challenger);

    const xpEarned = calcXp(bjCfg.xpLose, session.bet);
    const player = db.getOrCreate(session.challenger);
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
    db.save(player);

    msg = template.prepareMessage(config.messages.bjWinDealer, {
      dealer: dealerName, dealerVal: dVal,
      challenger: `@${session.challenger}`, challengerVal: cVal,
      bet: session.bet, xp: xpEarned,
    });
    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);

  } else {
    // Push — no SE change
    if (session.botIsDealer) streakService?.recordLoss(session.challenger);
    // push counts as a loss for streak purposes (no win = no reset)

    const xpEarned = calcXp(bjCfg.xpPush, session.bet);
    const player = db.getOrCreate(session.challenger);
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
    db.save(player);

    msg = template.prepareMessage(config.messages.bjPush, {
      challenger: `@${session.challenger}`, challengerVal: cVal,
      dealerVal: dVal, xp: xpEarned,
    });
    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
  }

  await sendMessage(msg);
  _cleanupSession(session, blackjackSessions);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function _cleanupSession(session, blackjackSessions) {
  if (session.confirmTimeoutHandle) clearTimeout(session.confirmTimeoutHandle);
  if (session.turnTimeoutHandle)    clearTimeout(session.turnTimeoutHandle);
  session.state = 'finished';
  blackjackSessions.delete(session.challenger);
}
