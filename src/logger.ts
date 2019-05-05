import pino from 'pino';

export let logger: pino.Logger;

export function setGlobalLogger(newLogger: pino.Logger) {
  logger = newLogger;
}
