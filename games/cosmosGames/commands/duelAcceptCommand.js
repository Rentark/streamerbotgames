import { gameConfigCosmos } from './../cosmosConfig.js';

export const duelAcceptCommand = {
  name: 'duelAccept',
  aliases: gameConfigCosmos.commands.duelAccept,

  async execute(ctx) {
    const { user, reply, services } = ctx;
    const { messageService, pvpService, progression, luckService, template, config, db } = services;

    const pending = pvpService.getPendingDuel(user);
    if (!pending) return;
    pvpService.clearDuel(user);

    const { challenger, bet } = pending;
    const [p1Bal, p2Bal] = await Promise.all([
      messageService.getStreamElementsPoints(challenger),
      messageService.getStreamElementsPoints(user),
    ]);

    if (p1Bal == null || p1Bal < bet) {
      return reply(template.prepareMessage(config.messages.duelNoFunds, { sender: challenger, bet }));
    }
    if (p2Bal == null || p2Bal < bet) {
      return reply(template.prepareMessage(config.messages.duelTargetNoFunds, { sender: challenger, target: user, bet }));
    }

    // Build minimal player objects for PvpService (needs luck data)
    const prog1 = db.getOrCreate(challenger);
    const prog2 = db.getOrCreate(user);
    prog1.username = challenger;
    prog2.username = user;

    // Shield check uses prog2
    const result = pvpService.resolveDuel(prog1, prog2, bet);

    if (result.blocked) {
      db.save(prog2); // shield consumed
      return reply(template.prepareMessage(config.messages.duelBlocked, {
        target: result.shieldHolder, sender: result.attacker
      }));
    }

    // Transfer points
    const [winnerSE, loserSE] = await Promise.all([
      messageService.setStreamElementsReward(result.winner, bet),
      messageService.setStreamElementsReward(result.loser, -bet),
    ]);
    if (!winnerSE.success || !loserSE.success) {
      return reply(template.prepareMessage(config.messages.rewardFail, { statusCode: 'SE' }));
    }

    // Award XP to winner
    const winnerProg = result.winner === challenger ? prog1 : prog2;
    const { leveled, newLevel, perksUnlocked } = progression.addXP(winnerProg, result.xp);
    db.save(prog1);
    db.save(prog2);

    let msg = template.prepareMessage(config.messages.duelWin, {
      winner: result.winner, loser: result.loser, bet, xp: result.xp
    });
    if (leveled) msg += template.formatLevelUp(newLevel, perksUnlocked);
    await reply(msg);
  }
};
