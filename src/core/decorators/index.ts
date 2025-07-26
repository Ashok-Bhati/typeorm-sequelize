import { Entity as TypeORMEntity, Column as TypeORMColumn, PrimaryGeneratedColumn as TypeORMPrimaryGeneratedColumn } from 'typeorm';
import { BaseRepository } from '../base/repository';

// Registry to store entity metadata
export class EntityRegistry {
  private static entities = new Set<Function>();

  static registerEntity(target: Function) {
    this.entities.add(target);
  }

  static getRegisteredEntities(): Function[] {
    return Array.from(this.entities);
  }
}

/**
 * Enhanced Entity decorator with additional tracking capabilities
 */
export function Entity(): ClassDecorator;
export function Entity(name?: string): ClassDecorator {
  return (target: any) => {
    EntityRegistry.registerEntity(target);
    return TypeORMEntity(name)(target);
  };
}

/**
 * Enhanced Column decorator with additional validation
 */
export const Column = TypeORMColumn; 

export const PrimaryGeneratedColumn = TypeORMPrimaryGeneratedColumn;

// Registry to store repository metadata
export class RepositoryRegistry {
  private static repositories = new Map<string, Function>();

  static registerRepository(name: string, target: Function) {
    this.repositories.set(name, target);
  }

  static getRegisteredRepositories(): Map<string, Function> {
    return this.repositories;
  }
}

/**
 * Repository decorator that registers the repository class
 * Automatically extends BaseRepository if not already extended
 */
export function Repository(): ClassDecorator;
export function Repository(name?: string): ClassDecorator {
  return <TFunction extends Function>(target: TFunction): TFunction | void => {
    // If not extending BaseRepository, create a new class that does
    if (!(target.prototype instanceof BaseRepository)) {
      throw new Error('Repository must extend BaseRepository');
    }

    RepositoryRegistry.registerRepository(name || target.name, target);
    return target;
  };
}

