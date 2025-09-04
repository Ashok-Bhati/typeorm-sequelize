import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { DbContext } from '../core/base/context';
import { BaseRepository } from '../core/base/repository';
import { EntityRegistry } from '../core/decorators';
import { DbContextOptions, EntityType } from '../core/types';

export interface TypeormSequelizeModuleOptions extends Omit<DbContextOptions, 'entities'> {
  entities?: EntityType<any>[];
  global?: boolean;
}

export interface TypeormSequelizeModuleAsyncOptions {
  useFactory?: (...args: any[]) => Promise<TypeormSequelizeModuleOptions> | TypeormSequelizeModuleOptions;
  inject?: any[];
  global?: boolean;
}

const DB_CONTEXT_TOKEN = 'DB_CONTEXT';
const DB_CONTEXT_OPTIONS_TOKEN = 'DB_CONTEXT_OPTIONS';

@Global()
@Module({})
export class TypeormSequelizeModule {
  constructor(private readonly moduleRef: ModuleRef) {}

  static forRoot(options: TypeormSequelizeModuleOptions): DynamicModule {
    const dbContextProvider: Provider = {
      provide: DB_CONTEXT_TOKEN,
      useFactory: async () => {
        const context = new DbContext({
          ...options,
          entities: options.entities || [],
        });
        await context.initialize();
        return context;
      },
    };

    const repositoryProviders = this.createRepositoryProviders(options.entities || []);

    return {
      module: TypeormSequelizeModule,
      providers: [
        {
          provide: DB_CONTEXT_OPTIONS_TOKEN,
          useValue: options,
        },
        dbContextProvider,
        ...repositoryProviders,
      ],
      exports: [DB_CONTEXT_TOKEN, ...repositoryProviders],
      global: options.global ?? true,
    };
  }

  static forRootAsync(options: TypeormSequelizeModuleAsyncOptions): DynamicModule {
    const dbContextProvider: Provider = {
      provide: DB_CONTEXT_TOKEN,
      useFactory: async (...args: any[]) => {
        const config = await options.useFactory!(...args);
        const context = new DbContext({
          ...config,
          entities: config.entities || [],
        });
        await context.initialize();
        return context;
      },
      inject: options.inject || [],
    };

    const asyncOptionsProvider: Provider = {
      provide: DB_CONTEXT_OPTIONS_TOKEN,
      useFactory: options.useFactory!,
      inject: options.inject || [],
    };

    return {
      module: TypeormSequelizeModule,
      providers: [
        asyncOptionsProvider,
        dbContextProvider,
        {
          provide: 'REPOSITORY_PROVIDERS',
          useFactory: (dbOptions: TypeormSequelizeModuleOptions) => {
            return this.createRepositoryProviders(dbOptions.entities || []);
          },
          inject: [DB_CONTEXT_OPTIONS_TOKEN],
        },
      ],
      exports: [DB_CONTEXT_TOKEN, 'REPOSITORY_PROVIDERS'],
      global: options.global ?? true,
    };
  }

  private static createRepositoryProviders(entities: EntityType<any>[]): Provider[] {
    const registeredEntities = EntityRegistry.getRegisteredEntities();
    const allEntities = [...entities, ...registeredEntities];

    return allEntities.map((entity) => ({
      provide: this.getRepositoryToken(entity),
      useFactory: (dbContext: DbContext) => {
        return dbContext.getRepository(entity as EntityType<any>);
      },
      inject: [DB_CONTEXT_TOKEN],
    }));
  }

  static getRepositoryToken(entity: EntityType<any> | Function): string {
    const name = entity.name;
    return `${name}Repository`;
  }
}
