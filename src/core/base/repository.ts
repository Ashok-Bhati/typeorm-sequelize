import jsep from 'jsep';
import { DeepPartial, ObjectLiteral, RemoveOptions, Repository, SaveOptions, SelectQueryBuilder } from 'typeorm';

import { EntityType } from '../types/entity';
import { QueryBuilderOptions } from '../types/options';
import { ExpressionParseResult, IGroupedQueryable, IOrderedQueryable, IQueryable, QueryOptions } from '../types/query';
import { FieldComparison, PredicateJSON } from '../types/where';
import { DbContext } from './context';

/**
 * Base repository class implementing IQueryable interface
 */
export abstract class BaseRepository<T extends ObjectLiteral = ObjectLiteral> implements IQueryable<T>, IOrderedQueryable<T> {
  protected readonly repository: Repository<T>;
  protected queryBuilder: SelectQueryBuilder<T>;
  protected options: QueryBuilderOptions;
  protected readonly context: DbContext;

  constructor(context: DbContext, entity: EntityType<T>) {
    this.context = context;
    this.repository = context.getRepository(entity);
    this.queryBuilder = this.repository.createQueryBuilder();
    this.options = {};
  }

  /**
   * Gets the underlying TypeORM repository for direct operations
   */
  protected getTypeORMRepository(): Repository<T> {
    return this.repository;
  }

  /**
   * Creates a new query builder instance
   */
  protected createQueryBuilder(alias?: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }

  /**
   * Executes a raw SQL query
   */
  protected async query(sql: string, parameters?: any[]): Promise<any> {
    return this.repository.query(sql, parameters);
  }

  /**
   * Creates a new instance of the entity
   */
  protected create(data: DeepPartial<T>): T {
    return this.repository.create(data);
  }

  /**
   * Saves one or more entities
   */
  async save(entity: DeepPartial<T>, options?: SaveOptions): Promise<T>;
  async save(entities: DeepPartial<T>[], options?: SaveOptions): Promise<T[]>;
  async save(entityOrEntities: DeepPartial<T> | DeepPartial<T>[], options?: SaveOptions): Promise<T | T[]> {
    return this.repository.save(entityOrEntities as any, options);
  }

  /**
   * Removes one or more entities
   */
  async remove(entity: T, options?: RemoveOptions): Promise<T>;
  async remove(entities: T[], options?: RemoveOptions): Promise<T[]>;
  async remove(entityOrEntities: T | T[], options?: RemoveOptions): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return this.repository.remove(entityOrEntities, options);
    }
    return this.repository.remove(entityOrEntities, options);
  }

  /**
   * Finds entities that match given conditions
   */
  protected async find(conditions?: any): Promise<T[]> {
    return this.repository.find(conditions);
  }

  /**
   * Finds first entity that matches given conditions
   */
  protected async findOne(conditions?: any): Promise<T | null> {
    return this.repository.findOne(conditions);
  }

  /**
   * Counts entities that match given conditions
   */
  protected async countBy(conditions?: any): Promise<number> {
    return this.repository.count(conditions);
  }

  // Required IQueryable implementation
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

  async count(): Promise<number> {
    return await this.queryBuilder.getCount();
  }

  // IQueryable implementation
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

  where(predicate: PredicateJSON<T>): Omit<IQueryable<T>, 'where'> {
    const alias = this.queryBuilder.alias;
    const { whereClause, params } = this.parseJsonPredicate(predicate, alias);
    console.log(`whereClause: ${whereClause}`);
    console.log(`params: ${JSON.stringify(params, null, 2)}`);

    this.queryBuilder.where(whereClause, params);
    return this as unknown as Omit<IQueryable<T>, 'where'>;
  }

  orderBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'ASC');
    return this as unknown as IOrderedQueryable<T>;
  }

  orderByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'DESC');
    return this as unknown as IOrderedQueryable<T>;
  }

  // Collection Methods
  async toList(): Promise<T[]> {
    return await this.queryBuilder.getMany();
  }

  async toArray(): Promise<T[]> {
    return await this.toList();
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

  async removeAll(): Promise<void> {
    await this.repository.clear();
  }
  
  thenBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'ASC');
    return this as unknown as IOrderedQueryable<T>;
  }
  thenByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'DESC');
    return this as unknown as IOrderedQueryable<T>;
  }
} 
