import { EntityMetadata, ObjectLiteral } from 'typeorm';

import { IncludeJSON } from './include';
import { SelectJSON } from './select';
import { PredicateJSON } from './where';

export interface IQueryableWhereResult<T extends ObjectLiteral> extends Omit<IQueryable<T>, 'where'> {}
export interface IQueryableSelectResult<T extends ObjectLiteral> extends Omit<IQueryable<T>, 'select' | 'include'> {}
export interface IQueryableGroupByResult<T extends ObjectLiteral> extends Pick<IQueryable<T>, | 'toList' | 'first' | 'firstOrDefault' | 'single' | 'singleOrDefault' | 'skip' | 'take' | 'orderBy' | 'orderByDescending'> {}
export interface IQueryableOrderByResult<T extends ObjectLiteral> extends Omit<IQueryableGroupByResult<T>, 'orderBy' | 'orderByDescending'> {}
export type SingleResult<T extends ObjectLiteral> = Partial<T>;
export type SingleResultOrNull<T extends ObjectLiteral> = Partial<T> | null;
export type ListResult<T extends ObjectLiteral> = Partial<T>[];
export interface IQueryableRelationResult<T extends ObjectLiteral> extends Omit<IQueryable<T>, 'include'> {}

/**
 * Represents a queryable collection of entities
 */
export interface IQueryable<T extends ObjectLiteral> {
  // Basic Query Methods
  first(): Promise<SingleResult<T>>;
  firstOrDefault(): Promise<SingleResultOrNull<T>>;
  single(): Promise<SingleResult<T>>;
  singleOrDefault(): Promise<SingleResultOrNull<T>>;
  where(predicate: PredicateJSON<T>): IQueryableWhereResult<T>;
  orderBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
  orderByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;

  // Collection Methods
  toList(): Promise<ListResult<T>>;
  withCount(): Promise<[number, ListResult<T>]>;
  any(): Promise<boolean>;

  // Projection Methods
  select(selector: SelectJSON<T>): IQueryableSelectResult<T>;
  groupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T>;

  // Loading Related Data
  include(keySelector: IncludeJSON<T>): IQueryableRelationResult<T>;
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
export interface IOrderedQueryable<T extends ObjectLiteral> extends IQueryableOrderByResult<T> {
  thenBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
  thenByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T>;
}

/**
 * Represents a grouped queryable collection
 */
export interface IGroupedQueryable<T extends ObjectLiteral> extends IQueryableGroupByResult<T> {
  thenGroupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T>;
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

