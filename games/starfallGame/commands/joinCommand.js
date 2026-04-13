export const joinCommand = {
  name: 'join',
  // aliases pulled dynamically from config.gameJoinMessage in module registration
  aliases: new Set(['ловлю']),

  async execute(ctx) {
    const { user, services } = ctx;
    const { participantManager, messageService, config } = services;

    if (user === 'gous_stickmen' && !participantManager.hasParticipant('gous_stickmen')) {
      const lines = config.stickmenJoinMessage;
      await messageService.sendTwitchMessage(lines[Math.floor(Math.random() * lines.length)]);
    }

    participantManager.addParticipant(user);
  }
};
