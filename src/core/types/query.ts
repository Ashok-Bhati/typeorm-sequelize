import { ObjectLiteral } from 'typeorm';

import { PredicateJSON } from './where';

/**
 * Represents a queryable collection of entities
 */
export interface IQueryable<T extends ObjectLiteral> {
  // Basic Query Methods
  first(): Promise<Partial<T>>;
  firstOrDefault(): Promise<Partial<T> | null>;
  single(): Promise<Partial<T>>;
  singleOrDefault(): Promise<Partial<T> | null>;
  where(predicate: PredicateJSON<T>): Omit<IQueryable<T>, 'where'>;
  orderBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
  orderByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;

  // Collection Methods
  toList(): Promise<Partial<T>[]>;
  toArray(): Promise<Partial<T>[]>;
  count(): Promise<number>;
  longCount(): Promise<number>;
  any(predicate?: (entity: T) => boolean): Promise<boolean>;
  all(predicate: (entity: T) => boolean): Promise<boolean>;

  // Projection Methods
  select<TResult extends ObjectLiteral>(selector: (entity: T) => TResult): IQueryable<TResult>;
  groupBy<TKey>(keySelector: (entity: T) => TKey): IGroupedQueryable<T, TKey>;

  // Loading Related Data
  include<TProperty>(navigationProperty: (entity: T) => TProperty | TProperty[]): IQueryable<T>;
  asNoTracking(): IQueryable<T>;

  // Set Operations
  distinct(): IQueryable<T>;
  skip(count: number): IQueryable<T>;
  take(count: number): IQueryable<T>;
  union(other: IQueryable<T>): IQueryable<T>;
  intersect(other: IQueryable<T>): IQueryable<T>;
  except(other: IQueryable<T>): IQueryable<T>;
}

/**
 * Represents an ordered queryable collection
 */
export interface IOrderedQueryable<T extends ObjectLiteral> extends Pick<IQueryable<T>, 'toArray' | 'toList' | 'first' | 'firstOrDefault' | 'single' | 'singleOrDefault' | 'skip' | 'take'> {
  thenBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
  thenByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
}

/**
 * Represents a grouped queryable collection
 */
export interface IGroupedQueryable<T extends ObjectLiteral, TKey> extends IQueryable<T> {
  key: TKey;
}

/**
 * Options for configuring query behavior
 */
export interface QueryOptions {
  tracking?: boolean;
  timeout?: number;
  maxResults?: number;
}

/**
 * Represents a query result with pagination information
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} 

export interface ExpressionParseResult {
  whereClause: string;
  params: Record<string, any>;
}

