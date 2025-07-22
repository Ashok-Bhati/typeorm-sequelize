import { NextFunction, Request, RequestHandler, Response } from 'express';

import { DbContext, DbContextWithRepositories } from '../../core/base/context';
import { DbContextOptions, RepositoryRegistration } from '../../core/types/options';

declare module 'express' {
  interface Request {
    context?: DbContextWithRepositories<any>;
  }
}

/**
 * Creates middleware that injects a DbContext into the request
 */
export function withDbContext<T extends RepositoryRegistration>(options: DbContextOptions<T>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = new DbContext<T>(options);
      await context.initialize();

      // Create proxy to handle repository access
      const contextProxy = new Proxy(context, {
        get(target: DbContext<T>, prop: string) {
          if (prop in target) {
            return (target as any)[prop];
          }
          return target.getRepository(prop as keyof T & string);
        }
      });

      (req as any).context = contextProxy as DbContextWithRepositories<T>;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to handle transactions
 */
export const withTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const context = req.context;
  if (!context) {
    next(new Error('DbContext not found in request'));
    return;
  }

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
