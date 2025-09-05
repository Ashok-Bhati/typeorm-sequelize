import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ModuleRef, DiscoveryService } from '@nestjs/core';

import { DbContext } from '../core/base/context';
import { BaseRepository } from '../core/base/repository';
import { EntityRegistry } from '../core/decorators';
import { DbContextOptions, EntityType } from '../core/types';

export interface TypeormSequelizeModuleOptions extends Omit<DbContextOptions, 'entities'> {
  entities?: (EntityType<any> | string)[];
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
  private static registeredEntities = new Set<EntityType<any>>();
  private static dbContext: DbContext | null = null;
  
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
        
        // Store the DbContext for later use
        TypeormSequelizeModule.dbContext = context;
        
        return context;
      },
      inject: options.inject || [],
    };

    const asyncOptionsProvider: Provider = {
      provide: DB_CONTEXT_OPTIONS_TOKEN,
      useFactory: options.useFactory!,
      inject: options.inject || [],
    };

    // Create dynamic repository providers for registered entities
    const dynamicRepositoryProviders = this.createDynamicRepositoryProviders();

    return {
      module: TypeormSequelizeModule,
      providers: [
        asyncOptionsProvider,
        dbContextProvider,
        ...dynamicRepositoryProviders,
      ],
      exports: [DB_CONTEXT_TOKEN, ...dynamicRepositoryProviders],
      global: options.global ?? true,
    };
  }

  /**
   * Registers an entity that needs a repository provider
   */
  static registerRepositoryEntity(entity: EntityType<any>): void {
    this.registeredEntities.add(entity);
  }

  private static createRepositoryProviders(entities: (EntityType<any> | string)[]): Provider[] {
    const registeredEntities = EntityRegistry.getRegisteredEntities();
    
    // Only create providers for entity constructors (not string paths)
    const entityConstructors = entities.filter((entity): entity is EntityType<any> => 
      typeof entity === 'function'
    );
    
    const allEntities = [...entityConstructors, ...registeredEntities];

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

  /**
   * Creates dynamic repository providers that work with any entity
   */
  private static createDynamicRepositoryProviders(): Provider[] {
    const providers: Provider[] = [];
    
    // Create providers for all registered entities
    for (const entity of this.registeredEntities) {
      const token = this.getRepositoryToken(entity);
      providers.push({
        provide: token,
        useFactory: (dbContext: DbContext) => {
          try {
            return dbContext.getRepositoryByName(entity.name);
          } catch (error) {
            // Return a proxy that throws a helpful error when methods are called
            return new Proxy({}, {
              get: () => {
                throw new Error(
                  `Entity '${entity.name}' not found in DbContext. ` +
                  `Make sure it's included in your entities configuration and the entity file is properly decorated with @Entity().`
                );
              }
            });
          }
        },
        inject: [DB_CONTEXT_TOKEN],
      });
    }
    
    // Also create a fallback universal provider for any unregistered entities
    providers.push({
      provide: 'FALLBACK_REPOSITORY_PROVIDER',
      useFactory: (dbContext: DbContext) => {
        return (entityName: string) => {
          try {
            return dbContext.getRepositoryByName(entityName);
          } catch (error) {
            throw new Error(
              `Entity '${entityName}' not found. Available entities: ${
                dbContext.getDataSource().entityMetadatas.map(m => m.name).join(', ')
              }`
            );
          }
        };
      },
      inject: [DB_CONTEXT_TOKEN],
    });
    
    return providers;
  }
}
