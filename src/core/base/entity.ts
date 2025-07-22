import { EntityMetadata, BaseEntity as TypeORMBaseEntity } from 'typeorm';

import { EntityState, IEntity, ITrackable } from '../types/entity';

/**
 * Base class for all entities in the system
 */
export abstract class BaseEntity extends TypeORMBaseEntity implements IEntity, ITrackable {
  private _state: EntityState = EntityState.Unchanged;
  private _originalValues: Map<string, any> = new Map();
  private _isModified: boolean = false;

  /**
   * Gets the entity's metadata
   */
  get entityMetadata(): EntityMetadata | undefined {
    return (this.constructor as any).getRepository().metadata;
  }

  /**
   * Checks if the entity has been modified
   */
  isModified(): boolean {
    return this._isModified;
  }

  /**
   * Marks the entity as modified
   */
  markAsModified(): void {
    this._isModified = true;
    this._state = EntityState.Modified;
  }

  /**
   * Accepts all changes and resets tracking
   */
  acceptChanges(): void {
    this._isModified = false;
    this._state = EntityState.Unchanged;
    this._originalValues.clear();
  }

  /**
   * Gets the current state of the entity
   */
  getState(): EntityState {
    return this._state;
  }

  /**
   * Sets the state of the entity
   */
  setState(state: EntityState): void {
    this._state = state;
  }

  /**
   * Stores the original value of a property
   */
  protected storeOriginalValue(propertyName: string, value: any): void {
    if (!this._originalValues.has(propertyName)) {
      this._originalValues.set(propertyName, value);
    }
  }

  /**
   * Gets the original value of a property
   */
  getOriginalValue(propertyName: string): any {
    return this._originalValues.get(propertyName);
  }

  /**
   * Checks if a specific property has been modified
   */
  isPropertyModified(propertyName: string): boolean {
    return this._originalValues.has(propertyName);
  }

  /**
   * Converts entity or array of entities to plain JSON objects
   */
  protected toJSON<R = this>(): Partial<R> | Partial<R>[] | null {
    const data = this as unknown as R;
    return this.stripInternalProperties(data);
  }

  /**
   * Strips internal properties from an entity
   */
  private stripInternalProperties<R>(entity: R): Partial<R> {
    const result: Partial<R> = {};
    for (const key in entity) {
      if (
        !key.startsWith('_') && 
        typeof entity[key] !== 'function' &&
        !key.startsWith('__')
      ) {
        result[key] = entity[key];
      }
    }
    return result;
  }
} 
