import { topKnockers } from '../../../db/queries.js';

export const knockTopCommand = {
  name: 'knockTop',
  aliases: new Set(['тиктоп', '!тиктоп']),
  cooldown: 15_000,

  async execute(ctx) {
    const { reply, services } = ctx;
    const { template, config } = services;

    const rows = topKnockers.all();
    if (!rows?.length) {
      return reply(template.prepareMessage(config.messages.noKnocks, {}));
    }

    const leaderboard = rows
      .map((r, i) => `${i + 1}. ${r.username} (${r.count}) (${r.stars})`)
      .join(' | ');

    await reply(template.prepareMessage(config.messages.leaderboard, { leaderboard }));
  }
};
