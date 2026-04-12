/**
 * CosmosGame configuration
 * Space-themed Twitch chat casino with progression, PvP, and mystery boxes.
 * Currency is local "stardust" (✨) tracked in SQLite — independent from StreamElements.
 */
const gameConfigCosmos = {
  // ── Commands ──────────────────────────────────────────────────────────────────
  commands: {
    spin:    new Set(['!spin',    '!крутити', '!спін']),
    duel:    new Set(['!duel',    '!дуель']),
    box:     new Set(['!box',     '!ящик',    '!коробка']),
    balance: new Set(['!balance', '!зірки',   '!баланс']),
    top:     new Set(['!ctop',    '!космостоп']),
    perks:   new Set(['!perks',   '!перки',   '!рівень']),
    daily:   new Set(['!daily',   '!щоденно']),
    shield:  new Set(['!shield',  '!щит']),
    duelAccept:  new Set(['!accept',  '!прийняти']),
    duelDecline: new Set(['!decline', '!відхилити'])
  },

  // ── Economy ───────────────────────────────────────────────────────────────────
  startingBalance: 500,
  minBet: 10,
  maxBet: 5000,
  shieldCost: 150,
  boxCost: 100,

  dailyReward: { min: 50, max: 200 },
  dailyCooldownMs: 24 * 60 * 60 * 1000,

  // ── Rate Limiting ─────────────────────────────────────────────────────────────
  rateLimit: { windowMs: 30_000, maxUses: 30 },
  duelRateLimit: { windowMs: 60_000, maxUses: 2 },
  boxRateLimit:  { windowMs: 60_000, maxUses: 2 },
  botMessages:   { windowMs: 30_000, maxMessages: 15 },
  duelExpiryMs: 60_000,

  // ── Slots ─────────────────────────────────────────────────────────────────────
  slots: {
    outcomes: [
      { type: 'jackpot',   emoji: '🌟💎🌟', weight: 1,  mult: 20,  xp: 100, label: '🌟 ДЖЕКПОТ! ЗОРЯНИЙ ВИБУХ!'         },
      { type: 'supernova', emoji: '✨💫✨', weight: 3,  mult: 10,  xp: 50,  label: '✨ НАДНОВА! Вражаючий виграш!'       },
      { type: 'nebula',    emoji: '🌌🌠🌌', weight: 8,  mult: 5,   xp: 25,  label: '🌌 ТУМАННІСТЬ! Чудовий виграш!'     },
      { type: 'comet',     emoji: '☄️⭐☄️', weight: 15, mult: 2,   xp: 10,  label: '☄️ КОМЕТА! Непоганий виграш!'      },
      { type: 'meteor',    emoji: '🌑🌟🌑', weight: 23, mult: 1.5, xp: 5,   label: '🌑 МЕТЕОР! Маленький виграш!'      },
      { type: 'dust',      emoji: '💨🌑💨', weight: 50, mult: 0,   xp: 2,   label: null                                 }
    ]
  },

  // ── Mystery Box ───────────────────────────────────────────────────────────────
  mysteryBox: {
    outcomes: [
      { type: 'small_win',   weight: 30, value: 75,   mult: 2,   emoji: '✨', label: 'Знайдено {value} ✨ зіркового пилу!'   },
      { type: 'big_win',     weight: 18, value: 300,  mult: 5,   emoji: '💎', label: 'Великий виграш: +{value} ✨!'          },
      { type: 'jackpot_win', weight: 4,  value: 1000, mult: 10,  emoji: '🌟', label: '🎉 ДЖЕКПОТ ЯЩИКА: +{value} ✨!'       },
      { type: 'lose',        weight: 28, value: -50,  mult: 0,   emoji: '💀', label: 'Порожній ящик... -{absValue} ✨'       },
      { type: 'luck_boost',  weight: 10, value: 0.05, mult: 1,   emoji: '🍀', label: 'Космічна удача зросла!'                },
      { type: 'shield',      weight: 7,  value: 1,    mult: 1,   emoji: '🛡️', label: 'Отримано щит!'                        },
      { type: 'chaos',       weight: 3,  value: 0,    mult: 0,   emoji: '🌌', label: 'Хаос! Пил розсипався по всесвіту...'  }
    ]
  },

  // ── Level Perks (cumulative, checked by >= level) ─────────────────────────────
  levelPerks: {
    5:  { luckBonus: 0.05, description: '+5% удача ✨'                              },
    10: { luckBonus: 0.05, shieldUnlock: true, description: '+5% удача, відкрито !щит 🛡️' },
    15: { luckBonus: 0.05, dailyBonus: 50, description: '+5% удача, +50 до щоденної нагороди 🌅' },
    20: { luckBonus: 0.10, doubleXP: true, description: '+10% удача, подвійний XP ⚡'   },
    25: { luckBonus: 0.05, boxDiscount: 0.5, description: '+5% удача, знижка на ящик -50% 📦' },
    30: { luckBonus: 0.10, cosmicTier: true, description: '+10% удача, КОСМІЧНИЙ РІВЕНЬ 🌌' }
  },

  // ── Progression ───────────────────────────────────────────────────────────────
  xpFormula: { base: 100, multiplier: 1.2 },  // xpNeeded = floor(100 * 1.2^level)
  maxBaseLuck: 1.5,   // cap for base_luck column (perks add on top, total capped at 2.0)
  maxTotalLuck: 2.0,

  // ── Messages ──────────────────────────────────────────────────────────────────
  messages: {
    balance:          '/me @{username} | 💫 Зірковий пил: {stardust} ✨ | Рівень {level} ({xp}/{xpNext} XP) | Удача: {luck}x{shieldStatus}',
    spinNoFunds:      '/me @{username}, недостатньо зіркового пилу! Баланс: {balance} ✨, потрібно: {bet} ✨ 💸',
    spinBetTooLow:    '/me @{username}, мінімальна ставка: {minBet} ✨',
    spinBetTooHigh:   '/me @{username}, максимальна ставка: {maxBet} ✨',
    spinWin:          '/me {emoji} @{username} {outcomeLabel} Ставка: {bet} ✨ → +{win} ✨ | Баланс: {balance} ✨ (+{xp} XP)',
    spinLose:         '/me {emoji} @{username} Порожній простір... Ставка: {bet} ✨ | Баланс: {balance} ✨ (+{xp} XP)',
    spinLevelUp:      ' 🎉 РІВЕНЬ {level}! {perkDesc}',
    duelSelf:         '/me @{sender}, не можна дуелювати з собою! 🤦',
    duelNoFunds:      '/me @{sender}, недостатньо зіркового пилу для дуелі! (Потрібно: {bet} ✨)',
    duelTargetNoFunds:'/me @{sender}, у @{target} недостатньо зіркового пилу! (Потрібно: {bet} ✨)',
    duelChallenge:    '/me ⚔️ @{sender} кидає виклик @{target} на {bet} ✨! @{target}, напишіть !accept або !decline протягом 60 сек',
    duelBlocked:      '/me 🛡️ @{target} заблокував атаку @{sender}! Щит розбито!',
    duelWin:          '/me ⚔️ @{winner} перемагає @{loser} і забирає {bet} ✨! Баланс: {balance} ✨ (+{xp} XP)',
    duelExpired:      '/me ⚔️ @{target} не відповів на виклик @{sender}. Дуель скасована.',
    duelDeclined:     '/me ⚔️ @{target} відхилив виклик @{sender}.',
    boxResult:        '/me @{username} {emoji} Відкриває космічний ящик... {result} Баланс: {balance} ✨',
    boxNoFunds:       '/me @{username}, недостатньо зіркового пилу для ящика! (Потрібно: {cost} ✨)',
    boxLuckBoost:     '/me @{username} 🍀 Космічна удача зросла! Базова удача: {baseLuck}x',
    boxShield:        '/me @{username} 🛡️ Отримано щит! Наступна дуель буде заблокована.',
    dailyReward:      '/me @{username} 🌅 Щоденна нагорода: +{amount} ✨! Баланс: {balance} ✨',
    dailyCooldown:    '/me @{username} ⏰ Щоденна нагорода вже отримана! Наступна через {remaining}',
    shieldBought:     '/me @{username} 🛡️ Щит активовано! (-{cost} ✨) Баланс: {balance} ✨',
    shieldNoFunds:    '/me @{username}, недостатньо зіркового пилу для щита! (Потрібно: {cost} ✨)',
    shieldAlreadyActive: '/me @{username}, щит вже активний! 🛡️',
    shieldLevelRequired: '/me @{username}, щит доступний з рівня 10! (Зараз: рівень {level})',
    perks:            '/me @{username} | Рівень {level} | Удача: {luck}x | XP: {xp}/{xpNext}{extra}',
    leaderboard:      '/me 🏆 Космічний топ: {leaderboard}',
    noPlayers:        '/me Ще ніхто не грав у космічне казино! 🌌',
    rateLimitWarning: '/me @{username}, не так швидко, космонавте! 🚀',
    gameDisabled:     '/me 🌌 Космічне казино зараз закрито!'
  }
};

export { gameConfigCosmos };
export default gameConfigCosmos;
