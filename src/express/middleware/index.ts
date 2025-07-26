import { ObjectLiteral } from 'typeorm';

import { NextFunction, Request, RequestHandler, Response } from 'express';

import { DbContext } from '../../core/base/context';
import { BaseRepository } from '../../core/base/repository';
import { EntityType } from '../../core/types/entity';
import { DbContextOptions } from '../../core/types/options';

type DbContextMethods = Pick<DbContext, 'commitTransaction' | 'rollbackTransaction' | 'dispose' | 'beginTransaction'>;

type DbContextWithRepositories<T extends Record<string, ObjectLiteral>> = DbContextMethods & {
  repositories: { [K in keyof T]: BaseRepository<T[K]> };
};

export type TypedRequest<T extends Record<string, ObjectLiteral>> = Request & {
  context?: DbContextWithRepositories<T>;
};


// Extend Express Request
declare module 'express' {
  export interface Request {
    context?: DbContextWithRepositories<Record<string, ObjectLiteral>>;
  }
}

/**
 * Creates middleware that injects a DbContext into the request
 */
export function withDbContext<T extends Record<string, ObjectLiteral>>(
  options: DbContextOptions,
  _entities: { [K in keyof T]: EntityType<T[K]> }
): RequestHandler {
  return async (req: Request, _res, next) => {
    try {
      const context = new DbContext(options);
      await context.initialize();

      const repositories = {} as { [K in keyof T]: BaseRepository<EntityType<T[K]>> };

      for (const [key, entity] of Object.entries(_entities)) {
        repositories[key as keyof T] = context.set(entity) as BaseRepository<EntityType<T[keyof T]>>;
      }

      req.context = {
        commitTransaction: context.commitTransaction.bind(context),
        rollbackTransaction: context.rollbackTransaction.bind(context),
        dispose: context.dispose.bind(context),
        beginTransaction: context.beginTransaction.bind(context),
        repositories
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to handle transactions
 */
export const withTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
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
