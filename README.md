# Streamer.bot Games

## Overview

Streamer.bot Games is a Node.js application that provides a collection of interactive Twitch chat games for streamers. It integrates with Streamer.bot to manage game states, rewards, and chat interactions. The application includes multiple games like Knock Game, Retype Word Game, and Starfall Game, along with HTTP control API for remote management.

## Features

### Games
- **Knock Game (!тик)**: Users can "knock" themselves or others in chat with rate limiting and throttling.
- **Retype Word Game (!бля)**: A word retyping challenge game.
- **Starfall Game (Зорепад)**: A falling star collection game.

### Services
- **Message Service**: Handles Twitch chat messages and Streamer.bot actions.
- **Reward Service**: Manages reward distribution and validation.
- **Twitch Chat Monitor**: Monitors chat for game commands.
- **HTTP Control Service**: Provides REST API for game control.
- **LLM Connector Service**: Integrates with Google Generative AI for enhanced features.

### Infrastructure
- **Database**: SQLite-based storage for game statistics and user data.
- **Logging**: Winston-based logging system.
- **WebSocket**: Real-time communication with Streamer.bot.
- **HTTP Server**: Control API running on port 3001.

## Installation

1. Ensure Node.js is installed (version 16+ recommended).
2. Clone or download the project.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure the application in `config/config.js` if needed.

## Usage

### Starting the Server
Use the provided batch files:
- `startGameServer.bat`: Starts the server in the background.
- `stopGameServer.bat`: Stops the running server.

Or run manually:
```bash
node index.js
```

### HTTP Control API
The server exposes a REST API on `http://127.0.0.1:3001` for controlling games:

- `GET /status`: Get overall system status.
- `POST /enable/knock`: Enable knock game.
- `POST /disable/knock`: Disable knock game.
- `POST /enable/starfall`: Enable starfall game.
- `POST /disable/starfall`: Disable starfall game.
- `POST /enable/meh`: Enable retype word game.
- `POST /disable/meh`: Disable retype word game.

### Configuration
Edit `config/config.js` to customize:
- HTTP control host and port.
- Server messages and status texts.
- Game-specific settings in `games/gameConfig.js`.

## Project Structure

```
streamerbotgames/
├── index.js                     # Main entry point
├── jsconfig.json               # JavaScript configuration
├── package.json                # Dependencies and scripts
├── README.md                   # This file
├── startGameServer.bat         # Windows start script
├── stopGameServer.bat          # Windows stop script
├── config/
│   └── config.js               # Application configuration
├── db/
│   ├── db.js                   # Database connection
│   └── queries.js              # Database queries
├── games/
│   ├── gameConfig.js           # Game configurations
│   ├── gameState.js            # Global game state
│   ├── knockGame/
│   │   ├── knockGame.js        # Knock game logic
│   │   └── state.js            # Knock game state
│   ├── retypeWord/
│   │   ├── retypeWord.js       # Retype word game logic
│   │   └── state.js            # Retype word game state
│   └── starfallGame/
│       └── starfallGame.js     # Starfall game logic
├── managers/
│   └── ParticipantManager.js   # Participant management
├── routes/
│   └── controlRoutes.js        # HTTP control routes
├── services/
│   ├── HttpControlService.js   # HTTP control service
│   ├── LLMConnectorService.js  # AI integration
│   ├── MessageService.js       # Message handling
│   ├── RewardService.js        # Reward management
│   └── TwitchChatMonitor.js    # Chat monitoring
├── test/
│   └── GameTest.js             # Test suite
├── utils/
│   ├── GameTimer.js            # Timer utilities
│   ├── logger.js               # Logging utility
│   └── sendRequest.js          # HTTP request utility
├── logs/                       # Log files
└── messageTemplates/           # Message templates
    ├── DefaultMessageTemplate.js
    ├── KnockMessageTemplate.js
    └── StarfallMessageTemplate.js
```

## Component Relationships

This section explains how the main game components interact with each other.

- `index.js` initializes the application and connects each game to shared services.
- `TwitchChatMonitor` is a singleton that maintains one Streamer.bot connection and dispatches Twitch chat events to registered games.
- `KnockGame` uses `games/knockGame/state.js` for knock-specific state, rate limiting, enable/disable flags, and target normalization.
- `KnockGame` also uses `RewardService` to calculate random rewards and validate reward ranges.
- `MessageService` is used by games to send Twitch chat messages and to update StreamElements rewards.
- `KnockGame` persists command results through `db/queries.js`, recording knock counts and leaderboard data.
- `KnockGame` formats outgoing text with `utils/messageTemplates/KnockMessageTemplate.js` before sending it.
- `StarfallGame` uses `ParticipantManager` to cache joining users, select winners, and count participants.
- `StarfallGame` uses `RewardService` to choose reward amounts and winner counts, and `GameTimer` to orchestrate countdowns.
- `StarfallGame` formats game announcements and winner messages with `utils/messageTemplates/StarfallMessageTemplate.js`.
- `StarfallGame` also sends batch StreamElements rewards through `MessageService.setStreamElementsRewardMulti()`.
- `RetypeWordGame` uses `games/retypeWord/state.js` for last-message caching, per-user rate limiting, and bot speak throttling.
- `RetypeWordGame` transcribes user text from EN to UKR layout, validates it with `LLMConnectorService`, then sends results via `MessageService`.
- `HttpControlService` exposes a simple API used by control routes to enable, disable, and query game state.
- `routes/controlRoutes.js` connects HTTP endpoints to game state and control messages, using `serverMessages` from `config/config.js`.
- Shared utilities like `utils/logger.js` and `utils/sendRequest.js` support consistent logging and HTTP request handling across services.

## Code Guidelines

This project follows modern JavaScript development principles to ensure maintainable, scalable, and testable code.

### Maintainability
- Clear class responsibilities
- Easy to locate and fix issues
- Consistent code patterns

### Scalability
- Easy to add new features
- Modular design supports growth
- Reusable components

### Testability
- Each class can be tested independently
- Mock dependencies easily
- Clear interfaces

### Readability
- Self-documenting code structure
- Clear naming conventions
- Logical organization

### Key Principles

#### 1. **Separation of Concerns**
- Each class has a single, well-defined responsibility
- Clear boundaries between different layers of functionality
- Easy to test and maintain individual components

#### 2. **Dependency Injection**
- Services are injected into the main game class
- Easy to swap implementations or add new services
- Better testability through mocking

#### 3. **Error Handling**
- Comprehensive error handling at each layer
- Graceful degradation when services fail
- Detailed logging for debugging

#### 4. **State Management**
- Centralized game state in the main class
- Immutable state updates where possible
- Clear state transitions

#### 5. **Extensibility**
- Easy to add new game modes
- Simple to extend with new services
- Modular architecture supports feature additions

## Dependencies

- `@google/genai`: Google Generative AI integration
- `@streamerbot/client`: Streamer.bot client library
- `better-sqlite3`: SQLite database driver
- `winston`: Logging framework
- `ws`: WebSocket library

## Development

### Testing
Run tests with:
```bash
node test/GameTest.js
```

### Logging
Logs are stored in the `logs/` directory. The application uses Winston for structured logging.

### Database
The application uses SQLite for data persistence. Database files are created automatically.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test thoroughly.
5. Submit a pull request.

## License

[Specify license if applicable]

## Support

For issues or questions, please check the logs or contact the maintainer. 