# Streamer.bot Games

## Overview

Streamer.bot Games is a Node.js application providing interactive Twitch chat games for streamers. It integrates with Streamer.bot for chat I/O and StreamElements for point economy. The application includes four games — Knock Game, Retype Word Game, Starfall Game, and Cosmos Casino — all sharing a single WebSocket connection to Streamer.bot via a singleton `TwitchChatMonitor`.

All games use a **CommandBus + middleware pipeline** architecture: incoming chat messages are parsed into a context object, routed through middleware (safe execution, logging, enable-flag guard, bot throttle, per-command cooldown), and dispatched to self-contained command handlers.

---

## Features

### Games

| Game | Trigger | Economy |
|---|---|---|
| **Knock Game** (`тик`) | Users knock themselves or others; gains/loses SE points | StreamElements |
| **Retype Word** (`!бля`) | Transcribes a message typed on English layout to Ukrainian | None |
| **Starfall** (scheduled) | Timed loot drop; players type a join word; winners share a reward | StreamElements (multi) |
| **Cosmos Casino** (`!spin`, `!dice`, `!duel`, `!box`, …) | Full casino suite with slots, dice, PvP duels, mystery boxes, progression | StreamElements |

### Architecture

- **CommandBus** — Routes parsed chat commands through a configurable middleware chain to registered command handlers. Each game constructs its own bus with its own middleware stack.
- **Middleware pipeline** — `safeExecutionMiddleware → loggingMiddleware → gameEnabledMiddleware → botThrottleMiddleware → cooldownMiddleware`. Each middleware is a pure function `(ctx, next) => Promise<void>`.
- **Command modules** — Each game registers its commands via a `register*Module({ bus, config })` function. Commands are plain objects `{ name, aliases, cooldown?, execute(ctx) }`.
- **Context object (`ctx`)** — Passed through the entire pipeline. Contains `user`, `command`, `args`, `reply(msg)`, `services`, `logger`, and any game-specific fields (e.g. `previousMessage` in RetypeWord).
- **Singleton TwitchChatMonitor** — One WebSocket connection to Streamer.bot shared by all games. Each game registers/unregisters independently; the connection closes only when no games remain.

### Services

| Service | Responsibility |
|---|---|
| `MessageService` | Send Twitch chat messages; read/write StreamElements points |
| `RewardService` | Generate random reward amounts and winner counts |
| `TwitchChatMonitor` | Singleton Streamer.bot WebSocket; fan-out to registered games |
| `HttpControlService` | REST API for game enable/disable |
| `LLMConnectorService` | Google Gemini integration for Retype Word content moderation |
| `LuckService` | Compute effective luck; apply luck to weighted outcome tables |
| `ProgressionService` | XP addition, level-up logic, perk lookups |
| `SlotsService` | 3-reel slot machine with per-spin reel builder |
| `DiceService` | Dice/roulette with luck-adjusted win probability |
| `PvpService` | Duel challenge lifecycle (pending map, shield check, luck resolution) |
| `MysteryBoxService` | Mystery box with luck-weighted outcomes including chaos |

### Infrastructure

- **Database** — SQLite (`better-sqlite3`) for Knock leaderboard and Cosmos progression (level, XP, luck, shield, daily timestamp). StreamElements is the authoritative source for point balances.
- **Logging** — Winston; console + rotating file (`logs/game.log`).
- **HTTP Control** — Simple Node `http` server on `127.0.0.1:3001`; all routes are `GET` endpoints.
- **WebSocket** — `@streamerbot/client` for Streamer.bot integration.

---

## Installation

```bash
# Requires Node.js 20+
npm install
```

Copy `.env.example` to `.env` and fill in:

```env
STREAMELEMENTS_ACCOUNT_ID=your_channel_id
STREAMELEMENTS_TOKEN=your_jwt_token
GEMINI_API_KEY=your_gemini_key        # for Retype Word moderation
# Optional additional Gemini keys for rotation:
# GEMINI_API_KEYS=key1,key2,key3
```

---

## Usage

### Starting the Server

```bash
# Windows (background, logs to node.log)
startGameServer.bat

# Stop
stopGameServer.bat

# Direct
node index.js
```

### HTTP Control API

All endpoints are `GET`. The server listens on `http://127.0.0.1:3001`.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /status` | Status of all games |
| `GET /knock/enable` | Enable Knock Game |
| `GET /knock/disable` | Disable Knock Game |
| `GET /knock/status` | Knock Game status |
| `GET /starfall/enable` | Enable Starfall (allows new games to start) |
| `GET /starfall/disable` | Disable Starfall |
| `GET /starfall/start` | Start a new Starfall round |
| `GET /starfall/status` | Starfall status |
| `GET /retype/enable` | Enable Retype Word |
| `GET /retype/disable` | Disable Retype Word |
| `GET /retype/status` | Retype Word status |
| `GET /cosmos/enable` | Enable Cosmos Casino |
| `GET /cosmos/disable` | Disable Cosmos Casino |
| `GET /cosmos/status` | Cosmos Casino status |
| `GET /games/enable-all` | Enable all games |
| `GET /games/disable-all` | Disable all games |
| `GET /cosmos/features` | Snapshot of all feature flags |
| `GET /cosmos/features/enable-all` | Enable every feature group |
| `GET /cosmos/features/disable-all` | Disable every feature group |
| `GET /cosmos/feature/<name>/enable` | Enable a single feature (e.g. `/cosmos/feature/spin/enable`) |
| `GET /cosmos/feature/<name>/disable` | Disable a single feature |
| `GET /cosmos/feature/<name>/status` | Check whether a feature is enabled |

## Cosmos Casino

A space-themed point casino. All balances are StreamElements points. Progression (level, XP, luck, shield, daily cooldown) is tracked locally in SQLite — independent of the point economy.

### Commands

| Command | Aliases | Description |
|---|---|---|
| `!spin <bet>` | `!крутити`, `!спін` | Spin the 3-reel slot machine |
| `!dice <bet>` | `!кубик`, `!рулетка` | Roll a die — win doubles your bet |
| `!duel @user <bet>` | `!дуель` | Challenge another chatter to a duel |
| `!accept` | `!прийняти` | Accept a pending duel challenge |
| `!decline` | `!відхилити` | Decline a pending duel challenge |
| `!box` | `!ящик`, `!коробка` | Open a mystery box |
| `!balance` | `!зірки`, `!баланс` | Check your balance, level, XP, and luck |
| `!perks` | `!перки`, `!рівень` | View your active level perks |
| `!daily` | `!щоденно` | Claim daily reward (24h cooldown) |
| `!shield` | `!щит` | Purchase a duel shield (level 10+) |
| `!ctop` | `!космостоп` | Top players leaderboard (by level) |

### Bet Syntax

`!spin` and `!dice` accept three bet formats:

| Format | Example | Result |
|---|---|---|
| Flat amount | `!spin 500` | Bet exactly 500 points |
| Percentage | `!spin 50%` | Bet 50% of current balance |
| All-in | `!spin all` | Bet entire balance |

Minimum bet: configurable via `config.minBet`. Maximum bet: `config.maxBet`.

### Slots — 3-Reel System

Each spin independently picks one symbol per reel from the symbol pool. Symbol weights are luck-adjusted before each pick — higher luck shifts the distribution toward rarer symbols.

Payout is determined by the reel combination:

| Combination | Example | Multiplier |
|---|---|---|
| Triple Jackpot | 🌟🌟🌟 | 20× |
| Triple Diamond | 💎💎💎 | 10× |
| Triple Nebula | 🌌🌌🌌 | 6× |
| Any Triple | ☄️☄️☄️ | 5× |
| Double Jackpot | 🌟?🌟 | 3× |
| Double Diamond | 💎?💎 | 2× |
| Any Double | ⭐?⭐ | 1.5× |
| No match | — | 0× (lose bet) |

Symbol pool and payout multipliers are fully configurable in `cosmosConfig.js`.

### Dice / Roulette

Base win chance: 45%. Win doubles the bet (2×). Luck can add up to +10% extra win probability. Optionally, luck can also scale the win amount (disabled by default — set `dice.luckWinAmountBonus: true` in config).

### PvP Duels

1. Challenger types `!duel @target <bet>` — both must have sufficient points.
2. Target has 60 seconds to respond with `!accept` or `!decline`.
3. On accept: if target has a shield, the shield blocks and is consumed.
4. Otherwise: both players roll `random() × effectiveLuck`. Higher roll wins the bet.
5. Winner gets `+bet` points from SE; loser gets `-bet` points.

### Mystery Box

Costs `config.boxCost` points. Possible outcomes:

| Outcome | Effect |
|---|---|
| Small win | +75 points |
| Big win | +300 points |
| Jackpot | +1000 points |
| Lose | -50 points |
| Luck boost | Permanently raises `base_luck` by 0.05 (capped at `maxBaseLuck`) |
| Shield | Activates a duel shield |
| **Chaos** | Deducts a percentage of SE points from recent chatters |

**Chaos outcome:** By default, up to 5 random chatters seen in the last 30 minutes each lose 5% of their SE points. Fully configurable:

```js
chaosConfig: {
  affectAll:           false,   // true = hit all recent chatters
  maxChattersAffected: 5,       // used when affectAll is false
  deductPercent:       5,       // % deducted from each affected chatter
  recentWindowMs:      30 * 60 * 1000,
}
```

### Progression

Players level up by earning XP from game actions. XP formula: `floor(100 × 1.2^level)`.

| Level | Perk |
|---|---|
| 5 | +5% luck |
| 10 | +5% luck, unlocks `!shield` |
| 15 | +5% luck, +50 to daily reward |
| 20 | +10% luck, double XP earned |
| 25 | +5% luck, mystery box costs 50% less |
| 30 | +10% luck, COSMIC TIER 🌌 |

Luck multiplies the weight of winning outcomes in slots and shifts win probability in dice. Total effective luck is capped at `maxTotalLuck` (default 2.0).

---

## Knock Game

Users type `тик` or `!тик` (optionally followed by `@username`) to "knock" themselves or a target. Each knock records a count in SQLite and adds/deducts SE points. Rate limited to 3 uses per 60-second window per user.

Special case: knocking any `*_cat` username triggers a cat-specific response. With 50% probability the cat bites back, reversing the point transfer.

`!тиктоп` / `тиктоп` — shows the top 10 knockers by count and total stars.

---

## Retype Word Game

Users type `!бля`, `бля`, or `!мех` after sending a message on the wrong keyboard layout (English layout when trying to type Ukrainian). The bot detects the layout mismatch, transcribes the previous message EN→UKR, validates it through Google Gemini for content policy compliance, and replies with the corrected text.

Transcription skips leading `@mentions` and channel emotes (configurable prefix list). Rate limited to 3 uses per 60-second window per user.

---

## Starfall Game

A timed loot drop started via the HTTP API (`GET /starfall/start`). Players join by typing the join word (default: `ловлю`). After the configured game length, 1–2 winners are randomly selected and awarded SE points via the bulk StreamElements API.

Notification intervals (countdown messages) and game length are configurable in `gameConfig.js`.

---

## Project Structure

```
streamerbotgames/
├── index.js                          # Entry point
├── config/
│   └── config.js                     # HTTP server config, control message templates
├── db/
│   ├── db.js                         # SQLite connection + table initialization
│   └── queries.js                    # Prepared statements (users, knocks, cosmos)
├── games/
│   ├── gameConfig.js                 # Per-game configuration objects
│   ├── gameState.js                  # Centralized enable/disable flags
│   ├── knockGame/
│   │   ├── knockGame.js              # KnockGame class (CommandBus)
│   │   ├── knockModule.js            # Registers knock commands on bus
│   │   ├── state.js                  # Rate limiting, user ID cache
│   │   └── commands/
│   │       ├── knockCommand.js
│   │       └── knockTopCommand.js
│   ├── retypeWord/
│   │   ├── retypeWord.js             # RetypeWordGame class (CommandBus)
│   │   ├── retypeWordModule.js       # Registers meh command on bus
│   │   ├── state.js                  # Per-user last-message cache, rate limiting
│   │   └── commands/
│   │       └── mehCommand.js
│   ├── starfallGame/
│   │   ├── starfallGame.js           # StarfallGame class (CommandBus)
│   │   ├── starfallModule.js         # Registers join command on bus
│   │   └── commands/
│   │       └── joinCommand.js
│   └── cosmosGames/
│       ├── cosmosGame.js             # CosmosGame class (CommandBus)
│       ├── cosmosConfig.js           # Full casino configuration
│       ├── cosmosModule.js           # Registers all casino commands on bus
│       ├── state.js                  # Rate limiting, enable flag
│       └── commands/
│           ├── spinCommand.js
│           ├── diceCommand.js
│           ├── duelCommand.js
│           ├── duelAcceptCommand.js
│           ├── duelDeclineCommand.js
│           ├── boxCommand.js
│           ├── balanceCommand.js
│           ├── topCommand.js
│           ├── perksCommand.js
│           ├── dailyCommand.js
│           └── shieldCommand.js
├── managers/
│   └── ParticipantManager.js         # Starfall participant set + winner selection
├── routes/
│   └── controlRoutes.js              # HTTP route handlers
├── services/
│   ├── CommandBus.js                 # Command router + middleware runner
│   ├── middlewares/
│   │   └── index.js                  # safeExecution, logging, cooldown, enabled, throttle
│   ├── HttpControlService.js
│   ├── LLMConnectorService.js        # Gemini integration with key rotation + fallback
│   ├── MessageService.js             # Twitch messages + SE points read/write
│   ├── RewardService.js              # Random reward generation
│   ├── TwitchChatMonitor.js          # Singleton Streamer.bot WebSocket
│   └── cosmos/
│       ├── DiceService.js
│       ├── LuckService.js
│       ├── MysteryBoxService.js
│       ├── ProgressionService.js
│       ├── PvpService.js
│       └── SlotsService.js
├── utils/
│   ├── GameTimer.js
│   ├── logger.js
│   ├── parseAmount.js                # Parses flat/percent/all bet formats
│   ├── sendRequest.js
│   └── messageTemplates/
│       ├── CosmosMessageTemplate.js
│       ├── DefaultMessageTemplate.js
│       ├── KnockMessageTemplate.js
│       └── StarfallMessageTemplate.js
├── logs/
├── startGameServer.bat
└── stopGameServer.bat
```

---

## Component Relationships

- `index.js` initializes all four games, sets their clients from the shared monitor, and starts the control HTTP server.
- `TwitchChatMonitor` (singleton) maintains one Streamer.bot WebSocket and fans out `ChatMessage` events to all registered games in parallel.
- Each game constructs a `CommandBus` with its own middleware stack and calls `register*Module()` to mount its command handlers.
- All games call `MessageService.sendTwitchMessage()` for chat output. Cosmos and Starfall also call `MessageService.setStreamElementsReward()` / `setStreamElementsRewardMulti()` for point economy. Cosmos additionally calls `MessageService.getStreamElementsPoints()` to read balances for bet validation and percentage parsing.
- `parseAmount(input, fetchBalance)` resolves flat numbers, `"50%"`, and `"all"` into integer bet amounts, calling `fetchBalance()` only when needed.
- `LuckService` is consumed by `SlotsService`, `DiceService`, `PvpService`, and `MysteryBoxService`. Each service is pure and stateless — callers handle persistence and SE API calls.
- `MysteryBoxService.openBox()` returns a result descriptor (type, selfDelta, chaosChatters, etc.). The `boxCommand` handler executes all SE calls and sends the appropriate message.
- `ProgressionService.addXP()` mutates a player object in place and returns `{ leveled, newLevel, perksUnlocked }`. If `leveled` is true, handlers append a level-up suffix to the reply.
- `PvpService` holds an in-memory `pendingDuels` map. Duels auto-expire via `setTimeout`; the `duelCommand` fires the expiry callback and notifies chat.
- `cosmosGame.recentChatters` is a `Map<username, lastSeenAt>` updated on every chat message. `boxCommand` passes this map to `MysteryBoxService.openBox()` for the chaos victim list.
- The HTTP control server (`routes/controlRoutes.js`) calls `setEnabled()` on game instances and the `setXxxEnabled()` functions from `gameState.js` to toggle flags read by `createGameEnabledMiddleware`.

---

## Adding a New Game

1. Create `games/myGame/` with `myGame.js`, `state.js`, `myModule.js`, and a `commands/` folder.
2. In `myGame.js`, construct a `CommandBus` and call `registerMyModule({ bus, config })`.
3. In `myModule.js`, call `bus.register()` for each command object.
4. Register the game in `index.js` (instantiate + `connect()`).
5. Add enable/disable flag to `games/gameState.js`.
6. Add HTTP routes in `routes/controlRoutes.js`.
7. Add control messages in `config/config.js`.

---

## Adding a New Cosmos Command

1. Create `games/cosmosGames/commands/myCommand.js`:

```js
export const myCommand = {
  name: 'myCommand',
  aliases: new Set(['!mycommand', '!мійкоманд']),
  cooldown: 5_000,

  async execute(ctx) {
    const { user, args, reply, services } = ctx;
    // services: messageService, slotsService, diceService, pvpService,
    //           boxService, progression, luckService, template, config, db
    await reply(`Hello ${user}!`);
  }
};
```

2. Import and register it in `cosmosModule.js`:

```js
import { myCommand } from './commands/myCommand.js';

export function registerCosmosModule({ bus, config }) {
  // ... existing commands ...
  bus.register({ ...myCommand, cooldown: config.cooldowns.myCommand ?? myCommand.cooldown });
}
```

3. Add a cooldown entry in `cosmosConfig.js` under `cooldowns`.
4. Add message templates under `messages` in `cosmosConfig.js`.

---

## Configuration Reference

### `gameConfig.js` — Knock Game

| Key | Description |
|---|---|
| `rateLimit.windowMs` | Sliding window duration (ms) |
| `rateLimit.maxUses` | Max knocks per window per user |
| `warningRateLimit` | Global throttle for rate-limit warning messages |
| `botMessages` | Bot reply throttle (sliding window) |
| `minReward` / `maxReward` | SE point range per knock |
| `commands.knock` | Array of trigger words |
| `commands.knockTop` | Array of leaderboard trigger words |

### `cosmosConfig.js` — Cosmos Casino

| Key | Description |
|---|---|
| `minBet` / `maxBet` | Bet bounds for spin and dice |
| `cooldowns.*` | Per-command cooldown in ms (read by `cooldownMiddleware`) |
| `reels.symbols` | Symbol pool: `{ id, emoji, weight, dust }` |
| `reels.payouts` | Payout table: `{ mult, xp, label }` keyed by combination |
| `dice.winChance` | Base win probability (0–1) |
| `dice.winMult` | Win payout multiplier |
| `dice.maxLuckWinChanceBonus` | Max extra win chance from luck |
| `dice.luckWinAmountBonus` | Whether luck scales win amount |
| `mysteryBox.chaosConfig` | Chaos victim count, deduct %, time window |
| `levelPerks` | Object keyed by level → `{ luckBonus, description, ... }` |
| `xpFormula` | `{ base, multiplier }` for level-up XP thresholds |

---

## Dependencies

| Package | Purpose |
|---|---|
| `@google/genai` | Gemini API for Retype Word content moderation |
| `@streamerbot/client` | Streamer.bot WebSocket client |
| `better-sqlite3` | Synchronous SQLite driver |
| `winston` | Structured logging |
| `ws` | WebSocket (peer dep) |

---

## Development

### Testing

```bash
node test/GameTest.js
```

### Logging

Logs are written to `logs/game.log`. Set `level` in `utils/logger.js` to control verbosity (`debug` / `info`).

### Database

SQLite database is created automatically at `bot.db` in the project root. Tables are initialized idempotently on startup.

---

## Cosmos Casino — New Features (patch)

### Centralized Currency Config

All games now share a single currency definition in `config/currencyConfig.js`.

```js
// config/currencyConfig.js
export const currencyConfig = {
  name: 'зірочки',
  partialName: 'зіроч',
  endings: { '0': 'ок', '1': 'ку', '2-4': 'ки' },
  symbol: '✨',
};

export function formatCurrency(amount) { … } // "500 зірочок"
export function getCurrencyEnding(amount) { … } // "ок", "ку", "ки"
```

`gameConfig.js` (Knock, Starfall) imports `rewardTypes` from this file.
`cosmosConfig.js` imports `currencyConfig` and exposes it as `config.currency`.
`CosmosMessageTemplate` auto-injects `{c}` = `currencyConfig.symbol` (`✨`) into every template.
To rename the currency sitewide, change `currencyConfig.js` only.

---

### Slots — Outcome-first reel builder

The slot machine has been redesigned with two key changes:

**1. Weights moved to payouts (not symbols)**

Win rates are now directly readable in `cosmosConfig.js`:

```js
reels: {
  symbols: [
    { id: 'jackpot', emojis: ['🌟', '⭐'],    dust: false },
    { id: 'diamond', emojis: ['💎', '💍'],    dust: false },
    …
  ],
  payouts: {
    triple_jackpot: { mult: 20, xp: 100, weight: 1,   label: '…' },
    triple_diamond: { mult: 10, xp: 50,  weight: 3,   label: '…' },
    none:           { mult: 0,  xp: 2,   weight: 250, label: null },
  },
}
```

`weight` on `none` / losing outcomes is penalised by luck; winning outcome weights are boosted.

**2. Per-category emoji arrays**

Each symbol category holds multiple `emojis`. The machine picks ONE emoji per category per spin so that:
- `triple_diamond` always shows 3 of the *same* emoji (all `💎` or all `💍`, never mixed).
- `double_diamond` always shows 2 matching + 1 from a different category.
- `triple_any` / `double_any` use categories that don't have their own specific payout entry.

---

### Progressive Jackpot

A progressive jackpot pool is fed by every `!spin`, `!dice`, and `!box` bet (1% of bet by default).

| Command | Aliases | Description |
|---|---|---|
| `!jackpot` | `!джекпот`, `!jp` | Show current jackpot amount(s) |

The jackpot triggers randomly (base 0.1% per bet, scaled by bet size and luck). On trigger, the pool is awarded to the player via SE and reset to the seed amount.

Multiple jackpots are supported — add more entries under `config.jackpots` in `cosmosConfig.js`.

Jackpot amounts persist in SQLite (`cosmos_jackpots` table) and survive restarts.

```js
jackpots: {
  cosmic: {
    name: 'Космічний Джекпот',
    seedAmount: 1000,
    contributionRate: 0.01,
    baseChance: 0.001,
    betChanceBonus: 0.001,
    maxLuckBonus: 0.002,
    emoji: '🌌',
  },
  // add more jackpots here
},
```

---

### Blackjack

Lite blackjack for Twitch chat with two modes.

| Command | Aliases | Description |
|---|---|---|
| `!bj <bet>` | `!blackjack`, `!блекджек` | Mode A: random chatter becomes dealer |
| `!bj @user <bet>` | | Mode B: challenge a specific player |
| `!bjconfirm` | `!bjyes`, `!bjтак` | Dealer accepts the game |
| `!hit` | `!bjhit`, `!ще` | Draw another card |
| `!stand` | `!bjstand`, `!стоп` | End your turn |

**Mode A** — No target specified: a random chatter from recent chat is selected as dealer.
**Mode B** — Target specified: that player is invited to be dealer.

In both modes the selected player has 60 seconds to `!bjconfirm`. If they don't respond, the bot becomes dealer and the game starts automatically.

**Game flow:**
1. Dealer confirms (or times out → bot dealer).
2. Both sides receive 2 cards; dealer's first card is hidden (`??`).
3. Challenger plays first (`!hit` / `!stand`). Bust → instant loss.
4. Dealer plays: bot auto-follows standard rules (hit until ≥17); human dealer uses `!hit`/`!stand`.
5. Reveal and compare totals. Higher wins without busting.

**PvP economy:** winner gains `+bet` SE points; loser loses `-bet`.
**Bot dealer:** challenger wins/loses points against the house (no transfer partner).

**Lite rules:** no splits, no insurance, no double-down. Ace = 1 or 11 (best). Blackjack (21 in 2 cards) = instant win.

---

## Cosmos Casino — Per-Feature Enable/Disable

Individual game groups within Cosmos Casino can be enabled or disabled independently at runtime via the HTTP control API, without restarting the server or affecting other games.

### Feature Groups

| Feature | Commands included |
|---|---|
| `spin` | `!spin`, `!jackpot`, `!balance`, `!perks`, `!ctop` |
| `dice` | `!dice` |
| `duel` | `!duel`, `!accept`, `!decline`, `!shield` |
| `box` | `!box` |
| `daily` | `!daily` |
| `blackjack` | `!bj`, `!bjconfirm`, `!hit`, `!stand` |

Utility commands (`!balance`, `!perks`, `!ctop`, `!jackpot`) are grouped with **spin** because they display information about the main economy — disabling spin also hides the leaderboard and jackpot info. Shield is grouped with **duel** because it only exists to protect against duels.

### HTTP API

| Endpoint | Description |
|---|---|
| `GET /cosmos/features` | Snapshot of all feature flags |
| `GET /cosmos/features/enable-all` | Enable every feature group |
| `GET /cosmos/features/disable-all` | Disable every feature group |
| `GET /cosmos/feature/<name>/enable` | Enable a single feature (e.g. `/cosmos/feature/spin/enable`) |
| `GET /cosmos/feature/<name>/disable` | Disable a single feature |
| `GET /cosmos/feature/<name>/status` | Check whether a feature is enabled |

Valid feature names: `spin`, `dice`, `duel`, `box`, `daily`, `blackjack`.

Example response for `/cosmos/features`:
```json
{
  "features": {
    "spin":      true,
    "dice":      true,
    "duel":      false,
    "box":       true,
    "daily":     true,
    "blackjack": true
  }
}
```

### Startup Defaults

Default values live in `cosmosConfig.js` under the `features` block:

```js
features: {
  spin:      true,
  dice:      true,
  duel:      true,
  box:       true,
  daily:     true,
  blackjack: true,
},
```

Change any value to `false` to disable that group at startup without needing an HTTP call.

### Architecture

The feature gate sits in the middleware pipeline between the casino-wide enable guard and the bot-throttle guard:

```
safeExecution → logging → cosmosEnabled → featureEnabled → botThrottle → cooldown → handler
```

Each command carries a `feature` property (stamped by `cosmosModule.js` at registration time). `createFeatureMiddleware` reads `ctx.meta.feature` and queries `isFeatureEnabled()` from `state.js`. Commands with no feature tag always pass through.

### Programmatic control (from other game code)

```js
cosmosGame.setFeature('blackjack', false);   // disable blackjack
cosmosGame.setFeature('spin', true);         // re-enable spin group
cosmosGame.disableAllFeatures();             // kill everything
cosmosGame.enableAllFeatures();              // restore everything
```
