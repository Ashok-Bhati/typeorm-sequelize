import { DataSource, EntityTarget, ObjectLiteral, QueryRunner } from 'typeorm';
import { DbContextOptions } from '../types/options';
import { BaseRepository } from './repository';
import { EntityType } from '../types/entity';

/**
 * DbContext class for managing database connections and entity sets
 */
export class DbContext {
  private readonly dataSource: DataSource;
  private queryRunner?: QueryRunner;
  private repositories: Map<string, BaseRepository<any>>;

  constructor(options: DbContextOptions) {
    this.dataSource = new DataSource(options);
    this.repositories = new Map();
  }

  /**
   * Initializes the database connection
   */
  async initialize(): Promise<void> {
    await this.dataSource.initialize();
  }

  /**
   * Gets a DbSet for the specified entity type
   */
  set<T extends ObjectLiteral>(entityType: EntityType<T>): BaseRepository<T> {
    const entityName = entityType.name;
    
    if (!this.repositories.has(entityName)) {
      const repository = this.dataSource.getRepository(entityType);
      this.repositories.set(entityName, new BaseRepository(repository));
    }

    return this.repositories.get(entityName) as BaseRepository<T>;
  }

  /**
   * Begins a new transaction
   */
  async beginTransaction(): Promise<void> {
    if (!this.queryRunner) {
      this.queryRunner = this.dataSource.createQueryRunner();
    }
    await this.queryRunner.startTransaction();
  }

  /**
   * Commits the current transaction
   */
  async commitTransaction(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.commitTransaction();
      await this.queryRunner.release();
      this.queryRunner = undefined;
    }
  }

  /**
   * Rolls back the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.rollbackTransaction();
      await this.queryRunner.release();
      this.queryRunner = undefined;
    }
  }

  /**
   * Saves all changes made in this context to the database
   */
  async saveChanges(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.manager.save(this.getModifiedEntities());
    } else {
      await this.dataSource.manager.save(this.getModifiedEntities());
    }
  }

  /**
   * Gets all modified entities tracked by this context
   */
  private getModifiedEntities(): ObjectLiteral[] {
    const modifiedEntities: ObjectLiteral[] = [];
    // TODO: Implement change tracking
    return modifiedEntities;
  }

  /**
   * Disposes the context and releases all resources
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
