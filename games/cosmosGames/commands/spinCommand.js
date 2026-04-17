import { parseAmount } from '../../../utils/parseAmount.js';
import { calcXp }      from '../../../utils/calcXp.js';
import { gameConfigCosmos } from './../cosmosConfig.js';
/**
 * !spin <bet|%|all>
 * Spins the 3-reel slot machine. Contributes to jackpot and can trigger it.
 *
 * Streak protection: if the user has `lossesBeforeBoost` consecutive losses,
 * their effective luck is boosted by `streakProtection.luckBoost` for this spin.
 * XP awarded = calcXp(payout.xp, bet)  — where payout.xp is a % of bet.
 */
export const spinCommand = {
  name: 'spin',
  aliases: gameConfigCosmos.commands.spin,
  cooldown: 3_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, slotsService, luckService, progression,
            jackpotService, streakService, template, config, db } = services;

    const fetchBal = () => messageService.getStreamElementsPoints(user);
    let bet = await parseAmount(args[0], fetchBal);

    if (!bet) {
      bet = config.minBet;
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

    // ── Streak protection: boost effective luck if needed ─────────────────
    const baseLuck    = luckService.computeLuck(player);
    const streakBonus = streakService.getLuckBonus(user);
    const effectiveLuck = Math.min(baseLuck + streakBonus, config.maxTotalLuck + streakBonus);

    const result = slotsService.spin(bet, effectiveLuck);

    // ── Update streak ─────────────────────────────────────────────────────
    if (result.win > 0) {
      streakService.recordWin(user);
    } else {
      streakService.recordLoss(user);
    }

    // ── Jackpot contribution (before payout) ─────────────────────────────
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      jackpotService.contribute(jpId, bet);
    }

    // ── Apply SE reward/deduction ─────────────────────────────────────────
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

    // ── XP: % of bet ──────────────────────────────────────────────────────
    const xpEarned = calcXp(result.xp, bet);
    const newBalance = balance + result.net;
    const { leveled, newLevel, perksUnlocked } = progression.addXP(player, xpEarned);
    db.save(player);

    let msg;
    if (result.win > 0) {
      msg = template.prepareMessage(config.messages.spinWin, {
        reels: result.reelDisplay, username: user, label: result.label ?? '',
        bet, win: result.win, balance: newBalance, xp: xpEarned
      });
    } else {
      msg = template.prepareMessage(config.messages.spinLose, {
        reels: result.reelDisplay, username: user, bet, balance: newBalance, xp: xpEarned
      });
    }

    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
    await reply(msg);

    // ── Jackpot trigger check ─────────────────────────────────────────────
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      if (jackpotService.tryTrigger(jpId, bet, effectiveLuck)) {
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
