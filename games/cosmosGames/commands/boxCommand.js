export const boxCommand = {
  name: 'box',
  aliases: new Set(['!box', '!ящик', '!коробка']),
  cooldown: 10_000,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, boxService, progression, jackpotService,
            template, config, db, recentChatters } = services;

    const balance = await messageService.getStreamElementsPoints(user);
    if (balance == null) return reply(template.prepareMessage(config.messages.fetchFailed, { username: user }));

    const player = db.getOrCreate(user);
    const chattersForChaos = [...recentChatters.keys()].filter(u => u !== user);
    const result = boxService.openBox(player, balance, chattersForChaos);

    if (result.error === 'no_funds') {
      return reply(template.prepareMessage(config.messages.boxNoFunds, {
        username: user, cost: result.cost
      }));
    }

    // ── Jackpot contribution (using box cost as bet proxy) ────────────────
    const cost = boxService.getCost(player.level);
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      jackpotService.contribute(jpId, cost);
    }

    // ── Apply SE delta for opener ──────────────────────────────────────────
    if (result.selfDelta !== 0) {
      const se = await messageService.setStreamElementsReward(user, result.selfDelta);
      if (!se.success) {
        return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: se.response?.statusCode }));
      }
    }

    // ── Type-specific messaging ────────────────────────────────────────────
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

    // ── Jackpot trigger ────────────────────────────────────────────────────
    const player2 = db.getOrCreate(user); // re-read for updated level
    const luck = services.luckService?.computeLuck(player2) ?? 1;
    for (const jpId of Object.keys(config.jackpots ?? {})) {
      if (jackpotService.tryTrigger(jpId, cost, luck)) {
        const won   = jackpotService.claim(jpId, user);
        const jpCfg = config.jackpots[jpId];
        const jp    = await messageService.setStreamElementsReward(user, won);
        if (jp.success) {
          await reply(template.formatJackpotWon({ username: user, amount: won, name: jpCfg.name, emoji: jpCfg.emoji }));
        }
      }
    }
  }
};
