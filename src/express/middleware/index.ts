import { NextFunction, Request, RequestHandler, Response } from 'express';

import { DbContext } from '../../core/base/context';

/**
 * Middleware to handle transactions
 */
export const withTransaction = (
  context: DbContext,
): RequestHandler => async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let isHandled = false;

  const cleanup = async () => {
    if (isHandled) return;
    isHandled = true;

    try {
      if (res.statusCode < 400) {
        await context.commitTransaction();
      } else {
        await context.rollbackTransaction();
      }
    } catch (error) {
      console.error('Transaction handling error:', error);
    } finally {
      try {
        await context.dispose();
      } catch (error) {
        console.error('Context disposal error:', error);
      }
    }
  };

  try {
    await context.beginTransaction();
    res.once('finish', cleanup);
    next();
  } catch (error) {
    await cleanup();
    next(error);
  }
};
