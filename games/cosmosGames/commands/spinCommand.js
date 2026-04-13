import { parseAmount } from '../../../utils/parseAmount.js';

/**
 * !spin <bet|%|all>
 * Spins the 3-reel slot machine and awards/deducts SE points.
 */
export const spinCommand = {
  name: 'spin',
  aliases: new Set(['!spin', '!крутити', '!спін']),
  cooldown: 3_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, slotsService, luckService, progression, template, config, db } = services;

    const fetchBal = () => messageService.getStreamElementsPoints(user);
    const bet = await parseAmount(args[0], fetchBal);

    if (!bet) {
      return reply(template.prepareMessage(config.messages.spinInvalidBet, {
        username: user, minBet: config.minBet, maxBet: config.maxBet
      }));
    }

    if (bet < config.minBet || bet > config.maxBet) {
      return reply(template.prepareMessage(config.messages.spinInvalidBet, {
        username: user, minBet: config.minBet, maxBet: config.maxBet
      }));
    }

    const balance = await fetchBal();
    if (balance == null) {
      return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));
    }
    if (balance < bet) {
      return reply(template.prepareMessage(config.messages.spinNoFunds, { username: user, balance, bet }));
    }

    const player = db.getOrCreate(user);
    const luck   = luckService.computeLuck(player);
    const result = slotsService.spin(bet, luck);

    // Apply SE reward/deduction
    if (result.win > 0) {
      const reward = await messageService.setStreamElementsReward(user, result.net);
      if (!reward.success) {
        return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: reward.response?.statusCode }));
      }
    } else {
      const deduct = await messageService.setStreamElementsReward(user, -bet);
      if (!deduct.success) {
        return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: deduct.response?.statusCode }));
      }
    }

    const newBalance = balance + result.net;
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, result.xp);
    db.save(player);

    let msg;
    if (result.win > 0) {
      msg = template.prepareMessage(config.messages.spinWin, {
        reels: result.reelDisplay, username: user, label: result.label ?? '',
        bet, win: result.win, balance: newBalance, xp: result.xp
      });
    } else {
      msg = template.prepareMessage(config.messages.spinLose, {
        reels: result.reelDisplay, username: user, bet, balance: newBalance, xp: result.xp
      });
    }

    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
    await reply(msg);
  }
};
