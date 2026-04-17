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
 * Command → feature group mapping.
 *
 *  feature 'spin'      → spinCommand, jackpotCommand, balanceCommand,
 *                         perksCommand, topCommand
 *  feature 'dice'      → diceCommand
 *  feature 'duel'      → duelCommand, duelAcceptCommand, duelDeclineCommand,
 *                         shieldCommand
 *  feature 'box'       → boxCommand
 *  feature 'daily'     → dailyCommand
 *  feature 'blackjack' → blackjackCommand, blackjackConfirmCommand,
 *                         blackjackHitCommand, blackjackStandCommand
 *
 * The `feature` property is stamped onto the registered command object so
 * `createFeatureMiddleware` can read it via `ctx.meta.feature` at runtime.
 */
const COMMAND_REGISTRY = [
  // ── Spin group ────────────────────────────────────────────────────────────
  { cmd: spinCommand,             feature: 'spin',      key: 'spin'      },
  { cmd: jackpotCommand,          feature: 'spin',      key: 'jackpot'   },
  { cmd: balanceCommand,          feature: 'spin',      key: 'balance'   },
  { cmd: perksCommand,            feature: 'spin',      key: 'perks'     },
  { cmd: topCommand,              feature: 'spin',      key: 'top'       },

  // ── Dice group ────────────────────────────────────────────────────────────
  { cmd: diceCommand,             feature: 'dice',      key: 'dice'      },

  // ── Duel group ────────────────────────────────────────────────────────────
  { cmd: duelCommand,             feature: 'duel',      key: 'duel'      },
  { cmd: duelAcceptCommand,       feature: 'duel',      key: null        },
  { cmd: duelDeclineCommand,      feature: 'duel',      key: null        },
  { cmd: shieldCommand,           feature: 'duel',      key: 'shield'    },

  // ── Box group ─────────────────────────────────────────────────────────────
  { cmd: boxCommand,              feature: 'box',       key: 'box'       },

  // ── Daily group ───────────────────────────────────────────────────────────
  { cmd: dailyCommand,            feature: 'daily',     key: 'daily'     },

  // ── Blackjack group ───────────────────────────────────────────────────────
  { cmd: blackjackCommand,        feature: 'blackjack', key: 'blackjack' },
  { cmd: blackjackConfirmCommand, feature: 'blackjack', key: 'bjconfirm' },
  { cmd: blackjackHitCommand,     feature: 'blackjack', key: 'hit'       },
  { cmd: blackjackStandCommand,   feature: 'blackjack', key: 'stand'     },
];

/**
 * registerCosmosModule
 * Binds all cosmos casino commands to the provided CommandBus.
 *
 * For each command:
 *   - `cooldown`  is resolved from config.cooldowns[key] (ms)
 *   - `feature`   is stamped so createFeatureMiddleware can gate it at runtime
 *
 * @param {{ bus: import('../../services/CommandBus.js').CommandBus, config: Object }} options
 */
export function registerCosmosModule({ bus, config }) {
  for (const { cmd, feature, key } of COMMAND_REGISTRY) {
    bus.register({
      ...cmd,
      cooldown: key ? (config.cooldowns[key] ?? cmd.cooldown ?? 0) : (cmd.cooldown ?? 0),
      feature,   // read by createFeatureMiddleware via ctx.meta.feature
    });
  }
}
