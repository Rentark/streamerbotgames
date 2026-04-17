import { gameConfigCosmos } from './../cosmosConfig.js';

export const perksCommand = {
  name: 'perks',
  aliases: gameConfigCosmos.commands.perks,
  cooldown: 5_000,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { template, db } = services;

    const player = db.getOrCreate(user);
    await reply(template.formatPerks({ ...player, username: user }));
  }
};
