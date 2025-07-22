import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { QueryBuilderOptions } from '../../core/types/options';

export class QueryExecutor<T extends ObjectLiteral> {
  constructor(
    private queryBuilder: SelectQueryBuilder<T>,
    private options: QueryBuilderOptions = {}
  ) {}

  /**
   * Executes the query and returns a single result
   */
  async getOne(): Promise<T | null> {
    return this.queryBuilder.getOne();
  }

  /**
   * Executes the query and returns multiple results
   */
  async getMany(): Promise<T[]> {
    if (this.options.maxResults) {
      this.queryBuilder.take(this.options.maxResults);
    }
    return this.queryBuilder.getMany();
  }

  /**
   * Executes the query and returns the count
   */
  async getCount(): Promise<number> {
    return this.queryBuilder.getCount();
  }
} 
