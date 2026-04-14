export const jackpotCommand = {
  name: 'jackpot',
  aliases: new Set(['!jackpot', '!джекпот', '!jp']),
  cooldown: 10_000,

  async execute(ctx) {
    const { reply, services } = ctx;
    const { jackpotService, template } = services;

    const jackpots = jackpotService.getAllJackpots();
    if (!jackpots.length) return;

    // Send one message per jackpot (for multi-jackpot support)
    for (const jp of jackpots) {
      await reply(template.formatJackpotStatus(jp));
    }
  }
};
