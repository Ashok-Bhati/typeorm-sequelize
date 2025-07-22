import { Request, Response, NextFunction } from 'express';
import { DbContext } from '../../core/base/context';

declare module 'express' {
  interface Request {
    dbContext?: DbContext;
  }
}

/**
 * Middleware to inject DbContext into Express request
 */
export const withDbContext = (context: DbContext) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.dbContext = context;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to handle transactions
 */
export const withTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const context = req.dbContext;
  if (!context) {
    next(new Error('DbContext not found in request'));
    return;
  }

  try {
    await context.beginTransaction();
    res.on('finish', async () => {
      if (res.statusCode < 400) {
        await context.commitTransaction();
      } else {
        await context.rollbackTransaction();
      }
    });
    next();
  } catch (error) {
    await context.rollbackTransaction();
    next(error);
  }
}; 
