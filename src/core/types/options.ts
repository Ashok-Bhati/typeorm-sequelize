import { DataSourceOptions } from 'typeorm';

/**
 * Options for configuring the DbContext
 */
export interface DbContextOptions {
  // TypeORM required options
  type: 'mysql' | 'postgres' | 'sqlite' | 'mssql';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  entities: any[];
  synchronize?: boolean;

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
