import { ObjectLiteral, Repository } from 'typeorm';
import { RelationshipOptions } from '../../core/types/options';

export class RelationHandler<T extends ObjectLiteral> {
  constructor(
    private repository: Repository<T>,
    private relationName: string,
    private options: RelationshipOptions = {}
  ) {}

  /**
   * Sets the relation to be eagerly loaded
   */
  setEager(): void {
    this.options.eager = true;
  }

  /**
   * Sets the relation to be lazily loaded
   */
  setLazy(): void {
    this.options.lazy = true;
  }

  /**
   * Gets the current loading options
   */
  getOptions(): RelationshipOptions {
    return { ...this.options };
  }
} 
