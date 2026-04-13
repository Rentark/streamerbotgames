/**
 * CosmosGame configuration
 * Space-themed Twitch chat casino. Currency = StreamElements points.
 * Progression (level, XP, perks, shield, daily) stored locally in SQLite.
 */
const gameConfigCosmos = {

  // ── Commands ────────────────────────────────────────────────────────────────
  commands: {
    spin:        new Set(['!spin',    '!крутити', '!спін']),
    dice:        new Set(['!dice',    '!кубик',   '!рулетка']),
    duel:        new Set(['!duel',    '!дуель']),
    duelAccept:  new Set(['!accept',  '!прийняти']),
    duelDecline: new Set(['!decline', '!відхилити']),
    box:         new Set(['!box',     '!ящик',    '!коробка']),
    balance:     new Set(['!balance', '!зірки',   '!баланс']),
    top:         new Set(['!ctop',    '!космостоп']),
    perks:       new Set(['!perks',   '!перки',   '!рівень']),
    daily:       new Set(['!daily',   '!щоденно']),
    shield:      new Set(['!shield',  '!щит']),
  },

  // ── Economy ─────────────────────────────────────────────────────────────────
  minBet:    10,
  maxBet:    5000,
  shieldCost: 150,
  boxCost:    100,
  dailyReward: { min: 50, max: 200 },
  dailyCooldownMs: 24 * 60 * 60 * 1000,

  // ── Cooldowns (ms per user per command, used by cooldownMiddleware) ─────────
  cooldowns: {
    spin:    2_000,
    dice:    2_000,
    duel:   10_000,
    box:    10_000,
    balance: 5_000,
    top:    15_000,
    perks:   5_000,
    daily:   0,
    shield:  0,
  },
  botMessages:  { windowMs: 30_000, maxMessages: 15 },
  duelExpiryMs: 60_000,

  // ── Slots: 3-reel symbol pool ─────────────────────────────────────────────
  reels: {
    symbols: [
      { id: 'jackpot', emoji: '🌟', weight: 1,  dust: false },
      { id: 'diamond', emoji: '💎', weight: 3,  dust: false },
      { id: 'nebula',  emoji: '🌌', weight: 6,  dust: false },
      { id: 'comet',   emoji: '☄️', weight: 10, dust: false },
      { id: 'sparkle', emoji: '✨', weight: 10, dust: false },
      { id: 'star',    emoji: '⭐', weight: 14, dust: false },
      { id: 'moon',    emoji: '🌑', weight: 16, dust: false },
      { id: 'dust',    emoji: '💨', weight: 20, dust: true  },
    ],
    payouts: {
      triple_jackpot: { mult: 20,  xp: 100, label: '🌟 ДЖЕКПОТ! ЗОРЯНИЙ ВИБУХ!'     },
      triple_diamond: { mult: 10,  xp: 50,  label: '💎 ТРІПЛ ДІАМОНД!'              },
      triple_nebula:  { mult: 6,   xp: 30,  label: '🌌 ТУМАННІСТЬ ТРЬОХ!'           },
      triple_any:     { mult: 5,   xp: 25,  label: '🎰 ТРІПЛ! Чудовий виграш!'     },
      double_jackpot: { mult: 3,   xp: 15,  label: '⭐ ПАРА ЗІРОК!'                 },
      double_diamond: { mult: 2,   xp: 10,  label: '💎 Пара діамантів!'            },
      double_any:     { mult: 1.5, xp: 5,   label: '🎰 ПАРА! Маленький виграш!'    },
      none:           { mult: 0,   xp: 2,   label: null                             },
    },
  },

  // ── Dice / Roulette ────────────────────────────────────────────────────────
  dice: {
    winChance:             0.45,
    winMult:               2.0,
    maxLuckWinChanceBonus: 0.10,
    luckWinAmountBonus:    false,
    maxLuckWinAmountMult:  0.30,
    xpWin:  15,
    xpLose:  3,
  },

  // ── Mystery Box ───────────────────────────────────────────────────────────
  mysteryBox: {
    outcomes: [
      { type: 'small_win',   weight: 30, value: 75,   mult: 2,  emoji: '✨', label: 'Знайдено {value} балів!'         },
      { type: 'big_win',     weight: 18, value: 300,  mult: 5,  emoji: '💎', label: 'Великий виграш: +{value} балів!'},
      { type: 'jackpot_win', weight: 4,  value: 1000, mult: 20, emoji: '🌟', label: '🎉 ДЖЕКПОТ ЯЩИКА: +{value}!'   },
      { type: 'lose',        weight: 28, value: -50,  mult: 1,  emoji: '💀', label: 'Порожній ящик... -{absValue}'   },
      { type: 'luck_boost',  weight: 10, value: 0.05, mult: 1,  emoji: '🍀', label: 'Космічна удача зросла!'         },
      { type: 'shield',      weight: 7,  value: 1,    mult: 1,  emoji: '🛡️', label: 'Отримано щит!'                 },
      { type: 'chaos',       weight: 3,  value: 0,    mult: 1,  emoji: '🌌', label: 'ХАОС! Чорна діра поглинає бали чатерів...' },
    ],
    chaosConfig: {
      affectAll:           false,
      maxChattersAffected: 5,
      deductPercent:       5,
      recentWindowMs:      30 * 60 * 1000,
    },
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
  messages: {
    fetchFailed:      '/me @{username}, не вдалось перевірити баланс. Спробуй ще раз 💫',
    balance:          '/me @{username} | 💫 Балів: {balance} | Рівень {level} ({xp}/{xpNext} XP) | Удача: {luck}x{shieldStatus}',
    spinWin:          '/me {reels} | @{username} {label} Ставка: {bet} → +{win} | Баланс: {balance} (+{xp} XP)',
    spinLose:         '/me {reels} | @{username} Порожній простір... -{bet} | Баланс: {balance} (+{xp} XP)',
    spinInvalidBet:   '/me @{username}, ставка: {minBet}–{maxBet} або 50% або all',
    spinNoFunds:      '/me @{username}, недостатньо балів! Є: {balance}, потрібно: {bet} 💸',
    diceWin:          '/me 🎲 [{dice}] @{username} ВИГРАШ! Ставка: {bet} → +{win} | Баланс: {balance} (+{xp} XP)',
    diceLose:         '/me 🎲 [{dice}] @{username} Не пощастило... -{bet} | Баланс: {balance} (+{xp} XP)',
    diceInvalidBet:   '/me @{username}, ставка: {minBet}–{maxBet} або 50% або all',
    diceNoFunds:      '/me @{username}, недостатньо балів! Є: {balance}, потрібно: {bet} 💸',
    duelSelf:         '/me @{sender}, не можна дуелювати з собою! 🤦',
    duelNoFunds:      '/me @{sender}, недостатньо балів для дуелі! (Потрібно: {bet})',
    duelTargetNoFunds:'/me @{sender}, у @{target} недостатньо балів! (Потрібно: {bet})',
    duelChallenge:    '/me ⚔️ @{sender} кидає виклик @{target} на {bet} балів! @{target}: !accept або !decline (60с)',
    duelBlocked:      '/me 🛡️ @{target} заблокував атаку @{sender}! Щит розбито!',
    duelWin:          '/me ⚔️ @{winner} перемагає @{loser} і забирає {bet} балів! (+{xp} XP)',
    duelExpired:      '/me ⚔️ @{target} не відповів на виклик @{sender}. Дуель скасована.',
    duelDeclined:     '/me ⚔️ @{target} відхилив виклик @{sender}.',
    boxResult:        '/me @{username} {emoji} Відкриває космічний ящик... {result} Баланс: {balance}',
    boxNoFunds:       '/me @{username}, недостатньо балів для ящика! (Потрібно: {cost})',
    boxLuckBoost:     '/me @{username} 🍀 Космічна удача зросла! Базова удача: {baseLuck}x',
    boxShield:        '/me @{username} 🛡️ Отримано щит! Наступна дуель буде заблокована.',
    boxChaos:         '/me 🌌 ХАОС! @{username} відкрив чорну діру! Постраждали: {chatters} (-{percent}% балів)',
    dailyReward:      '/me @{username} 🌅 Щоденна нагорода: +{amount} балів! Баланс: {balance}',
    dailyCooldown:    '/me @{username} ⏰ Наступна щоденна через {remaining}',
    shieldBought:     '/me @{username} 🛡️ Щит активовано! (-{cost}) Баланс: {balance}',
    shieldNoFunds:    '/me @{username}, недостатньо балів для щита! (Потрібно: {cost})',
    shieldAlreadyActive: '/me @{username}, щит вже активний! 🛡️',
    shieldLevelRequired: '/me @{username}, щит доступний з рівня 10! (Зараз: {level})',
    perks:            '/me @{username} | Рівень {level} | Удача: {luck}x | XP: {xp}/{xpNext}{extra}',
    leaderboard:      '/me 🏆 Топ за рівнем: {leaderboard}',
    noPlayers:        '/me Ще ніхто не грав у космічне казино! 🌌',
    levelUp:          ' 🎉 РІВЕНЬ {level}! {perkDesc}',
    rateLimitWarning: '/me @{username}, не так швидко, космонавте! 🚀',
    rewardFail:       '/me ⚠️ Помилка під час нарахування балів. Статус: {statusCode}',
  },
};

export { gameConfigCosmos };
export default gameConfigCosmos;
