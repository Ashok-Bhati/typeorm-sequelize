import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { DataSource } from 'typeorm';

import { EntityType } from '../types/entity';
import { QueryBuilderOptions } from '../types/options';
import { IGroupedQueryable, IOrderedQueryable, IQueryable, QueryOptions } from '../types/query';

/**
 * Base repository class implementing IQueryable interface
 */
export class BaseRepository<T extends ObjectLiteral> implements IQueryable<T> {
  protected readonly repository: Repository<T>;
  protected queryBuilder: SelectQueryBuilder<T>;
  protected options: QueryBuilderOptions;

  constructor(repository: Repository<T>) {
    this.repository = repository;
    this.queryBuilder = repository.createQueryBuilder();
    this.options = {};
  }

  /**
   * Gets the underlying TypeORM repository for direct operations
   */
  getRepository(): Repository<T> {
    return this.repository;
  }

  // Basic Query Methods
  async first(): Promise<T> {
    const result = await this.queryBuilder.limit(1).getOne();
    if (!result) {
      throw new Error('No entity found');
    }
    return result;
  }

  async firstOrDefault(): Promise<T | null> {
    return await this.queryBuilder.limit(1).getOne();
  }

  async single(): Promise<T> {
    const results = await this.queryBuilder.limit(2).getMany();
    if (results.length === 0) {
      throw new Error('No entity found');
    }
    if (results.length > 1) {
      throw new Error('Multiple entities found');
    }
    return results[0];
  }

  async singleOrDefault(): Promise<T | null> {
    const results = await this.queryBuilder.limit(2).getMany();
    if (results.length > 1) {
      throw new Error('Multiple entities found');
    }
    return results[0] || null;
  }

  where(predicate: (entity: T) => boolean): IQueryable<T> {
    // TODO: Implement expression parsing for where clause
    return this;
  }

  orderBy(keySelector: (entity: T) => any): IOrderedQueryable<T> {
    // TODO: Implement expression parsing for orderBy
    return this as unknown as IOrderedQueryable<T>;
  }

  orderByDescending(keySelector: (entity: T) => any): IOrderedQueryable<T> {
    // TODO: Implement expression parsing for orderByDescending
    return this as unknown as IOrderedQueryable<T>;
  }

  // Collection Methods
  async toList(): Promise<T[]> {
    return await this.queryBuilder.getMany();
  }

  async toArray(): Promise<T[]> {
    return await this.toList();
  }

  async count(): Promise<number> {
    return await this.queryBuilder.getCount();
  }

  async longCount(): Promise<number> {
    return await this.count();
  }

  async any(predicate?: (entity: T) => boolean): Promise<boolean> {
    if (predicate) {
      this.where(predicate);
    }
    return (await this.count()) > 0;
  }

  async all(predicate: (entity: T) => boolean): Promise<boolean> {
    // TODO: Implement expression parsing for all
    return false;
  }

  // Projection Methods
  select<TResult extends ObjectLiteral>(selector: (entity: T) => TResult): IQueryable<TResult> {
    // TODO: Implement expression parsing for select
    return this as unknown as IQueryable<TResult>;
  }

  groupBy<TKey>(keySelector: (entity: T) => TKey): IGroupedQueryable<T, TKey> {
    // TODO: Implement expression parsing for groupBy
    return this as unknown as IGroupedQueryable<T, TKey>;
  }

  // Loading Related Data
  include<TProperty>(navigationProperty: (entity: T) => TProperty | TProperty[]): IQueryable<T> {
    // TODO: Implement expression parsing for include
    return this;
  }

  asNoTracking(): IQueryable<T> {
    this.options.tracking = false;
    return this;
  }

  // Set Operations
  distinct(): IQueryable<T> {
    this.queryBuilder.distinct();
    return this;
  }

  skip(count: number): IQueryable<T> {
    this.queryBuilder.skip(count);
    return this;
  }

  take(count: number): IQueryable<T> {
    this.queryBuilder.take(count);
    return this;
  }

  union(other: IQueryable<T>): IQueryable<T> {
    // TODO: Implement union
    return this;
  }

  intersect(other: IQueryable<T>): IQueryable<T> {
    // TODO: Implement intersect
    return this;
  }

  except(other: IQueryable<T>): IQueryable<T> {
    // TODO: Implement except
    return this;
  }

  /**
   * Creates a new instance of the repository
   */
  static create<TEntity extends ObjectLiteral>(
    dataSource: DataSource,
    entityType: EntityType<TEntity>
  ): BaseRepository<TEntity> {
    const repository = dataSource.getRepository(entityType);
    return new BaseRepository<TEntity>(repository);
  }
} 
