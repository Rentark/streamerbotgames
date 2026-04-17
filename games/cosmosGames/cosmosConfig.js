import { currencyConfig, formatCurrency } from '../../config/currencyConfig.js';

/**
 * CosmosGame configuration
 * Space-themed Twitch chat casino. Currency = StreamElements points.
 * Progression (level, XP, perks, shield, daily) stored locally in SQLite.
 *
 * Currency symbol: use {c} in message templates → resolves to currencyConfig.symbol (✨)
 *
 * XP fields: all `xp` values are treated as a PERCENTAGE OF BET.
 *   e.g. xp: 10 on a 500-point bet → 50 XP earned
 *   Use calcXp(xpPercent, bet) from utils/calcXp.js to convert.
 *
 * Feature flags: control which game groups are available at startup.
 *   Runtime toggle via HTTP API: GET /cosmos/feature/:feature/enable|disable
 */

//spin, dice, box, balance, top, perks, jackpot
//TODO duel, bj
const gameConfigCosmos = {

  // ── Commands ────────────────────────────────────────────────────────────────
  commands: {
    spin: new Set(['!spin', '!крутити', '!спін', '!крутка', '!спініні']),
    dice: new Set(['!dice', '!куб', '!рулетка', '!рулетіні']),
    duel: new Set(['!duel', '!дуель', '!дуеліні']),
    duelAccept: new Set(['!accept', '!прийняти', '!та', '!так']),
    duelDecline: new Set(['!decline', '!відхилити', '!ні']),
    box: new Set(['!box', '!скриня', '!скринька', '!скриніні']),
    balance: new Set(['!balance', '!зірочки', '!баланс']),
    top: new Set(['!ctop', '!лвлтоп', '!рівні']),
    perks: new Set(['!perks', '!перки', '!рівень']),
    daily: new Set(['!daily', '!стримлик']),
    shield: new Set(['!shield', '!щит']),
    jackpot: new Set(['!jackpot', '!джекпот', '!jp']),
    blackjack: new Set(['!bj', '!blackjack', '!блекджек', '!бж']),
    bjconfirm: new Set(['!bjconfirm', '!bjyes', '!бжта']),
    hit: new Set(['!hit', '!bjhit', '!ще']),
    stand: new Set(['!stand', '!bjstand', '!стоп', '!досить']),
  },

  // ── Per-feature enable flags (startup defaults) ───────────────────────────
  //
  // Feature groups:
  //   spin       → spin, jackpot, balance, perks, top
  //   dice       → dice
  //   duel       → duel, accept/decline, shield
  //   box        → box
  //   daily      → daily
  //   blackjack  → bj, bjconfirm, hit, stand
  //
  // Toggle at runtime via cosmosGame.setFeature(name, bool) or HTTP routes.
  features: {
    spin: true,
    dice: true,
    duel: true,
    box: true,
    daily: true,
    blackjack: true,
  },

  // ── Currency ────────────────────────────────────────────────────────────────
  currency: currencyConfig,
  currencyFormat: formatCurrency,

  // ── Economy ─────────────────────────────────────────────────────────────────
  minBet: 100,
  maxBet: 5_000_000,
  shieldCost: 1_500,
  boxCost: 1_000,
  dailyReward: { min: 8000, max: 20_000 },
  dailyCooldownMs: 24 * 60 * 60 * 1000,

  // ── Cooldowns (ms per user per command) ──────────────────────────────────────
  cooldowns: {
    spin: 1_000,
    dice: 1_000,
    duel: 10_000,
    box: 900_000,
    balance: 5_000,
    top: 15_000,
    perks: 5_000,
    daily: 0,
    shield: 0,
    jackpot: 10_000,
    blackjack: 10_000,
    bjconfirm: 10_000,
    hit: 0,
    stand: 0,
  },
  botMessages: { windowMs: 30_000, maxMessages: 60 },
  duelExpiryMs: 120_000,

  // ── Lose-streak protection ───────────────────────────────────────────────────
  streakProtection: {
    enabled: true,
    lossesBeforeBoost: 5,
    luckBoost: 0.25,
    winChanceBoost: 0.10,
    dealerHitUntilReduction: 2,
  },

  // ── Slots ─────────────────────────────────────────────────────────────────────
  reels: {
    symbols: [
      { id: '777', emojis: ['moonos1777', 'moonos1Shock', 'moonos1Wow'], dust: false },
      { id: 'clown', emojis: ['moonos169', 'moonos1Glasses', 'moonos1Shyclown'], dust: false },
      { id: 'uf', emojis: ['moonos1Kiss', 'moonos1Dance', 'moonos1Shy'], dust: false },
      { id: 'comet', emojis: ['moonos1Teacup', 'moonos1Gnida', 'moonos1Hehe'], dust: false },
      { id: 'star', emojis: ['moonos1Bozhepomozhy', 'moonos1Eat', 'moonos1Yawn', 'moonos1Kitty', 'moonos1Like'], dust: false },
      { id: 'dust', emojis: ['moonos1Camera', 'moonos1Cry', 'moonos1Cryy', 'moonos1Petpet', 'moonos1Meh'], dust: true },
    ],
    payouts: {
      triple_777: { mult: 20, xp: 10, weight: 1, label: 'moonos1Loading х20? як в тебе це вийшло?! moonos1Loading' },
      triple_clown: { mult: 10, xp: 8, weight: 2, label: 'кловуніні тріпліні, уф ! moonos1Slay' },
      triple_uf: { mult: 4, xp: 6, weight: 3, label: 'патужний трипл moonos1Shy' },
      triple_any: { mult: 2, xp: 5, weight: 5, label: 'три в ряд! moonos1Kitty' },
      double_777: { mult: 1.3, xp: 3, weight: 7, label: 'ще трошки б і х20.. крутни ще! moonos1Nyamnyam' },
      double_clown: { mult: 1.1, xp: 2, weight: 10, label: 'добліно клоуніно! moonos1Salto' },
      double_any: { mult: 0.65, xp: 1, weight: 15, label: 'двійка! маєш манюній виграш moonos1Like' },
      none: { mult: 0, xp: 0.5, weight: 68, label: 'та йо.. підкручено чи шо? moonos1Meh' },
    },
  },

  // ── Dice / Roulette ────────────────────────────────────────────────────────
  dice: {
    winChance: 0.40,
    winMult: 2.0,
    maxLuckWinChanceBonus: 0.13,
    luckWinAmountBonus: false,
    maxLuckWinAmountMult: 0.30,
    xpWin: 3,
    xpLose: 0.5,
  },

  // ── Mystery Box ───────────────────────────────────────────────────────────
  mysteryBox: {
    outcomes: [
      { type: 'small_win', weight: 33, value: 2000, emoji: 'moonos1Cute', label: 'знайдено манюню: +{amountFormatted}!' },
      { type: 'big_win', weight: 18, value: 7000, emoji: 'moonos169', label: 'знайдено зіркового кловуна: +{amountFormatted}!' },
      { type: 'jackpot_win', weight: 4, value: 45000, emoji: 'moonos1Nyamnyam', label: 'Знайдено сховок Ренкайрена: +{amountFormatted}!' },
      { type: 'lose', weight: 40, value: -1500, emoji: 'moonos1Like', label: 'Марсель "позичив" твій гаманець, загублено: {amountFormatted}' },
      { type: 'luck_boost', weight: 2, value: 0.05, emoji: 'moonos1Petpet', label: 'пат пат! Зіркова удача зросла!' },
      { type: 'shield', weight: 0.5, value: 1, emoji: 'moonos1Ban', label: 'отримано зірковий щит!' },
      { type: 'chaos', weight: 3, value: 0, emoji: 'moonos1Cry', label: 'о НІІІ! Чорна діра поглинає зірочки чатерсів...' },
    ],
    chaosConfig: {
      affectAll: true,
      maxChattersAffected: 50,
      deductPercent: 5,
      recentWindowMs: 60 * 60 * 1000, // window for chatters selection
    },
  },

  // ── Progressive Jackpots ──────────────────────────────────────────────────
  jackpots: {
    cosmic: {
      name: 'Космічний Джекпот',
      seedAmount: 50_000,
      contributionRate: 0.02,
      baseChance: 0.001, // chance to trigger
      betChanceBonus: 0.001, // chance to trigger with bonus from bet size
      maxLuckBonus: 0.002, // chance to trigger with bonus from luck
      emoji: 'moonos1777',
    },
    starry: {
      name: 'Зірочковий Джекпот',
      seedAmount: 10_000,
      contributionRate: 0.01,
      baseChance: 0.003, // chance to trigger
      betChanceBonus: 0.002, // chance to trigger with bonus from bet size
      maxLuckBonus: 0.002, // chance to trigger with bonus from luck
      emoji: 'moonos1Stars',
    },
  },

  // ── Blackjack ─────────────────────────────────────────────────────────────
  blackjack: {
    minBet: 100,
    maxBet: 5_000_000,
    confirmTimeoutMs: 30_000,
    turnTimeoutMs: 60_000,
    dealerHitUntil: 17,
    xpWin: 4,
    xpLose: 1,
    xpBlackjack: 7,
    xpPush: 1,
  },

  // ── Level Perks ───────────────────────────────────────────────────────────
  levelPerks: {
    5: { luckBonus: 0.05, description: '+5% удача moonos1Petpet' },
    10: { luckBonus: 0.05, dailyBonus: 5000, description: '+5% удача, +5000 до щостримного боксу' },
    15: { luckBonus: 0.05, shieldUnlock: true, description: '+5% удача, відкрито !щит moonos1Ban' },
    20: { luckBonus: 0.10, doubleXP: true, description: '+10% удача, подвійний XP moonos1Sun' },
    25: { luckBonus: 0.05, boxDiscount: 0.5, description: '+5% удача, знижка на зоряну скриньку -50%  moonos1Nyamnyam' },
    99: { luckBonus: 0.10, cosmicTier: true, description: '+10% удача, КОСМІЧНИЙ РІВЕНЬ moonos169' },
  },

  xpFormula: { base: 200, multiplier: 1.25 },
  maxBaseLuck: 1.4,
  maxTotalLuck: 1.5,

  // ── Messages ──────────────────────────────────────────────────────────────
  messages: {
    fetchFailed: '/me @{username}, не вдалось перевірити баланс. Спробуй ще раз moonos1Tea',
    balance: '/me @{username} | Зірочок: {balanceFormatted} | Рівень {level} ({xp}/{xpNext} XP) | Удача: х{luck} {shieldStatus}',
    spinWin: '/me {reels} | @{username} {label} +{win} | Баланс: {balanceFormatted} (+{xp} XP)',
    spinLose: '/me {reels} | @{username} от халепа... підкручено чи шо? moonos1Meh -{bet} | Баланс: {balanceFormatted} (+{xp} XP)',
    spinInvalidBet: '/me @{username}, ставка: мінімум {minBetFormatted} або Х% або all',
    spinNoFunds: '/me @{username}, недостатньо зірочок! Є: {balance}, потрібно: {betFormatted} moonos1Eat',
    diceWin: '/me moonos1Salto @{username} перемога! +{win} | Баланс: {balanceFormatted} (+{xp} XP)',
    diceLose: '/me moonos1Salto @{username} не пощастило... -{bet} | Баланс: {balanceFormatted} (+{xp} XP)',
    diceInvalidBet: '/me @{username}, ставка: мінімум {minBetFormatted} або Х% або all',
    diceNoFunds: '/me @{username}, недостатньо зірочок! Є: {balanceFormatted}, потрібно: {betFormatted} moonos1Eat',
    duelSelf: '/me @{sender}, руки на стіл! не можна дуелювати з собою! moonos1Actually',
    duelNoFunds: '/me @{sender}, недостатньо зірочок для дуелі! (Потрібно: {betFormatted})',
    duelTargetNoFunds: '/me @{sender}, у @{target} недостатньо зірочок! (Потрібно: {betFormatted})',
    duelChallenge: '/me moonos1Shy @{sender} кидає виклик @{target} на {betFormatted}! @{target}: !та або !ні (120с)',
    duelBlocked: '/me moonos1Ban @{target} заблокував атаку @{sender}! Щит розбито!',
    duelWin: '/me moonos1Shy @{winner} перемагає @{loser} і забирає {betFormatted}! (+{xp} XP)',
    duelExpired: '/me moonos1Shyclown @{target} не відповів на виклик @{sender}. Дуель скасована.',
    duelDeclined: '/me moonos1Shyclown @{target} відхилив виклик @{sender}.',
    boxResult: '/me @{username} Відкриває космічну скриньку... {emoji} {result} Баланс: {balanceFormatted}',
    boxNoFunds: '/me @{username}, недостатньо зірочок для скриньки! (Потрібно: {cost} {c})',
    boxLuckBoost: '/me @{username} moonos1Petpet Космічна удача зросла! Базова удача: х{baseLuck}',
    boxShield: '/me @{username} moonos1Ban Отримано щит! Наступна дуель буде заблокована.',
    boxChaos: '/me moonos169 ХАОС! @{username} натрапив на злого кловуна! Постраждали: {chatters} (-{percent}% зірочок)',
    dailyReward: '/me @{username} moonos1Sun щостримна нагорода: +{amount}! Баланс: {balanceFormatted}',
    dailyCooldown: '/me @{username} moonos1Tea наступна щостримна через {remaining}',
    shieldBought: '/me @{username} moonos1Ban щит активовано! (-{cost}) Баланс: {balanceFormatted}',
    shieldNoFunds: '/me @{username}, недостатньо зірочок для щита! (Потрібно: {cost} {c})',
    shieldAlreadyActive: '/me @{username}, щит вже активний! moonos1Ban',
    shieldLevelRequired: '/me @{username}, щит доступний з рівня 10! (Зараз: {level})',
    perks: '/me @{username} | Рівень {level} | Удача: х{luck} | XP: {xp}/{xpNext}{extra}',
    leaderboard: '/me moonos1Stars топ за рівнем: {leaderboard}',
    noPlayers: '/me Ще ніхто не грав у зіркові ігри! moonos1Meh',
    levelUp: '/me @{username}, moonos1Wine РІВЕНЬ {level}! {perkDesc}',
    jackpotStatus: '/me джекпоти: {emoji} {name} {emoji} : {amountFormatted}',
    jackpotWon: '/me {emoji} ДЖЕКПОТ! @{username} виграв {amountFormatted} з {emoji} {name} {emoji} !  moonos1Salto moonos1Shock moonos1Salto',
    bjInvalidBet: '/me @{username}, ставка: мінімум {minBetFormatted} або Х% або all',
    bjNoFunds: '/me @{username}, недостатньо зірочок! (Є: {balance}, потрібно: {betFormatted}) moonos1Eat',
    bjTargetNoFunds: '/me @{username}, в @{target} недостатньо зірочок для ставки {betFormatted}! moonos1Eat',
    bjAlreadyActive: '/me @{username}, у тебе вже є активна гра в блекджек!',
    bjChallengePvp: '/me moonos169 @{target}, @{challenger} кличе тебе у блекджек на {betFormatted}! Напиши !бжта протягом 60с або дилером стане бот',
    bjChallengeRandom: '/me moonos169 @{target}, ти обраний! дилером в блекджек (ставка: {betFormatted})! Напиши !бжта протягом 60с або дилером стане бот',
    bjBotDealer: '/me moonos1Hello @{dealer} не відповів — бот стає дилером!',
    bjNoChallengeForYou: '/me @{username}, тебе ніхто не кличе у блекджек!',
    bjNoActiveGame: '/me @{username}, у тебе немає активної гри в блекджек!',
    bjNotYourTurn: '/me @{username}, зараз не твій хід!',
    bjDeal: '/me moonos169 {challenger} {challengerHand} | Дилер {dealerHand} | !ще або !досить',
    bjPlayerHit: '/me moonos169 {username} бере карту: {hand} | !ще або !досить',
    bjPlayerBust: '/me moonos1Ban {username} перебрав! {hand} — {dealerUsername} перемагає! (+{xp} XP)',
    bjPlayerBlackjack: '/me moonos169 moonos1Stars БЛЕКДЖЕК! @{username} виграє {betFormatted}! {hand} (+{xp} XP)',
    bjDealerReveal: '/me moonos169 Дилер {dealer} відкриває карти: {hand}',
    bjDealerHit: '/me moonos169 Дилер {dealer} бере карту: {hand}',
    bjDealerBust: '/me moonos1Ban Дилер {dealer} перебрав! {hand} — @{challenger} перемагає +{betFormatted}! (+{xp} XP)',
    bjWinChallenger: '/me moonos1Wine {challenger} перемагає! {challengerVal} vs {dealerVal}. +{betFormatted} (+{xp} XP)',
    bjWinDealer: '/me moonos1Wine Дилер {dealer} перемагає! {dealerVal} vs {challengerVal}. -{betFormatted} (+{xp} XP)',
    bjPush: '/me moonos1Meh Нічия! {challengerVal} vs {dealerVal}. Ставка повернена. (+{xp} XP)',
    bjDealerTurnPvp: '/me moonos169 Хід дилера {dealer}: {hand} | !ще або !досить',
    bjTimeout: '/me moonos1Ban {username} не відповів — автоматичний стенд!',
    rateLimitWarning: '/me @{username}, не так швидко, космонавте! moonos1Actually',
    rewardFail: '/me moonos1Redflag Помилка під час нарахування зірочок. Статус: {statusCode}',
  },
};

export { gameConfigCosmos };
export default gameConfigCosmos;
