import { gameConfigCosmos } from './../cosmosConfig.js';

export const shieldCommand = {
  name: 'shield',
  aliases: gameConfigCosmos.commands.shield,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, template, config, db } = services;

    const player = db.getOrCreate(user);

    if (player.level < 10) {
      return reply(template.prepareMessage(config.messages.shieldLevelRequired, { username: user, level: player.level }));
    }
    if (player.shield) {
      return reply(template.prepareMessage(config.messages.shieldAlreadyActive, { username: user }));
    }

    const balance = await messageService.getStreamElementsPoints(user);
    if (balance == null) return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));
    if (balance < config.shieldCost) {
      return reply(template.prepareMessage(config.messages.shieldNoFunds, { username: user, cost: config.shieldCost }));
    }

    const se = await messageService.setStreamElementsReward(user, -config.shieldCost);
    if (!se.success) {
      return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: se.response?.statusCode }));
    }

    player.shield = 1;
    db.save(player);

    const newBalance = balance - config.shieldCost;
    await reply(template.prepareMessage(config.messages.shieldBought, {
      username: user, cost: config.shieldCost, balance: newBalance
    }));
  }
};
