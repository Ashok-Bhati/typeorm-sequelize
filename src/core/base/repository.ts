import { stringify } from 'flatted';
import jsep from 'jsep';
import { cloneDeep, map, set } from 'lodash';
import { get } from 'lodash'
import { DeepPartial, DeleteResult, EntityMetadata, FindOptionsWhere, FindOptionsWhereProperty, ObjectLiteral, RemoveOptions, Repository, SaveOptions, SelectQueryBuilder, UpdateResult } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

import { EntityType } from '../types/entity';
import { IncludeJSON, IncludeJSONWithColumns, IncludeValue, IncludeValueWithColumns } from '../types/include';
import { QueryBuilderOptions } from '../types/options';
import { ExpressionParseResult, IGroupedQueryable, IOrderedQueryable, IQueryable, IQueryableRelationResult, IQueryableSelectResult, IQueryableWhereResult, ListResult, QueryOptions, SingleResult, SingleResultOrNull } from '../types/query';
import { ScalarSelectorValue, SelectJSON } from '../types/select';
import { AndCondition, FieldComparison, Fields, PredicateJSON } from '../types/where';
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

  /**
   * Creates a fresh QueryBuilder and resets all state for a new query
   */
  private resetQueryBuilder(): void {
    console.log(`[RESET] Creating fresh QueryBuilder, clearing previous state`);
    this.queryBuilder = this.repository.createQueryBuilder(this.metadata.tableName || this.metadata.name.toLowerCase());
    Object.keys(this.relationAliases).forEach(key => delete this.relationAliases[key]);
    this.selectedRelationColumns = {};
    this.selectedColumns = {};
    console.log(`[RESET] QueryBuilder reset complete`);
  }

  //#region Repository Methods

  async create(entity: DeepPartial<T>): Promise<T> {
    const result = this.repository.create(entity);
    return this.repository.save(result);
  }

  async save(entity: DeepPartial<T>, options: SaveOptions): Promise<T> {
    return await this.repository.save(entity, options);
  }
  
  async update(id: number, entity: Partial<T>): Promise<UpdateResult> {
    return await this.repository.update(id, entity);
  }

  async delete(id: number): Promise<DeleteResult> {
    return await this.repository.delete(id);
  }

  async createMany(entities: DeepPartial<T>[]): Promise<T[]> {
    const result = this.repository.create(entities);
    return this.repository.save(result);
  }

  async deleteBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K, value: T[K]): Promise<DeleteResult>;
  async deleteBy(keySelector: string, value: any): Promise<DeleteResult>;
  async deleteBy<K extends keyof T>(keySelector: (T[K] extends Function ? never : K) | string, value: T[K] | any): Promise<DeleteResult> {
    // Handle nested property paths (e.g., "user.email", "post.author.name")
    if (typeof keySelector === 'string' && keySelector.includes('.')) {
      return this.deleteByNestedProperty(keySelector, value);
    }

    // Handle simple property access
    return this.repository.delete({ 
      [keySelector]: value 
    } as FindOptionsWhere<T>);
  }

  async deleteByOrDefault<K extends keyof T>(keySelector: T[K] extends Function ? never : K, value: T[K]): Promise<DeleteResult | null>;
  async deleteByOrDefault(keySelector: string, value: any): Promise<DeleteResult | null>;
  async deleteByOrDefault<K extends keyof T>(keySelector: (T[K] extends Function ? never : K) | string, value: T[K] | any): Promise<DeleteResult | null> {
    try {
      return await this.deleteBy(keySelector as any, value);
    } catch (error) {
      // If no entities found to delete, return null instead of throwing
      if (error instanceof Error && error.message.includes('No entity found')) {
        return null;
      }
      throw error;
    }
  }

  private async deleteByNestedProperty(propertyPath: string, value: any): Promise<DeleteResult> {
    const pathParts = propertyPath.split('.');
    console.log(`[DELETE] pathParts: ${pathParts}`);
    const alias = this.queryBuilder.alias;
    console.log(`[DELETE] alias: ${alias}`);
    
    // Create a new query builder for the delete operation
    const deleteBuilder = this.repository.createQueryBuilder(alias);
    
    // Build joins for nested properties
    let currentAlias = alias;
    let currentMetadata = this.metadata;
    console.log(`[DELETE] Starting with entity: ${currentMetadata.name}`);
    console.log(`[DELETE] currentAlias: ${currentAlias}`);
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      console.log(`\n[DELETE] --- Processing path part ${i + 1}/${pathParts.length - 1} ---`);
      const part = pathParts[i];
      console.log(`[DELETE] part: ${part}`);
      console.log(`[DELETE] Looking for relation '${part}' in entity '${currentMetadata.name}'`);
      
      const joinAlias = `${alias}_${pathParts.slice(0, i + 1).join('_')}`;
      console.log(`[DELETE] joinAlias: ${joinAlias}`);
      
      // Check if this relation exists in the current entity's metadata
      const relation = currentMetadata.relations.find(r => r.propertyName === part);
      console.log(`[DELETE] Available relations in '${currentMetadata.name}':`, 
        currentMetadata.relations.map(r => r.propertyName).join(', '));
      console.log(`[DELETE] Found relation:`, relation ? `${relation.propertyName} -> ${relation.type}` : 'None');
      
      if (!relation) {
        throw new Error(
          `Relation '${part}' not found in entity '${currentMetadata.name}'. ` +
          `Available relations: ${currentMetadata.relations.map(r => r.propertyName).join(', ')}`
        );
      }
      
      // Join the relation
      deleteBuilder.leftJoin(`${currentAlias}.${part}`, joinAlias);
      currentAlias = joinAlias;
      console.log(`[DELETE] Added join: ${currentAlias}.${part} AS ${joinAlias}`);
      
      // Update current metadata to the target entity of this relation
      const targetEntity = relation.inverseEntityMetadata || relation.entityMetadata;
      if (targetEntity) {
        currentMetadata = targetEntity;
        console.log(`[DELETE] Moving to target entity: ${currentMetadata.name}`);
      } else {
        console.warn(`[DELETE] Could not determine target entity for relation '${part}'. Continuing with current metadata.`);
      }
    }
    
    // Add condition for the final property
    const finalProperty = pathParts[pathParts.length - 1];
    console.log(`\n[DELETE] --- Final property ---`);
    console.log(`[DELETE] finalProperty: ${finalProperty}`);
    console.log(`[DELETE] Final entity: ${currentMetadata.name}`);
    console.log(`[DELETE] Final alias: ${currentAlias}`);
    
    const condition = `${currentAlias}.${finalProperty} = :deleteByValue`;
    console.log(`[DELETE] condition: ${condition}`);
    
    deleteBuilder.where(condition, { deleteByValue: value });
    
    // Execute the delete operation
    return deleteBuilder.delete().execute();
  }

  //#endregion

  //#region IQueryable implementation

  //#region Basic Query Methods

  async first(): Promise<SingleResult<T>> {
    const result = await this.queryBuilder.limit(1).getOne();
    const filteredResult = result ? this.filterSelectedColumns(result) : null;
    this.resetQueryBuilder(); // Reset for next query
    if (!filteredResult) {
      throw new Error('No entity found');
    }
    return filteredResult;
  }

  async firstOrDefault(): Promise<SingleResultOrNull<T>> {
    const result = await this.queryBuilder.limit(1).getOne();
    const filteredResult = result ? this.filterSelectedColumns(result) : null;
    this.resetQueryBuilder(); // Reset for next query
    return filteredResult;
  }

  async single(): Promise<SingleResult<T>> {
    const results = await this.queryBuilder.limit(2).getMany();
    const filteredResults = results.map((item) => this.filterSelectedColumns(item));
    this.resetQueryBuilder(); // Reset for next query
    if (filteredResults.length === 0) {
      throw new Error('No entity found');
    }
    if (filteredResults.length > 1) {
      throw new Error('Multiple entities found');
    }
    return filteredResults[0];
  }

  async singleOrDefault(): Promise<SingleResultOrNull<T>> {
    const results = await this.queryBuilder.limit(2).getMany();
    const filteredResults = results.map((item) => this.filterSelectedColumns(item));
    this.resetQueryBuilder(); // Reset for next query
    if (filteredResults.length > 1) {
      throw new Error('Multiple entities found');
    }
    return filteredResults[0] ? filteredResults[0] : null;
  }

  where(predicate: PredicateJSON<T>): IQueryableWhereResult<T> {
    console.log(`[WHERE] Called with predicate:`, JSON.stringify(predicate, null, 2));
    const alias = this.queryBuilder.alias;
    const { whereClause, params } = this.parseJsonPredicate(predicate, alias);
    
    console.log(`[WHERE] Generated whereClause: ${whereClause}`);
    console.log(`[WHERE] Generated params:`, params);
    
    this.queryBuilder.where(whereClause, params);
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
    const filteredData = data.map((item) => this.filterSelectedColumns(item));
    this.resetQueryBuilder(); // Reset for next query
    return filteredData;
  }

  async withCount(): Promise<[number, ListResult<T>]> {
    const [results, count] = await this.queryBuilder.getManyAndCount();
    const filteredResults = results.map((item) => this.filterSelectedColumns(item));
    this.resetQueryBuilder(); // Reset for next query
    return [count, filteredResults];
  }

  async any(): Promise<boolean> {
    const result = await this.queryBuilder.getExists();
    this.resetQueryBuilder(); // Reset for next query
    return result;
  }

  //#endregion

  //#region Projection Methods

  select(selector: SelectJSON<T>): IQueryableSelectResult<T> {
    console.log(`[SELECT] Called with selector:`, JSON.stringify(selector, null, 2));
    const alias = this.queryBuilder.alias;
    console.log(`[SELECT] alias: ${alias}`);
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
    this.resetQueryBuilder();
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

  //#region Find Methods

  async find(id: number): Promise<SingleResult<T>> {
    const result = await this.repository.findOne({
      where: { id: id as FindOptionsWhereProperty<T, T[keyof T]> }
    });
    if (!result) {
      throw new Error('No entity found');
    }
    return result;
  }

  async findOrDefault(id: number): Promise<SingleResultOrNull<T>> {
    return this.repository.findOne({
      where: { id: id as FindOptionsWhereProperty<T, T[keyof T]> }
    });
  }
  async findBy<K extends keyof T>(keySelector: T[K] extends Function ? never : K, value: T[K]): Promise<SingleResult<T>>;
  async findBy(keySelector: string, value: any): Promise<SingleResult<T>>;
  async findBy<K extends keyof T>(keySelector: (T[K] extends Function ? never : K) | string, value: T[K] | any): Promise<SingleResult<T>> {
    const result = await this.findByOrDefault(keySelector as any, value);
    if (!result) {
      throw new Error('No entity found');
    }
    return result;
  }

  async findByOrDefault<K extends keyof T>(keySelector: T[K] extends Function ? never : K, value: T[K]): Promise<SingleResultOrNull<T>>;
  async findByOrDefault(keySelector: string, value: any): Promise<SingleResultOrNull<T>>;
  async findByOrDefault<K extends keyof T>(keySelector: (T[K] extends Function ? never : K) | string, value: T[K] | any): Promise<SingleResultOrNull<T>> {
    // Handle nested property paths (e.g., "user.email", "post.author.name")
    if (typeof keySelector === 'string' && keySelector.includes('.')) {
      return this.findByNestedProperty(keySelector, value);
    }

    // Handle simple property access
    return this.repository.findOne({ 
      where: { 
        [keySelector]: value 
      } as FindOptionsWhere<T>
    });
  }

  private async findByNestedProperty(propertyPath: string, value: any): Promise<SingleResultOrNull<T>> {
    const pathParts = propertyPath.split('.');
    console.log(`pathParts: ${pathParts}`);
    const alias = this.queryBuilder.alias;
    console.log(`alias: ${alias}`);
    
    // Build joins for nested properties
    let currentAlias = alias;
    let currentMetadata = this.metadata;
    console.log(`Starting with entity: ${currentMetadata.name}`);
    console.log(`currentAlias: ${currentAlias}`);
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      console.log(`\n--- Processing path part ${i + 1}/${pathParts.length - 1} ---`);
      const part = pathParts[i];
      console.log(`part: ${part}`);
      console.log(`Looking for relation '${part}' in entity '${currentMetadata.name}'`);
      
      const joinAlias = `${alias}_${pathParts.slice(0, i + 1).join('_')}`;
      console.log(`joinAlias: ${joinAlias}`);
      
      // Check if this relation exists in the current entity's metadata
      const relation = currentMetadata.relations.find(r => r.propertyName === part);
      console.log(`Available relations in '${currentMetadata.name}':`, 
        currentMetadata.relations.map(r => r.propertyName).join(', '));
      console.log(`Found relation:`, relation ? `${relation.propertyName} -> ${relation.type}` : 'None');
      
      if (!relation) {
        throw new Error(
          `Relation '${part}' not found in entity '${currentMetadata.name}'. ` +
          `Available relations: ${currentMetadata.relations.map(r => r.propertyName).join(', ')}`
        );
      }
      
      // Join the relation
      this.queryBuilder.leftJoin(`${currentAlias}.${part}`, joinAlias);
      currentAlias = joinAlias;
      console.log(`Added join: ${currentAlias}.${part} AS ${joinAlias}`);
      
      // Update current metadata to the target entity of this relation
      const targetEntity = relation.inverseEntityMetadata || relation.entityMetadata;
      if (targetEntity) {
        currentMetadata = targetEntity;
        console.log(`Moving to target entity: ${currentMetadata.name}`);
      } else {
        console.warn(`Could not determine target entity for relation '${part}'. Continuing with current metadata.`);
      }
    }
    
    // Add condition for the final property
    const finalProperty = pathParts[pathParts.length - 1];
    console.log(`\n--- Final property ---`);
    console.log(`finalProperty: ${finalProperty}`);
    console.log(`Final entity: ${currentMetadata.name}`);
    console.log(`Final alias: ${currentAlias}`);
    
    const condition = `${currentAlias}.${finalProperty} = :findByValue`;
    console.log(`condition: ${condition}`);
    this.queryBuilder.where(condition, { findByValue: value });
    
    return this.queryBuilder.getOne();
  }

  //#endregion

  //#region private methods

  private parseJsonPredicate<T>(predicate: PredicateJSON<T>, alias: string): ExpressionParseResult {
    const params: Record<string, any> = {};
    let index = 0;

    const walkField = (field: string, conditions: FieldComparison, currentAlias: string): string => {
      return Object.entries(conditions)
        .map(([op, value], idx) => {
          const paramKey = `${field}_${index++}`;
          const column = `${currentAlias}.${field}`;
          
          switch (op) {
            case '$or':
              // Handle nested $or within field comparison
              return `(${(value as FieldComparison[])
                .map(condition => walkField(field, condition, currentAlias))
                .join(' OR ')})`;
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
      console.log(`expr: ${JSON.stringify(expr, null, 2)}`);
      if ('$or' in expr && expr.$or) {
        return `(${(expr.$or as PredicateJSON<T>[])
          .map((condition) => walk(condition as PredicateJSON<T>, currentAlias, path))
          .join(' OR ')})`;
      }

      if ('$and' in expr && expr.$and) {
        return `(${(expr.$and as PredicateJSON<T>[])
          .map((condition) => walk(condition as PredicateJSON<T>, currentAlias, path))
          .join(' AND ')})`;
      }

      return Object.entries(expr)
        .map(([field, conditions]) => {
          // Check if this is a relation path
          const fullPath = path ? `${path}.${field}` : field;
          console.log(`fullPath: ${fullPath}`);
          
          // If conditions is an object but not a FieldComparison, it's a relation
          if (typeof conditions === 'object' && 
              conditions !== null && 
              !Object.keys(conditions).some(key => key.startsWith('$'))) {
                console.log(`expr: ${JSON.stringify(expr)}`);
              console.log(`conditions: ${JSON.stringify(conditions)}`);
            
            // Get or create relation alias
            console.log(`this.relationAliases: ${JSON.stringify(this.relationAliases, null, 2)}`);
            
            // Debug: Log existing joins in TypeORM
            const expressionMap = (this.queryBuilder as any).expressionMap;
            console.log(`[DEBUG] TypeORM existing joins:`, expressionMap?.joinAttributes?.map((j: any) => ({ alias: j.alias?.name, relation: j.relationName, parent: j.parentAlias })));
            
            let relationAlias = this.relationAliases[fullPath];
            if (!relationAlias) {
              // Automatically create the join if it doesn't exist
              console.log(`Creating automatic join for relation: ${fullPath}`);
              relationAlias = this.createAutomaticJoin(fullPath, currentAlias);
              // Note: createAutomaticJoin now handles storing the alias internally
            } else {
              console.log(`[WHERE] Reusing existing relation alias for ${fullPath}: ${relationAlias.alias}`);
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
    console.log(`[ADD SELECT] Called with data:`, JSON.stringify(data, null, 2));
    console.log(`[ADD SELECT] parentAlias: ${parentAlias}`);
    console.log(`[ADD SELECT] isFirst: ${isFirst}`);
    console.log(`[ADD SELECT] relationKey: ${relationKey}`);
    const selectors = Object.entries(data);
    console.log(`[ADD SELECT] selectors: ${JSON.stringify(selectors, null, 2)}`);
    map(selectors, ([key, value], index) => {
      let relationPath = `${relationKey ? `${relationKey}.${key}` : key}`;
      const alias = `${parentAlias}_${key}`;

      if (typeof value === 'object') {
        console.log(`[ADD SELECT] value is object: ${JSON.stringify(value, null, 2)}`);
        if (value !== null && 'as' in value) {
          console.log(`[ADD SELECT] value.as: ${value.as}`);
          if(relationKey){
            console.log(`[ADD SELECT] relationKey: ${relationKey}`);
            const existingAlias = get(this.selectedRelationColumns, relationKey);
            const newAlias = {
              ...(existingAlias ? existingAlias : {}),
              columns: {
                ...(existingAlias ? existingAlias.columns : {}),
                [key]: { alias: (value as ScalarSelectorValue<U>).as }
              }
            }
            set(this.selectedRelationColumns, relationKey, newAlias);
            // Explicitly add relation column to QueryBuilder with alias
            this.queryBuilder.addSelect(`${parentAlias}.${key}`, (value as ScalarSelectorValue<U>).as);
            console.log(`[ADD SELECT] Added relation column to QueryBuilder: ${parentAlias}.${key} AS ${(value as ScalarSelectorValue<U>).as}`);
          } else {
            set(this.selectedColumns, key, { alias: (value as ScalarSelectorValue<U>).as });
            // Explicitly add column to QueryBuilder with alias
            this.queryBuilder.addSelect(`${parentAlias}.${key}`, (value as ScalarSelectorValue<U>).as);
            console.log(`[ADD SELECT] Added column to QueryBuilder: ${parentAlias}.${key} AS ${(value as ScalarSelectorValue<U>).as}`);
            console.log(`[ADD SELECT] selectedColumns: ${JSON.stringify(this.selectedColumns, null, 2)}`);
          }
        } else {
          console.log(`[ADD SELECT] value is not object: ${value}`);
          const relationAlias = this.relationAliases[relationPath];
          if(!relationAlias){
            throw new Error(`Relation alias not found for ${relationPath}`);
          }
          const path = relationAlias.path;
          const pathSplit = path.split('.');
          const pathSplitLength = pathSplit.length;
          if (pathSplitLength > 1) {
            console.log(`[ADD SELECT] pathSplitLength > 1: ${pathSplitLength}`);
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
            console.log(`[ADD SELECT] pathSplitLength === 1: ${pathSplitLength}`);
            set(this.selectedRelationColumns, path, {
              alias: relationAlias.alias,
              columns: [],
              path: relationAlias.path,
            });
          }
          this.addSelect(value as SelectJSON<U>, relationAlias.alias, false, path);
        }
      } else if (value === true && !relationKey) {
        console.log(`[ADD SELECT] value === true && !relationKey: ${relationKey}`);
        set(this.selectedColumns, key, true);
        // Explicitly add column to QueryBuilder to handle columns with select: false
        this.queryBuilder.addSelect(`${parentAlias}.${key}`, `${parentAlias}_${key}`);
        console.log(`[ADD SELECT] Added column to QueryBuilder: ${parentAlias}.${key} AS ${parentAlias}_${key}`);
        console.log(`[ADD SELECT] selectedColumns: ${JSON.stringify(this.selectedColumns, null, 2)}`);
      } else if (value === true && relationKey) {
        console.log(`[ADD SELECT] value === true && relationKey: ${relationKey}`);
        const relationAlias = get(this.selectedRelationColumns, relationKey);
        set(this.selectedRelationColumns, relationKey, {
          alias: relationAlias.alias,
          columns: {
            ...relationAlias.columns,
            [key]: true,
          },
          path: relationAlias.path,
        });
        // Explicitly add relation column to QueryBuilder to handle columns with select: false
        this.queryBuilder.addSelect(`${parentAlias}.${key}`, `${parentAlias}_${key}`);
        console.log(`[ADD SELECT] Added relation column to QueryBuilder: ${parentAlias}.${key} AS ${parentAlias}_${key}`);
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
        
        // Check if this join already exists before creating it
        const existingJoins = (this.queryBuilder as any).expressionMap?.joinAttributes || [];
        const joinExists = existingJoins.some((join: any) => join.alias?.name === relationAlias);
        
        if (joinExists) {
          console.log(`[INCLUDE] Join with alias ${relationAlias} already exists, skipping leftJoinAndSelect creation`);
        } else {
          this.queryBuilder.leftJoinAndSelect(column, relationAlias);
          console.log(`[INCLUDE] Added join: ${column} AS ${relationAlias}, stored alias: ${relationAlias}`);
        }
        
        this.relationAliases[propertyPath] = { alias: relationAlias, path: propertyPath };
        console.log(`[INCLUDE] Current relationAliases:`, JSON.stringify(this.relationAliases, null, 2));
        if (include) {
          this.addInclude(include, relationAlias, propertyPath);
        }
      } else {
        const relationAlias = `${parentAlias}_${key}`;
        
        // Check if this join already exists before creating it
        const existingJoins = (this.queryBuilder as any).expressionMap?.joinAttributes || [];
        const joinExists = existingJoins.some((join: any) => join.alias?.name === relationAlias);
        
        if (joinExists) {
          console.log(`[INCLUDE] Join with alias ${relationAlias} already exists, skipping leftJoinAndSelect creation`);
        } else {
          this.queryBuilder.leftJoinAndSelect(column, relationAlias);
          console.log(`[INCLUDE] Added join: ${column} AS ${relationAlias}, stored alias: ${relationAlias}`);
        }
        
        this.relationAliases[propertyPath] = { alias: relationAlias, path: propertyPath };
        console.log(`[INCLUDE] Current relationAliases:`, JSON.stringify(this.relationAliases, null, 2));
      }
    });
  }

  private filterSelectedColumns(data: T): T {
    let result: Record<string, any> = {};
    console.log(`[FILTER] selectedColumns: ${JSON.stringify(this.selectedColumns, null, 2)}`);
    for (const key in this.selectedColumns) {
      const realValue = this.selectedColumns[key];
      if (typeof realValue === 'boolean') {
        result[key] = get(data, key);
      } else {
        result[realValue.alias] = get(data, key);
      }
    }
    if(Object.keys(this.selectedColumns).length === 0){
      result = data;
    }
    this.mapRelationColumns(data, this.selectedRelationColumns, result);
    return result as T;
  }

  private mapRelationColumns(
    data: T,
    columnsData: IncludeJSONWithColumns<T>,
    result: Record<string, any>,
  ): Record<string, any> {
    console.log(`[MAP RELATION COLUMNS] Called with columnsData:`, JSON.stringify(columnsData, null, 2));
    console.log(`[MAP RELATION COLUMNS] result:`, JSON.stringify(result, null, 2));
    Object.entries(columnsData).forEach(([key, value]) => {
      const { columns, path, alias, ...rest } = value as IncludeValueWithColumns<T, keyof T>;
      console.log(`[MAP RELATION COLUMNS] key: ${key}`);
      console.log(`[MAP RELATION COLUMNS] path: ${path}`);
      console.log(`[MAP RELATION COLUMNS] alias: ${alias}`);
      console.log(`[MAP RELATION COLUMNS] rest:`, JSON.stringify(rest, null, 2));
      const existingData = get(data, path || key);
      console.log(`[MAP RELATION COLUMNS] existingData:`, JSON.stringify(existingData, null, 2));
      if (existingData) {
        console.log(`[MAP RELATION COLUMNS] existingData is not null`);
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
    console.log(`[PROCESS RELATION DATA] Called with item:`, JSON.stringify(item, null, 2));
    console.log(`[PROCESS RELATION DATA] columns:`, JSON.stringify(columns, null, 2));
    console.log(`[PROCESS RELATION DATA] rest:`, JSON.stringify(rest, null, 2));
    console.log(`[PROCESS RELATION DATA] parentData:`, JSON.stringify(parentData, null, 2));
    if (!item) return null;

    if (Array.isArray(item)) {
      console.log(`[PROCESS RELATION DATA] item is array`);
      return item.map((subItem) => this.processRelationData(subItem, columns, rest, parentData));
    }

    const result: Record<string, any> = {};
    console.log(`[PROCESS RELATION DATA] result:`, JSON.stringify(result, null, 2));
    // Add selected columns
    Object.entries(columns).forEach(([col, value]) => {
      const realValue = value as boolean | { alias: string };
      console.log(`[PROCESS RELATION DATA] col: ${col}`);
      console.log(`[PROCESS RELATION DATA] realValue:`, JSON.stringify(realValue, null, 2));
      if (item[col] !== undefined) {
        result[typeof realValue === 'object' ? realValue.alias : col] = item[col];
        console.log(`[PROCESS RELATION DATA] result:`, JSON.stringify(result, null, 2));
      }
    });

    // Process nested relations
    if (Object.keys(rest).length > 0) {
      console.log(`[PROCESS RELATION DATA] rest is not empty`);
      Object.entries(rest).forEach(([nestedKey, nestedValue]) => {
        const { columns, path, alias, ...rest } = nestedValue as IncludeValueWithColumns<
          T,
          keyof T
        >;
        console.log(`[PROCESS RELATION DATA] nestedKey: ${nestedKey}`);
        console.log(`[PROCESS RELATION DATA] nestedValue:`, JSON.stringify(nestedValue, null, 2));
        if (item[nestedKey]) {
          console.log(`[PROCESS RELATION DATA] item[nestedKey] is not undefined`);
          result[alias || nestedKey] = this.processRelationData(
            item[nestedKey],
            columns as Record<string, boolean | { alias: string }>,
            rest as unknown as IncludeJSONWithColumns<T>,
            item,
          );
          console.log(`[PROCESS RELATION DATA] result:`, JSON.stringify(result, null, 2));
        }
      });
    }

    // If no columns specified but has nested relations, include all properties
    if (Object.keys(columns).length === 0 && Object.keys(rest).length === 0) {
      console.log(`[PROCESS RELATION DATA] columns and rest are empty`);
      Object.assign(result, item);
      console.log(`[PROCESS RELATION DATA] result:`, JSON.stringify(result, null, 2));
    }
    console.log(`[PROCESS RELATION DATA] result:`, JSON.stringify(result, null, 2));
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

  /**
   * Creates an automatic join for a relation path that wasn't explicitly included
   */
  private createAutomaticJoin(fullPath: string, currentAlias: string): { alias: string; path: string } {
    console.log(`[AUTO-JOIN] Starting createAutomaticJoin for ${fullPath} from ${currentAlias}`);
    
    // First, check if this exact path already exists
    if (this.relationAliases[fullPath]) {
      console.log(`[AUTO-JOIN] Path ${fullPath} already exists, returning: ${this.relationAliases[fullPath].alias}`);
      return this.relationAliases[fullPath];
    }
    
    // Split the path into parts
    const pathParts = fullPath.split('.');
    console.log(`[AUTO-JOIN] Path parts: ${pathParts.join(' -> ')}`);
    
    // Start from current alias and build path step by step
    let currentJoinAlias = currentAlias;
    let builtPath = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      builtPath = builtPath ? `${builtPath}.${part}` : part;
      
      console.log(`[AUTO-JOIN] Processing part ${i + 1}/${pathParts.length}: ${part} (builtPath: ${builtPath})`);
      
      // Check if this intermediate path already exists
      if (this.relationAliases[builtPath]) {
        currentJoinAlias = this.relationAliases[builtPath].alias;
        console.log(`[AUTO-JOIN] Found existing intermediate path ${builtPath} with alias ${currentJoinAlias}`);
        continue;
      }
      
      // Need to create this join
      const targetAlias = `${this.queryBuilder.alias}_${pathParts.slice(0, i + 1).join('_')}`;
      console.log(`[AUTO-JOIN] Creating join: ${currentJoinAlias}.${part} AS ${targetAlias}`);
      
      // Check if a join with this alias already exists before creating
      const existingJoins = (this.queryBuilder as any).expressionMap?.joinAttributes || [];
      const joinExists = existingJoins.some((join: any) => join.alias?.name === targetAlias);
      
      if (joinExists) {
        console.log(`[AUTO-JOIN] Join with alias ${targetAlias} already exists, skipping leftJoin creation`);
      } else {
        // Create the join
        this.queryBuilder.leftJoin(`${currentJoinAlias}.${part}`, targetAlias);
        console.log(`[AUTO-JOIN] Created leftJoin: ${currentJoinAlias}.${part} AS ${targetAlias}`);
      }
      
      // Store the alias mapping
      this.relationAliases[builtPath] = { alias: targetAlias, path: builtPath };
      console.log(`[AUTO-JOIN] Stored mapping: ${builtPath} -> ${targetAlias}`);
      
      // Move to next level
      currentJoinAlias = targetAlias;
    }
    
    const result = { alias: currentJoinAlias, path: fullPath };
    console.log(`[AUTO-JOIN] Completed ${fullPath}, final alias: ${result.alias}`);
    return result;
  }

  //#endregion
}
