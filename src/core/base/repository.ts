import { stringify } from 'flatted';
import jsep from 'jsep';
import { cloneDeep, map, set } from 'lodash';
import { get } from 'lodash'
import { DeepPartial, EntityMetadata, ObjectLiteral, RemoveOptions, Repository, SaveOptions, SelectQueryBuilder } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

import { EntityType } from '../types/entity';
import { IncludeJSON, IncludeJSONWithColumns, IncludeValue, IncludeValueWithColumns } from '../types/include';
import { QueryBuilderOptions } from '../types/options';
import { ExpressionParseResult, IGroupedQueryable, IOrderedQueryable, IQueryable, IQueryableRelationResult, IQueryableSelectResult, IQueryableWhereResult, ListResult, QueryOptions, SingleResult, SingleResultOrNull } from '../types/query';
import { ScalarSelectorValue, SelectJSON } from '../types/select';
import { FieldComparison, PredicateJSON } from '../types/where';
import { deepClone } from '../utils';
import { DbContext } from './context';

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

  async first(): Promise<SingleResult<T>> {
    const result = await this.queryBuilder.limit(1).getOne();
    if (!result) {
      throw new Error('No entity found');
    }
    return result;
  }

  async firstOrDefault(): Promise<SingleResultOrNull<T>> {
    return await this.queryBuilder.limit(1).getOne();
  }

  async single(): Promise<SingleResult<T>> {
    const results = await this.queryBuilder.limit(2).getMany();
    if (results.length === 0) {
      throw new Error('No entity found');
    }
    if (results.length > 1) {
      throw new Error('Multiple entities found');
    }
    return results[0];
  }

  async singleOrDefault(): Promise<SingleResultOrNull<T>> {
    const results = await this.queryBuilder.limit(2).getMany();
    if (results.length > 1) {
      throw new Error('Multiple entities found');
    }
    return results[0] || null;
  }

  where(predicate: PredicateJSON<T>): IQueryableWhereResult<T> {
    console.log(`\n================ where ==================\n`);
    console.log(`predicate: ${JSON.stringify(predicate, null, 2)}`);
    const alias = this.queryBuilder.alias;
    const { whereClause, params } = this.parseJsonPredicate(predicate, alias);
    console.log(`whereClause: ${whereClause}`);
    console.log(`params: ${JSON.stringify(params, null, 2)}`);
    
    this.queryBuilder.where(whereClause, params);
    console.log(`\n================ where end ==================\n`);
    return this as unknown as IQueryableWhereResult<T>;
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

  async toList(): Promise<ListResult<T>> {
    const data = await this.queryBuilder.getMany();
    return data.map((item) => this.filterSelectedColumns(item));
  }

  async withCount(): Promise<[number, ListResult<T>]> {
    const [results, count] = await this.queryBuilder.getManyAndCount();
    return [count, results];
  }

  async any(): Promise<boolean> {
    return await this.queryBuilder.getExists();
  }

  //#endregion

  //#region Projection Methods

  select(selector: SelectJSON<T>): IQueryableSelectResult<T> {
    const alias = this.queryBuilder.alias;
    this.addSelect(selector, alias);
    return this;
  }

  groupBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K): IGroupedQueryable<T> {
    this.queryBuilder.groupBy(keySelector as string);
    return this as unknown as IGroupedQueryable<T>;
  }

  //#endregion

  //#region Loading Related Data

  include(keySelector: IncludeJSON<T>): IQueryableRelationResult<T> {
    const alias = this.queryBuilder.alias;
    this.addInclude(keySelector, alias);
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

    const walkField = (field: string, conditions: FieldComparison, currentAlias: string): string => {
      console.log(`\n================ walkField ==================\n`);
      console.log(`field: ${field}`);
      console.log(`conditions: ${JSON.stringify(conditions, null, 2)}`);
      console.log(`currentAlias: ${currentAlias}`);
      return Object.entries(conditions)
        .map(([op, value], idx) => {
          console.log(`op: ${op}`);
          console.log(`value: ${JSON.stringify(value, null, 2)}`);
          const paramKey = `${field}_${index++}`;
          const column = `${currentAlias}.${field}`;
          console.log(`paramKey: ${paramKey}`);
          console.log(`column: ${column}`);
          if(idx === Object.entries(conditions).length - 1){
            console.log(`\n================ walkField end ==================\n`);
          }
          
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
    };

    const walk = (expr: PredicateJSON<T>, currentAlias: string = alias, path: string = ''): string => {
      if ('$and' in expr) {
        console.log(`expr is $and`);
        return `(${(expr.$and as any[]).map(e => walk(e, currentAlias, path)).join(' AND ')})`;
      }
      if ('$or' in expr) {
        console.log(`expr is $or`);
        return `(${(expr.$or as any[]).map(e => walk(e, currentAlias, path)).join(' OR ')})`;
      }

      return Object.entries(expr)
        .map(([field, conditions]) => {
          console.log(`field: ${field}`);
          console.log(`conditions: ${JSON.stringify(conditions, null, 2)}`);
          // Check if this is a relation path
          const fullPath = path ? `${path}.${field}` : field;
          console.log(`fullPath: ${fullPath}`);
          
          // If conditions is an object but not a FieldComparison, it's a relation
          if (typeof conditions === 'object' && 
              conditions !== null && 
              !Object.keys(conditions).some(key => key.startsWith('$'))) {
            console.log(`conditions is an object and not a FieldComparison`);
            
            // Get or create relation alias
            let relationAlias = this.relationAliases[fullPath];
            console.log(`relationAlias: ${JSON.stringify(relationAlias, null, 2)}`);
            if (!relationAlias) {
              throw new Error(`Relation not loaded: ${fullPath}`);
            }
            
            // Recurse into relation conditions
            return walk(conditions as PredicateJSON<T>, relationAlias.alias, fullPath);
          }
          
          // Regular field condition
          return walkField(field, conditions as FieldComparison, currentAlias);
        })
        .filter(Boolean)
        .join(' AND ');
    };

    const whereClause = walk(predicate);
    return { whereClause, params };
  }

  private addSelect<U extends ObjectLiteral>(
    data: SelectJSON<U>,
    parentAlias: string = this.queryBuilder.alias,
    isFirst: boolean = true,
    relationKey: string = '',
  ): void {
    const selectors = Object.entries(data);
    map(selectors, ([key, value], index) => {
      let relationPath = `${relationKey ? `${relationKey}.${key}` : key}`;
      const alias = `${parentAlias}_${key}`;


      if (typeof value === 'object') {
        if (value !== null && 'as' in value) {
          set(this.selectedColumns, key, { alias: (value as ScalarSelectorValue<U>).as });
        } else {
          const relationAlias = this.relationAliases[relationPath];
          if(!relationAlias){
            throw new Error(`Relation alias not found for ${relationPath}`);
          }
          const path = relationAlias.path;
          const pathSplit = path.split('.');
          const pathSplitLength = pathSplit.length;
          if (pathSplitLength > 1) {
            const selectedRelationColumnsPath = pathSplit.slice(0, -1).join('.');
            const selectedRelationColumn = get(
              this.selectedRelationColumns,
              selectedRelationColumnsPath,
            );
            if (selectedRelationColumn) {
              set(selectedRelationColumn, key, {
                ...selectedRelationColumn,
                alias: relationAlias.alias,
                columns: [],
                path: relationAlias.path,
              });
            } else {
              set(this.selectedRelationColumns, selectedRelationColumnsPath, {
                [key]: { alias: relationAlias.alias, columns: [], path: relationAlias.path },
              });
            }
          } else {
            set(this.selectedRelationColumns, path, {
              alias: relationAlias.alias,
              columns: [],
              path: relationAlias.path,
            });
          }
          this.addSelect(value as SelectJSON<U>, relationAlias.alias, false, path);
        }
      } else if (value === true && !relationKey) {
        set(this.selectedColumns, key, true);
      } else if (value === true && relationKey) {
        const relationAlias = get(this.selectedRelationColumns, relationKey);
        set(this.selectedRelationColumns, relationKey, {
          alias: relationAlias.alias,
          columns: {
            ...relationAlias.columns,
            [key]: true,
          },
          path: relationAlias.path,
        });
      }
      this.filterSelectedRelationColumnsUndefined(this.selectedRelationColumns);
    });
  }

  private addInclude<U extends ObjectLiteral>(
    data: IncludeJSON<U>,
    parentAlias: string = this.queryBuilder.alias,
    parentPath: string = '',
  ): void {
    const selectors = Object.entries(data);
    map(selectors, ([key, value]) => {
      const propertyPath = parentPath ? `${parentPath}.${key}` : key;
      const column = `${parentAlias}.${key}`;
      if (typeof value === 'object') {
        const realValue = value as IncludeValue<U, keyof U>;
        const { as, include } = realValue;
        const relationAlias = as || `${parentAlias}_${key}`;
        this.relationAliases[propertyPath] = { alias: as || key, path: propertyPath };
        this.queryBuilder.leftJoinAndSelect(column, relationAlias);
        if (include) {
          this.addInclude(include, relationAlias, propertyPath);
        }
      } else {
        const relationAlias = `${parentAlias}_${key}`;
        this.relationAliases[propertyPath] = { alias: key, path: propertyPath };
        this.queryBuilder.leftJoinAndSelect(column, relationAlias);
      }
    });
  }

  private filterSelectedColumns(data: T): T {
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
    return result as T;
  }

  private mapRelationColumns(
    data: T,
    columnsData: IncludeJSONWithColumns<T>,
    result: Record<string, any>,
  ): Record<string, any> {
    Object.entries(columnsData).forEach(([key, value]) => {
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

    if (Array.isArray(item)) {
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
