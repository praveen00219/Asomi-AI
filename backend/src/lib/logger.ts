/**
 * Minimal structured logger.
 *
 * Deliberately tiny - the server has one hot path and Render/Better Stack both
 * ingest plain JSON lines. Swapping in pino later means changing this file only.
 *
 * Security: never log command text, email bodies, phone numbers or contact
 * names. docs/09-security-and-privacy.md requires that PII stay out of logs,
 * so callers pass counts and tool names, not content.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

function emit(level: Level, message: string, fields?: Fields): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => emit('debug', message, fields),
  info: (message: string, fields?: Fields) => emit('info', message, fields),
  warn: (message: string, fields?: Fields) => emit('warn', message, fields),
  error: (message: string, fields?: Fields) => emit('error', message, fields),
};
