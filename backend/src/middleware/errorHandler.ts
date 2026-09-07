import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${status} ${message}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${status} ${message}`);
  }

  if (res.headersSent) return next(err);
  res.status(status).json({ error: message });
};
