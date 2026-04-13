import { joinCommand } from './commands/joinCommand.js';

/**
 * registerStarfallModule
 * The join command alias is taken from config.gameJoinMessage to stay in sync.
 *
 * @param {{ bus: import('../../services/CommandBus.js').CommandBus, config: Object }} options
 */
export function registerStarfallModule({ bus, config }) {
  bus.register({
    ...joinCommand,
    aliases: new Set([config.gameJoinMessage.toLowerCase().trim()]),
  });
}
