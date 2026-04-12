const gameConfigStarfall = {
  "gameName": {
    "single": "зорепад",
    "multi": "мульти-зорепад"
  },
  "gameJoinMessage": "ловлю",
  "gameLength": 45_000,
  "gameStartMessage": '/me moonos1Stars починається {gameName} moonos1Stars на {rewardAmount} {rewardType} moonos1Stars він закінчиться через {gameLength} секунд, пишіть "ловлю" щоб ловити {rewardTypeFull} moonos1Stars',
  "gameEndNotifMessage": '/me moonos1Stars {gameName} moonos1Stars на {rewardAmount} {rewardType} закінчиться через {gameLength} {seconds}, пишіть "ловлю" щоб приєднатися moonos1Stars',
  "gameEndNotifIntervals": [13_000, 14_000, 8_000],
  "noJoinMessage": "/me moonos1Stars {gameName} закінчився! ніхто не ловив зірочки! (( moonos1Stars",
  "winnerMessage": "/me moonos1Stars {gameName} закінчився, {winner}, {winWords} {rewardAmount} {rewardType} moonos1Stars",
  "multiWinWord": "кожен з Вас виграв",
  "singleWinWord": "Ви виграли",
  // "riggedWin": "RIGGED!!! LUL Streamer won the prize!",
  "endingMessage": "",
  "minWinners": 1,
  "maxWinners": 2,
  "randomWinnerCount": true,
  "minReward": 1000,
  "maxReward": 15000,
  "rewardFailMessage": "/me Помилка під час видачі балів! Статус код: {statusCode}",
  "rewardTypes": {"name": "зірочки", "partialName": "зіроч", "0": "ок", "1": "ку", "2-3": "ки"},
  "secondsTypes": {
    "name": "секунда", "partialName": "секунд",
    "0": "",
    "2-4": "и"
  },
  "stickmenJoinMessage": ["/me @gous_stickmen, нарешті, ти зміг! moonos1Petpet moonos1Stars",
    "/me @gous_stickmen, та це ж диво - ти вже ловиш!  moonos1Teacup ",
    "/me @gous_stickmen, оце так, правильне слово! ти в грі! moonos1Shock ",
    "/me @gous_stickmen, ти вже наближаєшся до виграшу! moonos1Glasses ",
    "/me @gous_stickmen, є, ти впорався! moonos1Salto moonos1Salto",
    "/me @gous_stickmen, ого, цього разу без помилок! moonos1Eat moonos1Gnida",
    "/me @gous_stickmen, ну, шось написав та й добре moonos1Meh moonos1Gnida"
  ]
} 

const gameConfigKnock = {
  rateLimit: {
    windowMs: 60_000,
    maxUses: 3
  },
  botMessages: {
    windowMs: 30_000,
    maxMessages: 20
  },
  warningRateLimit: {
    windowMs: 30_000,
    maxWarnings: 1
  },
  messages: {
    rateLimitWarning: '/me 🚦 @{sender}, воу воу воу призупинись тикати!',
    knockSelf: '/me moonos1Stars @{sender} тикає в небо в {count}-й раз! {randomWords} {rewardAmount} {rewardType}!',
    knockOthers: '/me moonos1Stars @{sender} тикає @{target} ({count})! {randomWords} {rewardAmount} {rewardType}!',
    noKnocks: '/me No knocks yet 👀',
    leaderboard: '/me 🏆 ТОП тикерів: {leaderboard}',
    rewardFailMessage: "/me Помилка під час видачі балів! Статус код: {statusCode}",
    randomWordsSelf: [
      "У всесвіту відібрано",
      "За тик впіймано",
      "Залутано",
      "Впіймано",
      "За тик залутано",
    ],
    randomWordsOther: [
      "Відібрано",
      "За тик вкрадено",
      "Залутано",
      "За тик відібрано",
      "За тик залутано",
      "Аж зорі з очей! Вкрадено",
      "Впіймано",
      "За тик впіймано"
    ]
  },
  commands: {
    knock: ["тик", "!тик"],
    knockTop: ["тиктоп", "!тиктоп"]
  },
  "minReward": 10,
  "maxReward": 35,
  "rewardTypes": {"name": "зірочки", "partialName": "зіроч", "0": "ок", "1": "ку", "2-3": "ки"},
}

const gameConfigRetypeWord = {
  commands: {
    meh: new Set(['!meh', "!бля", "бля", "!ой", "!,kz", ",kz"])
  },
  // Per-user command rate limiting (similar spirit to knockGame)
  rateLimit: {
    windowMs: 60_000,
    maxUses: 3
  },
  // Bot speaking throttling (sliding window)
  botMessages: {
    windowMs: 30_000,
    maxMessages: 10
  },
  transcription: {
    // Minimum previous message length to even consider transcription
    minPreviousMessageChars: 2,
    // Minimum amount of Cyrillic characters in the transcribed output
    // used as a heuristic that the input was typed on an English layout.
    minUkrCyrillicLetters: 2,
    // Chat is lowercased; whole chat tokens matching this prefix are kept (e.g. moonos1love).
    channelEmojiPrefixes: ['moonos1']
  },
  responseTemplate: '/me @{sender} намагався сказати: {text}'
};

export { gameConfigKnock, gameConfigStarfall, gameConfigRetypeWord };
