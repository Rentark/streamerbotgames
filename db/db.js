import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';

// Resolve database path relative to this module
// Stores database in the project root (streamerbotgames/ directory)
let dbPath = 'bot.db';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Go up one level from db/ to streamerbotgames/, then create bot.db there
  dbPath = join(__dirname, '..', 'bot.db');
} catch (error) {
  logger.warn('Could not resolve database path, using default', { error });
}

/** @type {InstanceType<typeof Database> | null} */
let db = null;

/**
 * Initialize and configure the database connection
 * @returns {InstanceType<typeof Database>} The database instance
 */
export function initializeDatabase() {
  if (db) {
    logger.warn('Database already initialized');
    return db;
  }

  try {
    logger.info('Initializing database', { dbPath });
    db = new Database(dbPath);

    // Configure database pragmas for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knocks (
        user_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        stars INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_knocks_total
      ON knocks(target_id, count DESC);
    `);

    logger.info('Database initialized successfully');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database', { error, dbPath });
    throw error;
  }
}

/**
 * Get the database instance (initializes if needed)
 * @returns {InstanceType<typeof Database>} The database instance
 */
export function getDatabase() {
  if (!db) {
    return initializeDatabase();
  }
  return db; // db is guaranteed to be Database here, not null
}

// Auto-initialize on import
initializeDatabase();

// Export the db instance for backward compatibility
export { db };
