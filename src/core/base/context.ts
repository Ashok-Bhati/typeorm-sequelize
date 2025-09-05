import { DataSource, EntityManager, ObjectLiteral, QueryRunner, Repository } from 'typeorm';
import { glob } from 'glob';
import * as path from 'path';

import { EntityRegistry } from '../decorators';
import { EntityType } from '../types/entity';
import { DbContextOptions } from '../types/options';
import { BaseRepository } from './repository';

/**
 * DbContext class for managing database connections and repositories
 */
export class DbContext {
  private dataSource!: DataSource;
  private options: DbContextOptions;
  private queryRunner?: QueryRunner;
  private repositories: Map<string, BaseRepository<any>> = new Map();

  constructor(options: DbContextOptions) {
    this.options = options;
    this.initialize();
  }

  /**
   * Initializes the database connection
   */
  async initialize(): Promise<void> {
    // Resolve entities from paths and constructors
    const resolvedEntities = await this.resolveEntities();
    
    // Add registered entities to options if not already included
    const registeredEntities = EntityRegistry.getRegisteredEntities();
    
    // Deduplicate entities by both class name and table name to avoid conflicts
    const entityMap = new Map<string, EntityType<any>>();
    const tableNames = new Set<string>();
    
    const addEntity = (entity: EntityType<any>) => {
      const className = entity.name;
      const tableName = this.getEntityTableName(entity);
      
      // Check for duplicate class names
      if (entityMap.has(className)) {
        console.warn(`Duplicate entity class name '${className}' detected. Skipping duplicate.`);
        return;
      }
      
      // Check for duplicate table names
      if (tableNames.has(tableName)) {
        console.warn(`Duplicate table name '${tableName}' detected for entity '${className}'. Skipping duplicate.`);
        return;
      }
      
      entityMap.set(className, entity);
      tableNames.add(tableName);
    };
    
    // Add resolved entities first (priority to file-based entities)
    resolvedEntities.forEach(addEntity);
    
    // Add registered entities (only if not already present)
    registeredEntities.forEach(entity => addEntity(entity as EntityType<any>));
    
    const entities = Array.from(entityMap.values());
    
    // Log entity loading summary for debugging
    console.log(`Loaded ${entities.length} unique entities:`, entities.map(e => e.name).join(', '));

    this.dataSource = new DataSource({
      type: this.options.type,
      host: this.options.host,
      port: this.options.port,
      username: this.options.username,
      password: this.options.password,
      database: this.options.database,
      entities: entities,
      synchronize: this.options.synchronize
    });

    await this.dataSource.initialize();
  }

  /**
   * Resolves entities from string paths and constructors
   */
  private async resolveEntities(): Promise<EntityType<any>[]> {
    const entities: EntityType<any>[] = [];
    
    for (const entity of this.options.entities || []) {
      if (typeof entity === 'string') {
        // Handle string paths by dynamically importing entities
        const entityFiles = await this.loadEntitiesFromPath(entity);
        entities.push(...entityFiles);
      } else {
        // Handle constructor functions
        entities.push(entity);
      }
    }
    
    return entities;
  }

  /**
   * Loads entities from file paths
   */
  private async loadEntitiesFromPath(entityPath: string): Promise<EntityType<any>[]> {
    try {
      // Use glob to find files matching the pattern
      const files = glob.sync(entityPath);
      const entities: EntityType<any>[] = [];

      for (const file of files) {
        try {
          const absolutePath = path.resolve(file);
          const module = await import(absolutePath);
          
          // Extract entity classes from the module
          for (const exportedItem of Object.values(module)) {
            if (typeof exportedItem === 'function' && 
                exportedItem.prototype && 
                this.isEntityClass(exportedItem as any)) {
              entities.push(exportedItem as EntityType<any>);
            }
          }
        } catch (error) {
          console.warn(`Failed to load entity from ${file}:`, error);
        }
      }

      return entities;
    } catch (error) {
      console.warn(`Failed to resolve entity path ${entityPath}:`, error);
      return [];
    }
  }

  /**
   * Checks if a class is likely an entity class
   */
  private isEntityClass(cls: any): boolean {
    // Check if the class has TypeORM metadata (decorators)
    return !!(cls.prototype && (
      Reflect.getMetadata('typeorm:entity', cls) ||
      Reflect.getMetadata('typeorm:table', cls) ||
      cls.__entity__
    ));
  }

  /**
   * Gets the table name for an entity
   */
  private getEntityTableName(entity: EntityType<any>): string {
    // Check for explicit table name from @Entity decorator
    const tableName = Reflect.getMetadata('typeorm:table', entity);
    if (tableName) {
      return tableName;
    }
    
    // Check for entity metadata
    const entityMetadata = Reflect.getMetadata('typeorm:entity', entity);
    if (entityMetadata && entityMetadata.name) {
      return entityMetadata.name;
    }
    
    // Default to lowercase class name
    return entity.name.toLowerCase();
  }

  /**
   * Gets a registered repository by name
   */
  getRepository<Entity extends ObjectLiteral>(name: EntityType<Entity>): Repository<Entity> {
    const repository = this.dataSource.getRepository(name);
    if (!repository) {
      throw new Error(`Repository '${name}' not found. Make sure the entity is registered.`);
    }
    return repository;
  }

  /**
   * Gets a repository by entity name (string)
   */
  getRepositoryByName(entityName: string): BaseRepository<any> {
    const entityMetadata = this.dataSource.entityMetadatas.find(
      metadata => metadata.name === entityName
    );
    
    if (!entityMetadata) {
      throw new Error(`Entity '${entityName}' not found. Make sure the entity is registered.`);
    }
    
    const context = this;
    const entityTarget = entityMetadata.target as EntityType<any>;
    
    class DynamicRepository extends BaseRepository<any> {
      constructor() {
        super(context, entityTarget);
      }
    }
    
    return new DynamicRepository();
  }

  /**
   * Gets the underlying DataSource
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Gets all initialized entity types
   */
  getInitializedEntities(): EntityType<any>[] {
    return this.dataSource.entityMetadatas.map(metadata => metadata.target as EntityType<any>);
  }

  /**
   * Begins a new transaction
   */
  async beginTransaction(): Promise<void> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();
  }

  /**
   * Commits the current transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('No active transaction');
    }
    await this.queryRunner.commitTransaction();
    await this.queryRunner.release();
    this.queryRunner = undefined;
  }

  /**
   * Rolls back the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('No active transaction');
    }
    await this.queryRunner.rollbackTransaction();
    await this.queryRunner.release();
    this.queryRunner = undefined;
  }

  /**
   * Saves all pending changes to the database
   */
  async saveChanges(): Promise<void> {
    // TODO: Implement change tracking and batch updates
  }

  /**
   * Disposes the database connection
   */
  async dispose(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.release();
    }
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
} 
