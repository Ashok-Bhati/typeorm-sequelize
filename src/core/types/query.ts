import { ObjectLiteral } from 'typeorm';

/**
 * Represents a queryable collection of entities
 */
export interface IQueryable<T extends ObjectLiteral> {
  // Basic Query Methods
  first(): Promise<Partial<T>>;
  firstOrDefault(): Promise<Partial<T> | null>;
  single(): Promise<Partial<T>>;
  singleOrDefault(): Promise<Partial<T> | null>;
  where(predicate: (entity: T) => boolean): IQueryable<T>;
  orderBy(keySelector: (entity: T) => any): IOrderedQueryable<T>;
  orderByDescending(keySelector: (entity: T) => any): IOrderedQueryable<T>;

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
export interface IOrderedQueryable<T extends ObjectLiteral> extends IQueryable<T> {
  thenBy(keySelector: (entity: T) => any): IOrderedQueryable<T>;
  thenByDescending(keySelector: (entity: T) => any): IOrderedQueryable<T>;
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
