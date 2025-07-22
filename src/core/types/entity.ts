import { EntityMetadata } from 'typeorm';

/**
 * Base interface for all entities
 */
export interface IEntity {
  readonly entityMetadata?: EntityMetadata;
}

/**
 * Interface for entities with tracking capabilities
 */
export interface ITrackable {
  isModified(): boolean;
  markAsModified(): void;
  acceptChanges(): void;
}

/**
 * Interface for entities with timestamps
 */
export interface ITimestamped {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for soft-deletable entities
 */
export interface ISoftDeletable {
  deletedAt?: Date;
  isDeleted: boolean;
}

/**
 * Type for entity constructor
 */
export type EntityType<T> = { new (...args: any[]): T };

/**
 * Entity state in the context
 */
export enum EntityState {
  Detached,
  Unchanged,
  Added,
  Modified,
  Deleted
}

/**
 * Entity entry tracking information
 */
export interface IEntityEntry<T> {
  entity: T;
  state: EntityState;
  originalValues: Partial<T>;
  currentValues: Partial<T>;
  isModified(propertyName?: keyof T): boolean;
}

/**
 * Configuration options for entities
 */
export interface EntityOptions {
  tableName?: string;
  schema?: string;
  synchronize?: boolean;
  orderBy?: { [P in keyof any]?: 'ASC' | 'DESC' };
} 
