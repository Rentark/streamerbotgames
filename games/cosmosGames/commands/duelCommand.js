import { normalizeUsername } from '../state.js';

export const duelCommand = {
  name: 'duel',
  aliases: new Set(['!duel', '!дуель']),
  cooldown: 10_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, pvpService, template, config } = services;

    const targetRaw = args[0];
    const bet = parseInt(args[1], 10);
    if (!targetRaw || isNaN(bet) || bet <= 0) return;

    const target = normalizeUsername(targetRaw.startsWith('@') ? targetRaw.slice(1) : targetRaw);
    if (!target || target === user) {
      return reply(template.prepareMessage(config.messages.duelSelf, { sender: user }));
    }

    const [senderBal, targetBal] = await Promise.all([
      messageService.getStreamElementsPoints(user),
      messageService.getStreamElementsPoints(target),
    ]);

    if (senderBal == null || senderBal < bet) {
      return reply(template.prepareMessage(config.messages.duelNoFunds, { sender: user, bet }));
    }
    if (targetBal == null || targetBal < bet) {
      return reply(template.prepareMessage(config.messages.duelTargetNoFunds, { sender: user, target, bet }));
    }

    pvpService.createChallenge(user, target, bet);
    await reply(template.prepareMessage(config.messages.duelChallenge, { sender: user, target, bet }));

    setTimeout(async () => {
      const pending = pvpService.getPendingDuel(target);
      if (pending?.challenger === user) {
        pvpService.clearDuel(target);
        await reply(template.prepareMessage(config.messages.duelExpired, { sender: user, target }));
      }
    }, config.duelExpiryMs);
  }
};
