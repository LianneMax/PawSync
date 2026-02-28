import { createLogger, format, transports } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
        : `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: path.join(logsDir, 'agent-err.log'),
      level: 'error',
      maxsize: 5_242_880, // 5 MB
      maxFiles: 3,
    }),
    new transports.File({
      filename: path.join(logsDir, 'agent-out.log'),
      maxsize: 10_485_760, // 10 MB
      maxFiles: 5,
    }),
  ],
});
