import { Inject } from '@nestjs/common';

import { EntityType } from '../core/types';
import { TypeormSequelizeModule } from './typeorm-sequelize.module';

/**
 * Decorator to inject a repository for a specific entity
 * @param entity The entity class to get the repository for
 * @returns Parameter decorator for dependency injection
 */
export function InjectRepository(entity: EntityType<any>): ParameterDecorator {
  const token = TypeormSequelizeModule.getRepositoryToken(entity);
  
  // Register this entity as needing a repository provider
  TypeormSequelizeModule.registerRepositoryEntity(entity);
  
  return Inject(token);
}

/**
 * Decorator to inject the DbContext
 * @returns Parameter decorator for dependency injection
 */
export function InjectDbContext(): ParameterDecorator {
  return Inject('DB_CONTEXT');
}
