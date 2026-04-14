import { parseAmount } from '../../../utils/parseAmount.js';

/**
 * !dice <bet|%|all>
 * Rolls a d6. Win doubles the bet. Luck shifts win probability.
 * Contributes to jackpot and can trigger it.
 */
export const diceCommand = {
  name: 'dice',
  aliases: new Set(['!dice', '!кубик', '!рулетка']),
  cooldown: 3_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, diceService, luckService, progression,
            jackpotService, template, config, db } = services;

    const fetchBal = () => messageService.getStreamElementsPoints(user);
    const bet = await parseAmount(args[0], fetchBal);

    if (!bet) {
      return reply(template.prepareMessage(config.messages.diceInvalidBet, {
        username: user, minBet: config.minBet, maxBet: config.maxBet
      }));
    }

    if (bet < config.minBet || bet > config.maxBet) {
      return reply(template.prepareMessage(config.messages.diceInvalidBet, {
        username: user, minBet: config.minBet, maxBet: config.maxBet
      }));
    }

    const balance = await fetchBal();
    if (balance == null) return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));
    if (balance < bet) {
      return reply(template.prepareMessage(config.messages.diceNoFunds, { username: user, balance, bet }));
    }

    const player = db.getOrCreate(user);
    const luck   = luckService.computeLuck(player);
    const result = diceService.roll(bet, luck);

    // ── Jackpot contribution ──────────────────────────────────────────────
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      jackpotService.contribute(jpId, bet);
    }

    // ── SE delta ──────────────────────────────────────────────────────────
    const se = await messageService.setStreamElementsReward(user, result.net);
    if (!se.success) {
      return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: se.response?.statusCode }));
    }

    const newBalance = balance + result.net;
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, result.xp);
    db.save(player);

    let msg;
    if (result.won) {
      msg = template.prepareMessage(config.messages.diceWin, {
        dice: result.diceValue, username: user, bet, win: result.win, balance: newBalance, xp: result.xp
      });
    } else {
      msg = template.prepareMessage(config.messages.diceLose, {
        dice: result.diceValue, username: user, bet, balance: newBalance, xp: result.xp
      });
    }

    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
    await reply(msg);

    // ── Jackpot trigger ───────────────────────────────────────────────────
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      if (jackpotService.tryTrigger(jpId, bet, luck)) {
        const won   = jackpotService.claim(jpId, user);
        const jpCfg = config.jackpots[jpId];
        const jp    = await messageService.setStreamElementsReward(user, won);
        if (jp.success) {
          await reply(template.formatJackpotWon({ username: user, amount: won, name: jpCfg.name, emoji: jpCfg.emoji }));
        }
      }
    }
  }
};
