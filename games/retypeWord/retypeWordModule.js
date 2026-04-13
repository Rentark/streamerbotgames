import { mehCommand } from './commands/mehCommand.js';

/**
 * registerRetypeWordModule
 * @param {{ bus: import('../../services/CommandBus.js').CommandBus }} options
 */
export function registerRetypeWordModule({ bus }) {
  bus.register(mehCommand);
}
