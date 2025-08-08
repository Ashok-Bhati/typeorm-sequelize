import { stringify } from 'flatted';
import jsep from 'jsep';
import { cloneDeep, map, set } from 'lodash';
import {
  DeepPartial,
  EntityMetadata,
  ObjectLiteral,
  RemoveOptions,
  Repository,
  SaveOptions,
  SelectQueryBuilder,
} from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

import { EntityType } from '../types/entity';
import { IncludeJSON, IncludeJSONWithColumns, IncludeValue, IncludeValueWithColumns } from '../types/include';
import { QueryBuilderOptions } from '../types/options';
import {
  ExpressionParseResult,
  IGroupedQueryable,
  IOrderedQueryable,
  IQueryable,
  IQueryableRelationResult,
  QueryOptions,
} from '../types/query';
import { SelectJSON, ScalarSelectorValue } from '../types/select';
import { FieldComparison, PredicateJSON } from '../types/where';
import { DbContext } from './context';
import { deepClone } from '../utils';
import { get } from 'lodash'

/**
 * Base repository class implementing IQueryable interface
 */
export abstract class BaseRepository<T extends ObjectLiteral = ObjectLiteral>
  implements IQueryable<T>, IOrderedQueryable<T>, IGroupedQueryable<T>
{
  protected readonly repository: Repository<T>;
  protected queryBuilder: SelectQueryBuilder<T>;
  protected options: QueryBuilderOptions;
  protected readonly context: DbContext;
  protected metadata: EntityMetadata;
  protected readonly relationAliases: Record<string, { alias: string; path: string }> = {};
  protected selectedRelationColumns: IncludeJSONWithColumns<T> = {};
  protected selectedColumns: Record<string, boolean | { alias: string }> = {};

  constructor(context: DbContext, entity: EntityType<T>) {
    this.context = context;
    this.repository = context.getRepository(entity);
    this.queryBuilder = this.repository.createQueryBuilder(entity.name.toLowerCase());
    this.options = {};
    this.metadata = this.repository.metadata;
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
    // console.log(`whereClause: ${whereClause}`);
    // console.log(`params: ${JSON.stringify(params, null, 2)}`);

    this.queryBuilder.where(whereClause, params);
    return this as unknown as Omit<IQueryable<T>, 'where'>;
  }

  orderBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'ASC');
    return this as unknown as IOrderedQueryable<T>;
  }

  orderByDescending<K extends keyof T>(
    keySelector: T[K] extends Function ? never : K,
  ): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'DESC');
    return this as unknown as IOrderedQueryable<T>;
  }

  //#endregion

  //#region Collection Methods

  async toList(): Promise<T[]> {
    console.log(`\n================ toList ==================\n`);
    console.log(`queryBuilder: ${this.queryBuilder.getQueryAndParameters()}`);
    console.log(`\n================ toList end ==================\n`);
    const data = await this.queryBuilder.getMany();
    return data.map((item) => this.filterSelectedColumns(item));
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
    // console.log('\n================ select ==================\n');
    const alias = this.queryBuilder.alias;
    this.addSelect(selector, alias);
    // console.log('\n================ select end ==================\n');
    return this;
  }

  groupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T> {
    this.queryBuilder.groupBy(keySelector as string);
    return this as unknown as IGroupedQueryable<T>;
  }

  //#endregion

  //#region Loading Related Data

  include(keySelector: IncludeJSON<T>): IQueryableRelationResult<T> {
    // console.log('\n================ include ==================\n');
    const alias = this.queryBuilder.alias;
    this.addInclude(keySelector, alias);
    // console.log('\n================ include end ==================\n');
    return this as unknown as IQueryableRelationResult<T>;
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

  thenByDescending<K extends keyof T>(
    keySelector: T[K] extends Function ? never : K,
  ): IOrderedQueryable<T> {
    this.queryBuilder.addOrderBy(keySelector as string, 'DESC');
    return this as unknown as IOrderedQueryable<T>;
  }

  //#endregion

  //#region IGroupedQueryable implementation

  thenGroupBy<K extends keyof T>(
    keySelector: T[K] extends Function ? never : K,
  ): IGroupedQueryable<T> {
    this.queryBuilder.addGroupBy(keySelector as string);
    return this as unknown as IGroupedQueryable<T>;
  }

  //#endregion

  //#region private methods

  private parseJsonPredicate<T>(predicate: PredicateJSON<T>, alias: string): ExpressionParseResult {
    const params: Record<string, any> = {};
    let index = 0;

    function walk(expr: PredicateJSON<T>): string {
      if ('$and' in expr) {
        return `(${(expr.$and as any[]).map(walk).join(' AND ')})`;
      }
      if ('$or' in expr) {
        return `(${(expr.$or as any[]).map(walk).join(' OR ')})`;
      }

      return Object.entries(expr)
        .map(([field, conditions]) => {
          return Object.entries(conditions as FieldComparison)
            .map(([op, value]) => {
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
            })
            .join(' AND ');
        })
        .join(' AND ');
    }

    const whereClause = walk(predicate);
    return { whereClause, params };
  }

  private addSelect<U extends ObjectLiteral>(
    data: SelectJSON<U>,
    parentAlias: string = this.queryBuilder.alias,
    isFirst: boolean = true,
    relationKey: string = '',
  ): void {
    console.log('\n================ addSelect ==================\n');
    console.log(`parentAlias: ${parentAlias}`);
    const selectors = Object.entries(data);
    console.log(`selectors: ${JSON.stringify(selectors, null, 2)}`);
    map(selectors, ([key, value], index) => {
      let relationPath = `${relationKey ? `${relationKey}.${key}` : key}`;
      console.log(`path: ${relationPath}`);
      const alias = `${parentAlias}_${key}`;
      console.log(`alias: ${alias}`);


      if (typeof value === 'object') {
        if (value !== null && 'as' in value) {
          console.log(`value is object and has as alias`);
          set(this.selectedColumns, key, { alias: (value as ScalarSelectorValue<U, keyof U>).as });
        } else {
          console.log(`value is object and does not have as alias`);
          console.log(`this.relationAliases: ${JSON.stringify(this.relationAliases, null, 2)}`);
          const relationAlias = this.relationAliases[relationPath];
          if(!relationAlias){
            throw new Error(`Relation alias not found for ${relationPath}`);
          }
          console.log(`relationAlias: ${JSON.stringify(relationAlias, null, 2)}`);
          const path = relationAlias.path;
          const pathSplit = path.split('.');
          const pathSplitLength = pathSplit.length;
          if (pathSplitLength > 1) {
            console.log(`pathSplitLength > 1`);
            const selectedRelationColumnsPath = pathSplit.slice(0, -1).join('.');
            const selectedRelationColumn = get(
              this.selectedRelationColumns,
              selectedRelationColumnsPath,
            );
            if (selectedRelationColumn) {
              console.log(
                `selectedRelationColumn: ${JSON.stringify(selectedRelationColumn, null, 2)}`,
              );
              set(selectedRelationColumn, key, {
                ...selectedRelationColumn,
                alias: relationAlias.alias,
                columns: [],
                path: relationAlias.path,
              });
            } else {
              console.log(`selectedRelationColumn not found`);
              set(this.selectedRelationColumns, selectedRelationColumnsPath, {
                [key]: { alias: relationAlias.alias, columns: [], path: relationAlias.path },
              });
              console.log(`this.selectedRelationColumns: ${JSON.stringify(this.selectedRelationColumns, null, 2)}`);
            }
          } else {
            console.log(`pathSplitLength <= 1`);
            set(this.selectedRelationColumns, path, {
              alias: relationAlias.alias,
              columns: [],
              path: relationAlias.path,
            });
          }
          this.addSelect(value as SelectJSON<U>, relationAlias.alias, false, path);
        }
      } else if (value === true && !relationKey) {
        console.log(`value is true and relationKey is not set`);
        set(this.selectedColumns, key, true);
      } else if (value === true && relationKey) {
        console.log(`value is true and relationKey is ${relationKey}`);
        console.log(`relationKey: ${relationKey}`);
        console.log(
          `selectedRelationColumns: ${JSON.stringify(this.selectedRelationColumns, null, 2)}`,
        );
        const relationAlias = get(this.selectedRelationColumns, relationKey);
        console.log(`relationAlias: ${relationAlias}`);
        set(this.selectedRelationColumns, relationKey, {
          alias: relationAlias.alias,
          columns: {
            ...relationAlias.columns,
            [key]: true,
          },
          path: relationAlias.path,
        });
      }
      console.log(
        `this.selectedRelationColumns: ${JSON.stringify(this.selectedRelationColumns, null, 2)}`,
      );
      this.filterSelectedRelationColumnsUndefined(this.selectedRelationColumns);
    });
    console.log('\n================ addSelect end ==================\n');
  }

  private addInclude<U extends ObjectLiteral>(
    data: IncludeJSON<U>,
    parentAlias: string = this.queryBuilder.alias,
    parentPath: string = '',
  ): void {
    const selectors = Object.entries(data);
    console.log(`selectors: ${JSON.stringify(selectors, null, 2)}`);
    map(selectors, ([key, value]) => {
      const propertyPath = parentPath ? `${parentPath}.${key}` : key;
      console.log(`propertyPath: ${propertyPath}`);
      const column = `${parentAlias}.${key}`;
      console.log(`column: ${column}`);
      if (typeof value === 'object') {
        const realValue = value as IncludeValue<U, keyof U>;
        const { as, include } = realValue;
        const relationAlias = as || `${parentAlias}_${key}`;
        console.log(`relationAlias: ${relationAlias}`);
        this.relationAliases[propertyPath] = { alias: relationAlias, path: propertyPath };
        this.queryBuilder.leftJoinAndSelect(column, relationAlias);
        console.log(`expressionMapAliases: ${stringify(this.queryBuilder.expressionMap.aliases)}`);
        if (include) {
          this.addInclude(include, relationAlias, propertyPath);
        }
      } else {
        const relationAlias = `${parentAlias}_${key}`;
        this.relationAliases[propertyPath] = { alias: relationAlias, path: propertyPath };
        this.queryBuilder.leftJoinAndSelect(column, relationAlias);
      }
    });
  }

  private filterSelectedColumns(data: T): T {
    // console.log(`\n================ filterSelectedColumns ==================\n`);
    // console.log(`data: ${JSON.stringify(data, null, 2)}`);
    // console.log(
    //   `selectedRelationColumns: ${JSON.stringify(this.selectedRelationColumns, null, 2)}`,
    // );
    // console.log(`selectedColumns: ${JSON.stringify(this.selectedColumns, null, 2)}`);
    const result: Record<string, any> = {};
    for (const key in this.selectedColumns) {
      const realValue = this.selectedColumns[key];
      if (typeof realValue === 'boolean') {
        result[key] = get(data, key);
      } else {
        result[realValue.alias] = get(data, key);
      }
    }
    this.mapRelationColumns(data, this.selectedRelationColumns, result);
    // console.log(`result: ${JSON.stringify(result, null, 2)}`);
    // console.log(`\n================ filterSelectedColumns end ==================\n`);
    return result as T;
  }

  private mapRelationColumns(
    data: T,
    columnsData: IncludeJSONWithColumns<T>,
    result: Record<string, any>,
  ): Record<string, any> {
    Object.entries(columnsData).forEach(([key, value]) => {
      console.log(`key: ${key}`);
      console.log(`value: ${JSON.stringify(value, null, 2)}`);
      const { columns, path, alias, ...rest } = value as IncludeValueWithColumns<T, keyof T>;
      const existingData = get(data, path || key);

      if (existingData) {
        result[alias || key] = this.processRelationData(
          existingData,
          columns as Record<string, boolean | { alias: string }>,
          rest as unknown as IncludeJSONWithColumns<T>,
          data,
        );
      }
    });
    return result;
  }

  private processRelationData(
    item: any,
    columns: Record<string, boolean | { alias: string }>,
    rest: IncludeJSONWithColumns<T>,
    parentData: any,
  ): any {
    if (!item) return null;
    // console.log(`\n================ processRelationData ==================\n`);
    // console.log(`item: ${JSON.stringify(item, null, 2)}`);
    // console.log(`columns: ${JSON.stringify(columns, null, 2)}`);
    // console.log(`rest: ${JSON.stringify(rest, null, 2)}`);
    // console.log(`parentData: ${JSON.stringify(parentData, null, 2)}`);
    // console.log(`\n================ processRelationData end ==================\n`);

    if (Array.isArray(item)) {
      // console.log(`item is array`);
      return item.map((subItem) => this.processRelationData(subItem, columns, rest, parentData));
    }

    const result: Record<string, any> = {};

    // Add selected columns
    Object.entries(columns).forEach(([col, value]) => {
      const realValue = value as boolean | { alias: string };
      if (item[col] !== undefined) {
        result[typeof realValue === 'object' ? realValue.alias : col] = item[col];
      }
    });

    // Process nested relations
    if (Object.keys(rest).length > 0) {
      Object.entries(rest).forEach(([nestedKey, nestedValue]) => {
        const { columns, path, alias, ...rest } = nestedValue as IncludeValueWithColumns<
          T,
          keyof T
        >;
        if (item[nestedKey]) {
          result[alias || nestedKey] = this.processRelationData(
            item[nestedKey],
            columns as Record<string, boolean | { alias: string }>,
            rest as unknown as IncludeJSONWithColumns<T>,
            item,
          );
        }
      });
    }

    // If no columns specified but has nested relations, include all properties
    if (Object.keys(columns).length === 0 && Object.keys(rest).length === 0) {
      Object.assign(result, item);
    }

    return result;
  }

  private filterSelectedRelationColumnsUndefined(columnsData: IncludeJSONWithColumns<T>): void {
    Object.entries(columnsData).forEach(([key, value]) => {
      const { columns, path, alias, ...rest } = value as IncludeValueWithColumns<T, keyof T>;
      if (!columns) {
        throw new Error(`Columns are undefined for ${key}`);
      }
      // Process nested relations
      if (Object.keys(rest).length > 0) {
        this.filterSelectedRelationColumnsUndefined(rest as unknown as IncludeJSONWithColumns<T>);
      }
    });
  }

  //#endregion
}
