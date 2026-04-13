import { knockCommand }    from './commands/knockCommand.js';
import { knockTopCommand } from './commands/knockTopCommand.js';

/**
 * registerKnockModule
 * @param {{ bus: import('../../services/CommandBus.js').CommandBus }} options
 */
export function registerKnockModule({ bus }) {
  bus.register(knockCommand);
  bus.register(knockTopCommand);
}
