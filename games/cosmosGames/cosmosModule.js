import { spinCommand }             from './commands/spinCommand.js';
import { diceCommand }             from './commands/diceCommand.js';
import { duelCommand }             from './commands/duelCommand.js';
import { duelAcceptCommand }       from './commands/duelAcceptCommand.js';
import { duelDeclineCommand }      from './commands/duelDeclineCommand.js';
import { boxCommand }              from './commands/boxCommand.js';
import { balanceCommand }          from './commands/balanceCommand.js';
import { topCommand }              from './commands/topCommand.js';
import { perksCommand }            from './commands/perksCommand.js';
import { dailyCommand }            from './commands/dailyCommand.js';
import { shieldCommand }           from './commands/shieldCommand.js';
import { jackpotCommand }          from './commands/jackpotCommand.js';
import { blackjackCommand }        from './commands/blackjackCommand.js';
import { blackjackConfirmCommand } from './commands/blackjackConfirmCommand.js';
import { blackjackHitCommand }     from './commands/blackjackHitCommand.js';
import { blackjackStandCommand }   from './commands/blackjackStandCommand.js';

/**
 * registerCosmosModule
 * Binds all cosmos casino commands to the provided CommandBus.
 * Cooldowns from config are injected at registration time so the
 * cooldownMiddleware can read them via ctx.meta.cooldown.
 *
 * @param {{ bus: import('../../services/CommandBus.js').CommandBus, config: Object }} options
 */
export function registerCosmosModule({ bus, config }) {
  const commands = [
    { cmd: spinCommand,             key: 'spin'      },
    { cmd: diceCommand,             key: 'dice'      },
    { cmd: duelCommand,             key: 'duel'      },
    { cmd: duelAcceptCommand,       key: null        },
    { cmd: duelDeclineCommand,      key: null        },
    { cmd: boxCommand,              key: 'box'       },
    { cmd: balanceCommand,          key: 'balance'   },
    { cmd: topCommand,              key: 'top'       },
    { cmd: perksCommand,            key: 'perks'     },
    { cmd: dailyCommand,            key: 'daily'     },
    { cmd: shieldCommand,           key: 'shield'    },
    { cmd: jackpotCommand,          key: 'jackpot'   },
    { cmd: blackjackCommand,        key: 'blackjack' },
    { cmd: blackjackConfirmCommand, key: 'bjconfirm' },
    { cmd: blackjackHitCommand,     key: 'hit'       },
    { cmd: blackjackStandCommand,   key: 'stand'     },
  ];

  for (const { cmd, key } of commands) {
    bus.register({
      ...cmd,
      cooldown: key ? (config.cooldowns[key] ?? cmd.cooldown ?? 0) : (cmd.cooldown ?? 0),
    });
  }
}
