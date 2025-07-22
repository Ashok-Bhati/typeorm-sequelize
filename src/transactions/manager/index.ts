import { DataSource, QueryRunner } from 'typeorm';
import { TransactionOptions } from '../../core/types/options';

export class TransactionManager {
  private queryRunner: QueryRunner | null = null;

  constructor(
    private dataSource: DataSource,
    private options: TransactionOptions = {}
  ) {}

  /**
   * Begins a new transaction
   */
  async begin(): Promise<void> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.startTransaction(this.options.isolationLevel);
  }

  /**
   * Commits the current transaction
   */
  async commit(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.commitTransaction();
      await this.queryRunner.release();
      this.queryRunner = null;
    }
  }

  /**
   * Rolls back the current transaction
   */
  async rollback(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.rollbackTransaction();
      await this.queryRunner.release();
      this.queryRunner = null;
    }
  }
} 
