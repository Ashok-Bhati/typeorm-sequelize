import jsep from 'jsep';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { DataSource } from 'typeorm';

import { FieldComparison, PredicateJSON } from '../types/where';
import { EntityType } from '../types/entity';
import { QueryBuilderOptions } from '../types/options';
import { ExpressionParseResult, IGroupedQueryable, IOrderedQueryable, IQueryable, QueryOptions } from '../types/query';

/**
 * Base repository class implementing IQueryable interface
 */
export class BaseRepository<T extends ObjectLiteral = ObjectLiteral> implements IQueryable<T> {
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

  private parseJsonPredicate<T>(
    predicate: PredicateJSON<T>,
    alias: string
  ): ExpressionParseResult {
    const params: Record<string, any> = {};
    let index = 0;
  
    function walk(expr: PredicateJSON<T>): string {
      if ('$and' in expr) {
        return `(${(expr.$and as any[]).map(walk).join(' AND ')})`;
      }
      if ('$or' in expr) {
        return `(${(expr.$or as any[]).map(walk).join(' OR ')})`;
      }
  
      return Object.entries(expr).map(([field, conditions]) => {
        return Object.entries(conditions as FieldComparison).map(([op, value]) => {
          const paramKey = `${field}_${index++}`;
  
          const column = `${alias}.${field}`;
          switch (op) {
            case '$eq':
              params[paramKey] = value;
              return `${column} = :${paramKey}`;
            case '$ne':
              params[paramKey] = value;
              return `${column} != :${paramKey}`;
            case '$lt':
              params[paramKey] = value;
              return `${column} < :${paramKey}`;
            case '$lte':
              params[paramKey] = value;
              return `${column} <= :${paramKey}`;
            case '$gt':
              params[paramKey] = value;
              return `${column} > :${paramKey}`;
            case '$gte':
              params[paramKey] = value;
              return `${column} >= :${paramKey}`;
            case '$in':
              params[paramKey] = value;
              return `${column} IN (:...${paramKey})`;
            case '$notIn':
              params[paramKey] = value;
              return `${column} NOT IN (:...${paramKey})`;
            case '$between': {
              const [start, end] = value as [any, any];
              params[`${paramKey}_start`] = start;
              params[`${paramKey}_end`] = end;
              return `${column} BETWEEN :${paramKey}_start AND :${paramKey}_end`;
            }
            case '$like':
              params[paramKey] = `%${value}%`;
              return `${column} LIKE :${paramKey}`;
            case '$iLike':
              params[paramKey] = `%${value}%`;
              return `${column} ILIKE :${paramKey}`;
            case '$notLike':
              params[paramKey] = `%${value}%`;
              return `${column} NOT LIKE :${paramKey}`;
            case '$notILike':
              params[paramKey] = `%${value}%`;
              return `${column} NOT ILIKE :${paramKey}`;
            case '$isNull':
              return `${column} IS NULL`;
            case '$isNotNull':
              return `${column} IS NOT NULL`;
            case '$contains':
              params[paramKey] = `%${value}%`;
              return `${column} LIKE :${paramKey}`;
            case '$startsWith':
              params[paramKey] = `${value}%`;
              return `${column} LIKE :${paramKey}`;
            case '$endsWith':
              params[paramKey] = `%${value}`;
              return `${column} LIKE :${paramKey}`;
            case '$matches':
              params[paramKey] = value;
              return `${column} ~ :${paramKey}`;
            default:
              throw new Error(`Unsupported operator: ${op}`);
          }
        }).join(' AND ');
      }).join(' AND ');
    }
  
    const whereClause = walk(predicate);
    return { whereClause, params };
  }

  where(predicate: PredicateJSON<T>): IQueryable<T> {
    // Extract the alias from the query builder
    const alias = this.queryBuilder.alias;
    const { whereClause, params } = this.parseJsonPredicate(predicate, alias);
    console.log(`whereClause: ${whereClause}`);
    console.log(`params: ${JSON.stringify(params, null, 2)}`);

    this.queryBuilder.where(whereClause, params);
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
      // this.where(predicate);
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
