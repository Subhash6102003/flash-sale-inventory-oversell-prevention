export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(prefix: string): Logger {
  const fmt = (level: string, msg: string, meta?: Record<string, unknown>): string => {
    const ts = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] [${level.toUpperCase()}] [${prefix}] ${msg}${metaStr}`;
  };

  return {
    info: (msg, meta) => console.log(fmt('info', msg, meta)),
    warn: (msg, meta) => console.warn(fmt('warn', msg, meta)),
    error: (msg, meta) => console.error(fmt('error', msg, meta)),
    debug: (msg, meta) => {
      if (process.env['LOG_LEVEL'] === 'debug') {
        console.debug(fmt('debug', msg, meta));
      }
    },
  };
}
