import { DataSourceOptions, ObjectLiteral } from 'typeorm';
import { EntityType } from './entity';

/**
 * Repository registration mapping
 */
export interface RepositoryRegistration {
  [key: string]: EntityType<ObjectLiteral>;
}

/**
 * Infers repository names from entity types
 */
export type InferredRepositories<T extends Record<string, EntityType<ObjectLiteral>>> = {
  [K in keyof T as K extends string 
    ? Uncapitalize<T[K] extends { name: string } ? T[K]['name'] : never>
    : never]: T[K] extends EntityType<infer R> ? R : never;
};

/**
 * Options for configuring the DbContext
 */
export interface DbContextOptions<T extends RepositoryRegistration = {}> {
  // TypeORM required options
  type: 'mysql' | 'postgres' | 'sqlite' | 'mssql';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  entities: (EntityType<ObjectLiteral> | string)[];
  synchronize?: boolean;

  // Repository registration
  repositories?: T;

  // Custom options
  enableLogging?: boolean;
  defaultTracking?: boolean;
  maxResults?: number;
  queryTimeout?: number;
  enableLazyLoading?: boolean;
  enableQueryCache?: boolean;
  queryCacheDuration?: number;
}

/**
 * Options for configuring relationships
 */
export interface RelationshipOptions {
  /**
   * Enable cascade delete
   */
  cascadeDelete?: boolean;

  /**
   * Enable lazy loading for this relationship
   */
  lazy?: boolean;

  /**
   * Enable eager loading for this relationship
   */
  eager?: boolean;

  /**
   * Join table name for many-to-many relationships
   */
  joinTable?: string;

  /**
   * Foreign key name
   */
  foreignKey?: string;
}

/**
 * Options for configuring the query builder
 */
export interface QueryBuilderOptions {
  /**
   * Enable tracking for this query
   */
  tracking?: boolean;

  /**
   * Query timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum number of results
   */
  maxResults?: number;

  /**
   * Enable caching for this query
   */
  cache?: boolean;

  /**
   * Cache duration in milliseconds
   */
  cacheDuration?: number;
}

/**
 * Options for configuring transactions
 */
export interface TransactionOptions {
  /**
   * Transaction isolation level
   */
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

  /**
   * Transaction timeout in milliseconds
   */
  timeout?: number;
} 
