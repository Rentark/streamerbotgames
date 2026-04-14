import { currencyConfig } from '../../config/currencyConfig.js';

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
 */
const gameConfigCosmos = {

  // ── Commands ────────────────────────────────────────────────────────────────
  commands: {
    spin:        new Set(['!spin',      '!крутити',   '!спін']),
    dice:        new Set(['!dice',      '!кубик',     '!рулетка']),
    duel:        new Set(['!duel',      '!дуель']),
    duelAccept:  new Set(['!accept',    '!прийняти']),
    duelDecline: new Set(['!decline',   '!відхилити']),
    box:         new Set(['!box',       '!ящик',      '!коробка']),
    balance:     new Set(['!balance',   '!зірки',     '!баланс']),
    top:         new Set(['!ctop',      '!космостоп']),
    perks:       new Set(['!perks',     '!перки',     '!рівень']),
    daily:       new Set(['!daily',     '!щоденно']),
    shield:      new Set(['!shield',    '!щит']),
    jackpot:     new Set(['!jackpot',   '!джекпот',   '!jp']),
    blackjack:   new Set(['!bj',        '!blackjack', '!блекджек']),
    bjconfirm:   new Set(['!bjconfirm', '!bjyes',     '!bjтак']),
    hit:         new Set(['!hit',       '!bjhit',     '!ще']),
    stand:       new Set(['!stand',     '!bjstand',   '!стоп', '!досить']),
  },

  // ── Currency ────────────────────────────────────────────────────────────────
  currency: currencyConfig,

  // ── Economy ─────────────────────────────────────────────────────────────────
  minBet:    10,
  maxBet:    5000,
  shieldCost: 150,
  boxCost:    100,
  dailyReward: { min: 50, max: 200 },
  dailyCooldownMs: 24 * 60 * 60 * 1000,

  // ── Cooldowns (ms per user per command) ──────────────────────────────────────
  cooldowns: {
    spin:      3_000,
    dice:      3_000,
    duel:     10_000,
    box:      10_000,
    balance:   5_000,
    top:      15_000,
    perks:     5_000,
    daily:     0,
    shield:    0,
    jackpot:  10_000,
    blackjack: 0,
    bjconfirm: 0,
    hit:       0,
    stand:     0,
  },
  botMessages:  { windowMs: 30_000, maxMessages: 15 },
  duelExpiryMs: 60_000,

  // ── Lose-streak protection ───────────────────────────────────────────────────
  // Applied to: Slots, Dice, Blackjack vs Bot.
  // Activates once `lossesBeforeBoost` consecutive losses are reached.
  streakProtection: {
    enabled: true,

    /** Number of consecutive losses before any boost is applied. */
    lossesBeforeBoost: 3,

    // Slots — extra luck added on top of effective player luck.
    // e.g. 0.30 at maxTotalLuck=2.0 is a significant nudge toward winning symbols.
    luckBoost: 0.30,

    // Dice — extra win-chance probability (0–1) added on top of luck-adjusted chance.
    // Hard cap in DiceService still prevents > 95%.
    winChanceBoost: 0.10,

    // Blackjack vs Bot — bot dealer stands this many points earlier than normal.
    // Normal: dealer hits until ≥ 17. With reduction=2: dealer hits until ≥ 15.
    // This makes the bot more likely to bust, giving the player an indirect edge.
    dealerHitUntilReduction: 2,
  },

  // ── Slots: outcome-first 3-reel machine ──────────────────────────────────────
  // symbols  – emoji categories. `dust: true` marks losing categories.
  // payouts  – keyed win types. `weight` is luck-adjusted per spin.
  //            `xp` = % of bet awarded as XP (e.g. xp:10 on 500 bet → 50 XP)
  reels: {
    symbols: [
      { id: 'jackpot', emojis: ['🌟', '⭐'],      dust: false },
      { id: 'diamond', emojis: ['💎', '💍'],      dust: false },
      { id: 'nebula',  emojis: ['🌌', '🌠'],      dust: false },
      { id: 'comet',   emojis: ['☄️', '🌙'],      dust: false },
      { id: 'star',    emojis: ['✨', '🔮'],      dust: false },
      { id: 'dust',    emojis: ['💨', '🌫️'],    dust: true  },
    ],
    payouts: {
      // xp = % of bet
      triple_jackpot: { mult: 20,  xp: 10, weight: 1,   label: '🌟 ДЖЕКПОТ! ЗОРЯНИЙ ВИБУХ!'     },
      triple_diamond: { mult: 10,  xp: 8,  weight: 3,   label: '💎 ТРІПЛ ДІАМОНД!'              },
      triple_nebula:  { mult: 6,   xp: 6,  weight: 6,   label: '🌌 ТУМАННІСТЬ ТРЬОХ!'           },
      triple_any:     { mult: 5,   xp: 5,  weight: 15,  label: '🎰 ТРІПЛ! Чудовий виграш!'     },
      double_jackpot: { mult: 3,   xp: 3,  weight: 20,  label: '⭐ ПАРА ЗІРОК!'                 },
      double_diamond: { mult: 2,   xp: 2,  weight: 35,  label: '💎 Пара діамантів!'            },
      double_any:     { mult: 1.5, xp: 1,  weight: 60,  label: '🎰 ПАРА! Маленький виграш!'    },
      none:           { mult: 0,   xp: 0.5,weight: 250, label: null                             },
    },
  },

  // ── Dice / Roulette ─────────────────────────────────────────────────────────
  // xpWin / xpLose = % of bet
  dice: {
    winChance:             0.45,
    winMult:               2.0,
    maxLuckWinChanceBonus: 0.10,
    luckWinAmountBonus:    false,
    maxLuckWinAmountMult:  0.30,
    xpWin:  3,    // 3% of bet on win
    xpLose: 0.5,  // 0.5% of bet on loss (minimum 1 XP via calcXp)
  },

  // ── Mystery Box ───────────────────────────────────────────────────────────
  mysteryBox: {
    outcomes: [
      { type: 'small_win',   weight: 30, value: 75,   emoji: '✨', label: 'Знайдено {value} {c}!'          },
      { type: 'big_win',     weight: 18, value: 300,  emoji: '💎', label: 'Великий виграш: +{value} {c}!' },
      { type: 'jackpot_win', weight: 4,  value: 1000, emoji: '🌟', label: '🎉 ДЖЕКПОТ ЯЩИКА: +{value} {c}!'},
      { type: 'lose',        weight: 28, value: -50,  emoji: '💀', label: 'Порожній ящик... -{absValue} {c}'},
      { type: 'luck_boost',  weight: 10, value: 0.05, emoji: '🍀', label: 'Космічна удача зросла!'         },
      { type: 'shield',      weight: 7,  value: 1,    emoji: '🛡️', label: 'Отримано щит!'                 },
      { type: 'chaos',       weight: 3,  value: 0,    emoji: '🌌', label: 'ХАОС! Чорна діра поглинає зірочки чатерів...' },
    ],
    chaosConfig: {
      affectAll:           false,
      maxChattersAffected: 5,
      deductPercent:       5,
      recentWindowMs:      30 * 60 * 1000,
    },
  },

  // ── Progressive Jackpots ──────────────────────────────────────────────────
  jackpots: {
    cosmic: {
      name:              'Космічний Джекпот',
      seedAmount:        1000,
      contributionRate:  0.01,
      baseChance:        0.001,
      betChanceBonus:    0.001,
      maxLuckBonus:      0.002,
      emoji:             '🌌',
    },
  },

  // ── Blackjack ─────────────────────────────────────────────────────────────
  // xpWin / xpLose / xpBlackjack / xpPush = % of bet
  blackjack: {
    minBet:           10,
    maxBet:           5000,
    confirmTimeoutMs: 60_000,
    turnTimeoutMs:    60_000,
    dealerHitUntil:   17,
    xpWin:       4,    // 4% of bet
    xpLose:      1,    // 1% of bet
    xpBlackjack: 7,    // 7% of bet (natural blackjack bonus)
    xpPush:      1,    // 1% of bet on push
  },

  // ── Level Perks ───────────────────────────────────────────────────────────
  levelPerks: {
    5:  { luckBonus: 0.05, description: '+5% удача ✨'                                     },
    10: { luckBonus: 0.05, shieldUnlock: true, description: '+5% удача, відкрито !щит 🛡️' },
    15: { luckBonus: 0.05, dailyBonus: 50, description: '+5% удача, +50 до щоденної 🌅'   },
    20: { luckBonus: 0.10, doubleXP: true, description: '+10% удача, подвійний XP ⚡'      },
    25: { luckBonus: 0.05, boxDiscount: 0.5, description: '+5% удача, знижка ящик -50% 📦'},
    30: { luckBonus: 0.10, cosmicTier: true, description: '+10% удача, КОСМІЧНИЙ РІВЕНЬ 🌌'},
  },

  xpFormula:    { base: 100, multiplier: 1.2 },
  maxBaseLuck:  1.5,
  maxTotalLuck: 2.0,

  // ── Messages ──────────────────────────────────────────────────────────────
  // {c} auto-injected by CosmosMessageTemplate as currencyConfig.symbol
  messages: {
    fetchFailed:      '/me @{username}, не вдалось перевірити баланс. Спробуй ще раз 💫',
    balance:          '/me @{username} | {c} Зірочок: {balance} {c} | Рівень {level} ({xp}/{xpNext} XP) | Удача: {luck}x{shieldStatus}',
    spinWin:          '/me {reels} | @{username} {label} Ставка: {bet} {c} → +{win} {c} | Баланс: {balance} {c} (+{xp} XP)',
    spinLose:         '/me {reels} | @{username} Порожній простір... -{bet} {c} | Баланс: {balance} {c} (+{xp} XP)',
    spinInvalidBet:   '/me @{username}, ставка: {minBet}–{maxBet} {c} або 50% або all',
    spinNoFunds:      '/me @{username}, недостатньо зірочок! Є: {balance} {c}, потрібно: {bet} {c} 💸',
    diceWin:          '/me 🎲 [{dice}] @{username} ВИГРАШ! {bet} {c} → +{win} {c} | Баланс: {balance} {c} (+{xp} XP)',
    diceLose:         '/me 🎲 [{dice}] @{username} Не пощастило... -{bet} {c} | Баланс: {balance} {c} (+{xp} XP)',
    diceInvalidBet:   '/me @{username}, ставка: {minBet}–{maxBet} {c} або 50% або all',
    diceNoFunds:      '/me @{username}, недостатньо зірочок! Є: {balance} {c}, потрібно: {bet} {c} 💸',
    duelSelf:         '/me @{sender}, не можна дуелювати з собою! 🤦',
    duelNoFunds:      '/me @{sender}, недостатньо зірочок для дуелі! (Потрібно: {bet} {c})',
    duelTargetNoFunds:'/me @{sender}, у @{target} недостатньо зірочок! (Потрібно: {bet} {c})',
    duelChallenge:    '/me ⚔️ @{sender} кидає виклик @{target} на {bet} {c}! @{target}: !accept або !decline (60с)',
    duelBlocked:      '/me 🛡️ @{target} заблокував атаку @{sender}! Щит розбито!',
    duelWin:          '/me ⚔️ @{winner} перемагає @{loser} і забирає {bet} {c}! (+{xp} XP)',
    duelExpired:      '/me ⚔️ @{target} не відповів на виклик @{sender}. Дуель скасована.',
    duelDeclined:     '/me ⚔️ @{target} відхилив виклик @{sender}.',
    boxResult:        '/me @{username} {emoji} Відкриває космічний ящик... {result} Баланс: {balance} {c}',
    boxNoFunds:       '/me @{username}, недостатньо зірочок для ящика! (Потрібно: {cost} {c})',
    boxLuckBoost:     '/me @{username} 🍀 Космічна удача зросла! Базова удача: {baseLuck}x',
    boxShield:        '/me @{username} 🛡️ Отримано щит! Наступна дуель буде заблокована.',
    boxChaos:         '/me 🌌 ХАОС! @{username} відкрив чорну діру! Постраждали: {chatters} (-{percent}% зірочок)',
    dailyReward:      '/me @{username} 🌅 Щоденна нагорода: +{amount} {c}! Баланс: {balance} {c}',
    dailyCooldown:    '/me @{username} ⏰ Наступна щоденна через {remaining}',
    shieldBought:     '/me @{username} 🛡️ Щит активовано! (-{cost} {c}) Баланс: {balance} {c}',
    shieldNoFunds:    '/me @{username}, недостатньо зірочок для щита! (Потрібно: {cost} {c})',
    shieldAlreadyActive: '/me @{username}, щит вже активний! 🛡️',
    shieldLevelRequired: '/me @{username}, щит доступний з рівня 10! (Зараз: {level})',
    perks:            '/me @{username} | Рівень {level} | Удача: {luck}x | XP: {xp}/{xpNext}{extra}',
    leaderboard:      '/me 🏆 Топ за рівнем: {leaderboard}',
    noPlayers:        '/me Ще ніхто не грав у космічне казино! 🌌',
    levelUp:          ' 🎉 РІВЕНЬ {level}! {perkDesc}',
    jackpotStatus:    '/me {emoji} Поточний {name}: {amount} {c}',
    jackpotWon:       '/me {emoji} ДЖЕКПОТ! @{username} виграв {amount} {c} з {name}! 🎉🌌🎉',
    bjInvalidBet:     '/me @{username}, ставка: {minBet}–{maxBet} {c} або 50% або all',
    bjNoFunds:        '/me @{username}, недостатньо зірочок! (Є: {balance} {c}, потрібно: {bet} {c})',
    bjTargetNoFunds:  '/me @{target}, недостатньо зірочок для ставки {bet} {c}!',
    bjAlreadyActive:  '/me @{username}, у тебе вже є активна гра в блекджек!',
    bjChallengePvp:   '/me 🃏 @{target}, @{challenger} кличе тебе у блекджек на {bet} {c}! Напиши !bjconfirm протягом 60с або стане дилером бот',
    bjChallengeRandom:'/me 🃏 @{target}, ти вибраний дилером в блекджек (ставка: {bet} {c})! Напиши !bjconfirm протягом 60с або стане дилером бот',
    bjBotDealer:      '/me 🤖 @{dealer} не відповів — бот стає дилером!',
    bjNoChallengeForYou: '/me @{username}, тебе ніхто не кличе у блекджек!',
    bjNoActiveGame:   '/me @{username}, у тебе немає активної гри в блекджек!',
    bjNotYourTurn:    '/me @{username}, зараз не твій хід!',
    bjDeal:           '/me 🃏 @{challenger} {challengerHand} | Дилер {dealerHand} | !hit або !stand',
    bjPlayerHit:      '/me 🃏 @{username} бере карту: {hand} | !hit або !stand',
    bjPlayerBust:     '/me 💥 @{username} перебрав! {hand} — {dealerUsername} перемагає! (+{xp} XP)',
    bjPlayerBlackjack:'/me 🃏✨ БЛЕКДЖЕК! @{username} виграє {bet} {c}! {hand} (+{xp} XP)',
    bjDealerReveal:   '/me 🃏 Дилер @{dealer} відкриває карти: {hand}',
    bjDealerHit:      '/me 🃏 Дилер @{dealer} бере карту: {hand}',
    bjDealerBust:     '/me 💥 Дилер @{dealer} перебрав! {hand} — @{challenger} перемагає +{bet} {c}! (+{xp} XP)',
    bjWinChallenger:  '/me 🏆 @{challenger} перемагає! {challengerVal} vs {dealerVal}. +{bet} {c} (+{xp} XP)',
    bjWinDealer:      '/me 🏆 Дилер @{dealer} перемагає! {dealerVal} vs {challengerVal}. -{bet} {c} (+{xp} XP)',
    bjPush:           '/me 🤝 Нічия! {challengerVal} vs {dealerVal}. Ставка повернена. (+{xp} XP)',
    bjDealerTurnPvp:  '/me 🃏 Хід дилера @{dealer}: {hand} | !hit або !stand',
    bjTimeout:        '/me ⏰ @{username} не відповів — автоматичний стенд!',
    rateLimitWarning: '/me @{username}, не так швидко, космонавте! 🚀',
    rewardFail:       '/me ⚠️ Помилка під час нарахування зірочок. Статус: {statusCode}',
  },
};

export { gameConfigCosmos };
export default gameConfigCosmos;
