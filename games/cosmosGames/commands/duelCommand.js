import { normalizeUsername } from '../state.js';
import { gameConfigCosmos } from './../cosmosConfig.js';

export const duelCommand = {
  name: 'duel',
  aliases: gameConfigCosmos.commands.duel,
  cooldown: 10_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, pvpService, template, config, recentChatters } = services;

    const targetRaw = args[0];
    let bet = parseInt(args[1], 10);
    if (bet <= 0) return;
    if (!bet) bet = config.minBet;

    let target = null;

    if (targetRaw) {
      target = normalizeUsername(targetRaw.startsWith('@') ? targetRaw.slice(1) : targetRaw);
      if (!target || target === user) {
        return reply(template.prepareMessage(config.messages.duelSelf, { sender: user }));
      }
    } else {
      const candidates = [...recentChatters.keys()].filter(u => u !== user);
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    console.log(targetRaw);
    console.log(target);
    console.log(...recentChatters.keys());
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
      }
      await reply(template.prepareMessage(config.messages.duelExpired, { sender: user, target }));
    }, config.duelExpiryMs);
  }
};
