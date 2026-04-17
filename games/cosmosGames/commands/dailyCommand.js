import { gameConfigCosmos } from './../cosmosConfig.js';

export const dailyCommand = {
  name: 'daily',
  aliases: gameConfigCosmos.commands.daily,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, progression, template, config, db } = services;

    const player = db.getOrCreate(user);
    const now = Date.now();
    const nextAt = player.last_daily + config.dailyCooldownMs;

    if (now < nextAt) {
      return reply(template.formatDailyCooldown({ username: user, remainingMs: nextAt - now }));
    }

    const { min, max } = config.dailyReward;
    let amount = Math.floor(min + Math.random() * (max - min + 1));

    if (player.level >= 15 && config.levelPerks[15]?.dailyBonus) {
      amount += config.levelPerks[15].dailyBonus;
    }

    const se = await messageService.setStreamElementsReward(user, amount);
    if (!se.success) {
      return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: se.response?.statusCode }));
    }

    player.last_daily = now;
    progression.addXP(player, 10);
    db.save(player);

    const balance = await messageService.getStreamElementsPoints(user);
    await reply(template.formatDailyReward({ username: user, amount, balance: balance ?? '?' }));
  }
};
