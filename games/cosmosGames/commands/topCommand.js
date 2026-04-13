import { getTopByLevel } from '../../../db/queries.js';

export const topCommand = {
  name: 'top',
  aliases: new Set(['!ctop', '!космостоп']),
  cooldown: 15_000,

  async execute(ctx) {
    const { reply, services } = ctx;
    const { template, config } = services;

    const rows = getTopByLevel.all();
    if (!rows?.length) return reply(config.messages.noPlayers);
    await reply(template.formatLeaderboard(rows));
  }
};
