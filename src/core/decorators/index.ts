import { Entity as TypeORMEntity, Column as TypeORMColumn, PrimaryGeneratedColumn as TypeORMPrimaryGeneratedColumn } from 'typeorm';

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
