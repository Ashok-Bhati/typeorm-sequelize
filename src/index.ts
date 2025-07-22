import 'reflect-metadata';

// Re-export core functionality
export * from './core/base';
export * from './core/decorators';
export * from './core/types';
export * from './core/utils';

// Re-export query functionality
export * from './query/builder';
export * from './query/executor';

// Re-export relation functionality
export * from './relations/handlers';

// Re-export transaction functionality
export * from './transactions/manager';

// Re-export express middleware
export * from './express/middleware'; 
