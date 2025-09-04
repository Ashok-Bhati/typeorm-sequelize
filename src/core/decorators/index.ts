import { AfterInsert as TypeORMAfterInsert, AfterLoad as TypeORMAfterLoad, AfterRecover as TypeORMAfterRecover, AfterRemove as TypeORMAfterRemove, AfterSoftRemove as TypeORMAfterSoftRemove, AfterUpdate as TypeORMAfterUpdate, BeforeInsert as TypeORMBeforeInsert, BeforeRecover as TypeORMBeforeRecover, BeforeRemove as TypeORMBeforeRemove, BeforeSoftRemove as TypeORMBeforeSoftRemove, BeforeUpdate as TypeORMBeforeUpdate, Column as TypeORMColumn, CreateDateColumn as TypeORMCreateDateColumn, DeleteDateColumn as TypeORMDeleteDateColumn, Entity as TypeORMEntity, ForeignKey as TypeORMForeignKey, JoinColumn as TypeORMJoinColumn, JoinTable as TypeORMJoinTable, ManyToMany as TypeORMManyToMany, ManyToOne as TypeORMManyToOne, OneToMany as TypeORMOneToMany, OneToOne as TypeORMOneToOne, PrimaryGeneratedColumn as TypeORMPrimaryGeneratedColumn, UpdateDateColumn as TypeORMUpdateDateColumn } from 'typeorm';

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

export const AfterInsert = TypeORMAfterInsert;
export const AfterUpdate = TypeORMAfterUpdate;
export const BeforeInsert = TypeORMBeforeInsert;
export const BeforeUpdate = TypeORMBeforeUpdate;
export const AfterLoad = TypeORMAfterLoad;
export const BeforeRemove = TypeORMBeforeRemove;
export const AfterRemove = TypeORMAfterRemove;
export const AfterSoftRemove = TypeORMAfterSoftRemove;
export const BeforeSoftRemove = TypeORMBeforeSoftRemove;
export const BeforeRecover = TypeORMBeforeRecover;
export const AfterRecover = TypeORMAfterRecover;
export const CreateDateColumn = TypeORMCreateDateColumn;
export const DeleteDateColumn = TypeORMDeleteDateColumn;
export const ForeignKey = TypeORMForeignKey;
export const JoinColumn = TypeORMJoinColumn;
export const JoinTable = TypeORMJoinTable;
export const ManyToMany = TypeORMManyToMany;
export const ManyToOne = TypeORMManyToOne;
export const OneToMany = TypeORMOneToMany;
export const OneToOne = TypeORMOneToOne;
export const UpdateDateColumn = TypeORMUpdateDateColumn;

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
