import { stringify } from 'flatted'
import jsep from 'jsep';
import { cloneDeep, map } from 'lodash'
import { DeepPartial, ObjectLiteral, RemoveOptions, Repository, SaveOptions, SelectQueryBuilder } from 'typeorm';

import { EntityType } from '../types/entity';
import { QueryBuilderOptions } from '../types/options';
import { ExpressionParseResult, IGroupedQueryable, IOrderedQueryable, IQueryable, QueryOptions } from '../types/query';
import { SelectJSON, SelectorValue } from '../types/select';
import { FieldComparison, PredicateJSON } from '../types/where';
import { DbContext } from './context';

/**
 * Base repository class implementing IQueryable interface
 */
export abstract class BaseRepository<T extends ObjectLiteral = ObjectLiteral> implements IQueryable<T>, IOrderedQueryable<T>, IGroupedQueryable<T> {
  protected readonly repository: Repository<T>;
  protected queryBuilder: SelectQueryBuilder<T>;
  protected options: QueryBuilderOptions;
  protected readonly context: DbContext;

  constructor(context: DbContext, entity: EntityType<T>) {
    this.context = context;
    this.repository = context.getRepository(entity);
    this.queryBuilder = this.repository.createQueryBuilder(entity.name.toLowerCase());
    this.options = {};
  }

  //#region IQueryable implementation

  //#region Basic Query Methods

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

  //#endregion

  //#region Collection Methods

  async toList(): Promise<T[]> {
    return await this.queryBuilder.getMany();
  }

  async withCount(): Promise<[number, Partial<T>[]]> {
    const [results, count] = await this.queryBuilder.getManyAndCount();
    return [count, results];
  }

  async any(): Promise<boolean> {
    return await this.queryBuilder.getExists();
  }

  //#endregion

  //#region Projection Methods

  select(selector: SelectJSON<T>): IQueryable<T> {
    const alias = this.queryBuilder.alias;
    console.log(`alias: ${alias}`);
    const selectors = Object.entries(selector);
    map(selectors, ([key, value], index) => {
      const column = `${alias}.${key}`;
      this.addSelect({column, alias: (value as SelectorValue).as}, index === 0);
    });
    return this;
  }

  groupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T> {
    this.queryBuilder.groupBy(keySelector as string);
    return this as unknown as IGroupedQueryable<T>;
  }

  //#endregion

  //#region Loading Related Data

  include<TProperty>(keySelector: TProperty, as?: string): IQueryable<T> {
    const alias = this.queryBuilder.alias;
    this.queryBuilder.leftJoinAndSelect(`${alias}.${keySelector}`, as || keySelector as string);
    return this;
  }

  asNoTracking(): IQueryable<T> {
    this.options.tracking = false;
    return this;
  }

  //#endregion

  //#region Set Operations

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

  //#endregion

  //#endregion

  //#region IOrderedQueryable implementation

  thenBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'ASC');
    return this as unknown as IOrderedQueryable<T>;
  }

  thenByDescending<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'DESC');
    return this as unknown as IOrderedQueryable<T>;
  }

  //#endregion

  //#region IGroupedQueryable implementation

  thenGroupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T> {
    this.queryBuilder.addGroupBy(keySelector as string);
    return this as unknown as IGroupedQueryable<T>;
  }

  //#endregion

  //#region private methods

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

  private addSelect(select: {column: string, alias?: string}, isFirst: boolean = false): void {
    console.log(`select: ${select.column}, alias: ${select.alias}, isFirst: ${isFirst}`);
    if (isFirst) {
      this.queryBuilder.select(select.column, select.alias);
    } else {
      this.queryBuilder.addSelect(select.column, select.alias);
    }
  }

  //#endregion
} 
