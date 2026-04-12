import { createLogger, format, transports } from 'winston';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import util from 'node:util';

const baseFormat = format.combine(
  format.timestamp(),
  format.printf(({ level, message, timestamp, ...info }) => {
    // Only include meta if it has keys
    let meta = (info && Object.keys(info).length > 0) ? `| meta: ${util.inspect(info, {
      depth: 4,
      breakLength: 120,
      compact: true
    })}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${meta}`.trim();
  })
);

const debugOnlyFormat = format.combine(
  format((info) => {
    return info.level === 'debug' ? info : false;
  })(),
  baseFormat
);

// Ensure logs directory exists (resolve relative to this module, not CWD)
let logDir = 'logs';
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  logDir = join(__dirname, 'logs');
} catch {}
try { mkdirSync(logDir, { recursive: true }); } catch {}

const logger = createLogger({
  transports: [
    new transports.Console({
      level: 'debug',       // or 'info', etc.
      format: baseFormat
    }),
    new transports.File({
      filename: join(logDir, 'game.log'),
      level: 'debug',
      format: baseFormat
    })
  ]
});

logger.on('error', function (err) { console.log(err) });


export default logger;
