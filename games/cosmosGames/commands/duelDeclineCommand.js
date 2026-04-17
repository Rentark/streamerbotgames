import { gameConfigCosmos } from './../cosmosConfig.js';

export const duelDeclineCommand = {
  name: 'duelDecline',
  aliases: gameConfigCosmos.commands.duelDecline,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { pvpService, template, config } = services;

    const pending = pvpService.getPendingDuel(user);
    if (!pending) return;
    pvpService.clearDuel(user);

    await reply(template.prepareMessage(config.messages.duelDeclined, {
      target: user, sender: pending.challenger
    }));
  }
};
