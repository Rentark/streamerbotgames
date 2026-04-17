import { gameConfigCosmos } from './../cosmosConfig.js';

export const balanceCommand = {
  name: 'balance',
  aliases: gameConfigCosmos.commands.balance,
  cooldown: 5_000,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, luckService, progression, template, config, db } = services;

    const [balance, player] = await Promise.all([
      messageService.getStreamElementsPoints(user),
      Promise.resolve(db.getOrCreate(user)),
    ]);

    if (balance == null) {
      return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));
    }

    await reply(template.formatBalance({ ...player, stardust: balance, username: user }));
  }
};
