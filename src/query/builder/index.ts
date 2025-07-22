import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { QueryBuilderOptions } from '../../core/types/options';

export class EFQueryBuilder<T extends ObjectLiteral> {
  constructor(
    protected queryBuilder: SelectQueryBuilder<T>,
    protected options: QueryBuilderOptions = {}
  ) {}

  /**
   * Adds a WHERE clause
   */
  where(condition: string, parameters?: ObjectLiteral): this {
    this.queryBuilder.where(condition, parameters);
    return this;
  }

  /**
   * Adds an ORDER BY clause
   */
  orderBy(sort: string, order: 'ASC' | 'DESC' = 'ASC'): this {
    this.queryBuilder.orderBy(sort, order);
    return this;
  }

  /**
   * Gets the underlying TypeORM query builder
   */
  getQueryBuilder(): SelectQueryBuilder<T> {
    return this.queryBuilder;
  }
} 
