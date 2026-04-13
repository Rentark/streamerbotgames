export const boxCommand = {
  name: 'box',
  aliases: new Set(['!box', '!ящик', '!коробка']),
  cooldown: 10_000,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, boxService, progression, template, config, db, recentChatters } = services;

    const balance = await messageService.getStreamElementsPoints(user);
    if (balance == null) return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));

    const player = db.getOrCreate(user);

    // recentChatters excludes the opener
    const chattersForChaos = [...recentChatters.keys()].filter(u => u !== user);
    const result = boxService.openBox(player, balance, chattersForChaos);

    if (result.error === 'no_funds') {
      return reply(template.prepareMessage(config.messages.boxNoFunds, {
        username: user, cost: result.cost
      }));
    }

    // Apply SE delta for opener
    if (result.selfDelta !== 0) {
      const se = await messageService.setStreamElementsReward(user, result.selfDelta);
      if (!se.success) {
        return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: se.response?.statusCode }));
      }
    }

    // Handle type-specific messaging
    if (result.type === 'luck_boost') {
      db.save(player);
      return reply(template.prepareMessage(config.messages.boxLuckBoost, {
        username: user, baseLuck: player.base_luck.toFixed(2)
      }));
    }

    if (result.type === 'shield') {
      db.save(player);
      return reply(template.prepareMessage(config.messages.boxShield, { username: user }));
    }

    if (result.type === 'chaos' && result.chaosChatters?.length) {
      // Fetch balances and deduct concurrently (fire-and-forget result on individual failures)
      const deductions = result.chaosChatters.map(async (chatter) => {
        const bal = await messageService.getStreamElementsPoints(chatter);
        if (bal == null || bal <= 0) return;
        const loss = Math.max(1, Math.floor(bal * (result.chaosDeductPercent / 100)));
        await messageService.setStreamElementsReward(chatter, -loss);
      });
      await Promise.allSettled(deductions);

      const chatterList = result.chaosChatters.map(c => `@${c}`).join(', ');
      db.save(player);
      return reply(template.prepareMessage(config.messages.boxChaos, {
        username: user, chatters: chatterList, percent: result.chaosDeductPercent
      }));
    }

    progression.addXP(player, 15);
    db.save(player);
    const newBalance = balance + result.selfDelta;
    await reply(template.prepareMessage(config.messages.boxResult, {
      username: user, emoji: result.emoji, result: result.label, balance: newBalance
    }));
  }
};
