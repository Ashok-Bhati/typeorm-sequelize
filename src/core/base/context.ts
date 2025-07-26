import { DataSource, EntityManager, ObjectLiteral, QueryRunner, Repository } from 'typeorm';

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
   * Gets the underlying DataSource
   */
  getDataSource(): DataSource {
    return this.dataSource;
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
