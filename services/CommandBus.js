import logger from '../utils/logger.js';

/**
 * CommandBus
 * Routes parsed chat input through a middleware pipeline to registered command handlers.
 *
 * Flow: Chat Input → Parser (game) → CommandBus.execute(ctx) → Middleware chain → Command.execute(ctx)
 *
 * Usage:
 *   const bus = new CommandBus({ middlewares: [safeExec, logging, cooldown, gameEnabled] });
 *   bus.register(spinCommand);
 *   await bus.execute(ctx);
 */
export class CommandBus {
  /**
   * @param {{ middlewares?: Function[] }} options
   */
  constructor({ middlewares = [] } = {}) {
    /** @type {Map<string, Object>} alias → command */
    this.commands = new Map();
    this.middlewares = middlewares;
  }

  /**
   * Register a command object.
   * The command's `aliases` (Set or Array) become the lookup keys.
   * @param {{ name: string, aliases: Set<string>|string[], cooldown?: number, execute: Function }} command
   */
  register(command) {
    if (!command?.aliases) {
      logger.warn('CommandBus: attempted to register command without aliases', { name: command?.name });
      return;
    }

    for (const alias of command.aliases) {
      this.commands.set(alias.toLowerCase(), command);
    }

    logger.debug('CommandBus: registered command', {
      name: command.name,
      aliases: [...command.aliases]
    });
  }

  /**
   * Execute a command for the given context.
   * Runs the full middleware chain before calling command.execute(ctx).
   * No-ops silently if the command is not registered.
   *
   * @param {import('./CommandContext.js').CommandContext} ctx
   * @returns {Promise<void>}
   */
  async execute(ctx) {
    const command = this.commands.get(ctx.command);
    if (!command) return;

    ctx.meta = command;

    let index = -1;

    const next = async () => {
      index++;
      const middleware = this.middlewares[index];

      if (middleware) {
        return middleware(ctx, next);
      }

      return command.execute(ctx);
    };

    await next();
  }

  /**
   * Returns true if any alias of the given message matches a registered command.
   * @param {string} commandStr - lowercased first word of a chat message
   * @returns {boolean}
   */
  hasCommand(commandStr) {
    return this.commands.has(commandStr);
  }

  /**
   * List all registered command names (deduplicated).
   * @returns {string[]}
   */
  listCommands() {
    const seen = new Set();
    const result = [];

    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        result.push(cmd.name);
      }
    }

    return result;
  }
}
