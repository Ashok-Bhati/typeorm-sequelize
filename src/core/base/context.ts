import { DataSource, EntityManager, ObjectLiteral, QueryRunner } from 'typeorm';
import { BaseRepository } from './repository';
import { DbContextOptions, RepositoryRegistration } from '../types/options';
import { EntityType } from '../types/entity';
import { EntityRegistry } from '../decorators';

/**
 * DbContext class for managing database connections and repositories
 */
export class DbContext<T extends RepositoryRegistration = {}> {
  private dataSource!: DataSource;
  private options: DbContextOptions<T>;
  private repositories: Map<string, BaseRepository<any>>;
  private queryRunner?: QueryRunner;

  constructor(options: DbContextOptions<T>) {
    this.options = options;
    this.repositories = new Map();
  }

  /**
   * Initializes the database connection
   */
  async initialize(): Promise<void> {
    // Add registered entities to options if not already included
    const registeredEntities = EntityRegistry.getRegisteredEntities();
    const entities = new Set([
      ...(this.options.entities || []),
      ...registeredEntities
    ]);

    this.dataSource = new DataSource({
      type: this.options.type,
      host: this.options.host,
      port: this.options.port,
      username: this.options.username,
      password: this.options.password,
      database: this.options.database,
      entities: Array.from(entities),
      synchronize: this.options.synchronize
    });

    await this.dataSource.initialize();

    // Initialize repositories for all entities
    for (const entity of entities) {
      const entityName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);
      if (!this.repositories.has(entityName)) {
        this.repositories.set(
          entityName,
          BaseRepository.create(this.dataSource, entity as EntityType<any>)
        );
      }
    }

    // Initialize explicitly registered repositories
    if (this.options.repositories) {
      for (const [key, entityType] of Object.entries(this.options.repositories)) {
        if (!this.repositories.has(key)) {
          this.repositories.set(key, BaseRepository.create(this.dataSource, entityType));
        }
      }
    }
  }

  /**
   * Gets a repository for the specified entity type
   */
  set<Entity extends ObjectLiteral>(entityType: EntityType<Entity>): BaseRepository<Entity> {
    const entityName = entityType.name.charAt(0).toLowerCase() + entityType.name.slice(1);
    
    if (!this.repositories.has(entityName)) {
      this.repositories.set(
        entityName,
        BaseRepository.create(this.dataSource, entityType)
      );
    }

    return this.repositories.get(entityName) as BaseRepository<Entity>;
  }

  /**
   * Gets a registered repository by name
   */
  getRepository<K extends keyof T & string>(name: K): BaseRepository<InstanceType<T[K]>> {
    const repository = this.repositories.get(name);
    if (!repository) {
      throw new Error(`Repository '${name}' not found. Make sure it is registered in DbContextOptions.`);
    }
    return repository as BaseRepository<InstanceType<T[K]>>;
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

// Add property accessor for registered repositories
type RepositoryAccessor<T extends RepositoryRegistration> = {
  [K in keyof T]: BaseRepository<InstanceType<T[K]>>;
};

export type DbContextWithRepositories<T extends RepositoryRegistration> = DbContext<T> & RepositoryAccessor<T>; 
