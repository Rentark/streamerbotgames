import { getUserId, normalizeUsername } from '../state.js';
import { incKnock } from '../../../db/queries.js';

export const knockCommand = {
  name: 'knock',
  aliases: new Set(['тик', '!тик']),
  cooldown: 0, // rate limiting handled by state.js canUseKnock (sliding window)

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    const { messageService, rewardService, template, config } = services;

    const senderId = getUserId(user);

    let targetName = user;
    if (args[0]?.startsWith('@')) {
      targetName = normalizeUsername(args[0].slice(1));
    }
    if (!targetName) return;

    let starsAmount = rewardService.generateRandomReward();

    // Special case: marseille_cat
    if (targetName.endsWith('_cat') && user !== targetName) {
      const catLines = config.messages.catKnockResponses;
      let catMsg = catLines[Math.floor(Math.random() * catLines.length)];

      if (rewardService.randomizer(0, 1, true) === 1) {
        catMsg += ` Кітик кусає у відповідь! Відкушено ${starsAmount} зіроч${rewardService.getRewardTypeEnd(starsAmount)}! moonos1Eat `;
        await messageService.setStreamElementsReward(targetName, starsAmount);
        await messageService.setStreamElementsReward(user, -starsAmount);
      }
      return reply(catMsg);
    }

    const targetId = getUserId(targetName);
    const result   = incKnock.get(senderId, targetId, starsAmount, Date.now());
    if (!result || result.count === undefined) return;

    let msg;
    if (user === targetName) {
      msg = template.formatKnockSelf({ sender: user, reward: starsAmount, count: result.count });
      const se = await messageService.setStreamElementsReward(user, starsAmount);
      if (!se.success) {
        return reply(template.prepareMessage(config.messages.rewardFailMessage, { statusCode: se.response?.statusCode }));
      }
    } else {
      msg = template.formatKnockOther({ sender: user, target: targetName, reward: starsAmount, count: result.count });
      const [se1] = await Promise.all([
        messageService.setStreamElementsReward(user, starsAmount),
        messageService.setStreamElementsReward(targetName, -starsAmount),
      ]);
      if (!se1.success) {
        return reply(template.prepareMessage(config.messages.rewardFailMessage, { statusCode: se1.response?.statusCode }));
      }
    }

    await reply(msg);
  }
};
