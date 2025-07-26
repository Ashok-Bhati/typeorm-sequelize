import { DbContextOptions } from '../../types/options';
import { DbContext } from '../context';
import { TestEntity } from './test-entity';
import { BaseRepository } from '../repository';

class TestRepository extends BaseRepository<TestEntity> {
  constructor(context: DbContext) {
    super(context, TestEntity);
  }
}

describe('DbContext', () => {
  let context: DbContext;

  beforeAll(async () => {
    const options: DbContextOptions = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'test_db',
      synchronize: true,
      entities: [TestEntity],
      enableLogging: false
    };

    context = new DbContext(options);
    await context.initialize();
  });

  afterAll(async () => {
    await context.dispose();
  });

  describe('Basic CRUD Operations', () => {
    it('should create and retrieve an entity', async () => {
      // Arrange
      const testEntity = new TestEntity('Test Entity', 'Test Description');

      // Act
      const repository = new TestRepository(context);
      await repository.save(testEntity);
      const result = await repository.first();

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Entity');
      expect(result.description).toBe('Test Description');
    });

    it('should update an entity', async () => {
      // Arrange
      const repository = new TestRepository(context);
      const entity = await repository.first();
      entity.name = 'Updated Name';

      // Act
      await context.saveChanges();
      const updatedEntity = await repository.first();

      // Assert
      expect(updatedEntity.name).toBe('Updated Name');
    });

    it('should delete an entity', async () => {
      // Arrange
      const repository = new TestRepository(context);
      const entity = await repository.first();

      // Act
      await repository.remove(entity);
      const result = await repository.firstOrDefault();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Query Methods', () => {
    beforeEach(async () => {
      const repository = new TestRepository(context);
      await repository.save([
        new TestEntity('Entity 1', 'Description 1'),
        new TestEntity('Entity 2', 'Description 2'),
        new TestEntity('Entity 3', 'Description 3')
      ]);
    });

    afterEach(async () => {
      const repository = new TestRepository(context);
      await repository.removeAll();
    });

    it('should filter entities using where', async () => {
      // Arrange
      const repository = new TestRepository(context);

      // Act
      const results = await repository
        // .where(`name LIKE '%Entity 2%'`)
        .toList();

      // Assert
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Entity 2');
    });

    it('should order entities', async () => {
      // Arrange
      const repository = new TestRepository(context);

      // Act
      const results = await repository
        .orderByDescending(e => e.name)
        .toList();

      // Assert
      expect(results.length).toBe(3);
      expect(results[0].name).toBe('Entity 3');
      expect(results[2].name).toBe('Entity 1');
    });

    it('should support paging', async () => {
      // Arrange
      const repository = new TestRepository(context);

      // Act
      const results = await repository
        .orderBy(e => e.name)
        .skip(1)
        .take(1)
        .toList();

      // Assert
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Entity 2');
    });
  });

  describe('Transactions', () => {
    it('should commit transaction successfully', async () => {
      // Arrange
      const repository = new TestRepository(context);
      const entity = new TestEntity('Transaction Test');

      // Act
      await context.beginTransaction();
      await repository.save(entity);
      await context.commitTransaction();

      // Assert
      const result = await repository
        // .where(`name LIKE '%Transaction Test%'`)
        .firstOrDefault();
      expect(result).toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      // Arrange
      const repository = new TestRepository(context);
      const entity = new TestEntity('Rollback Test');

      // Act
      await context.beginTransaction();
      await repository.save(entity);
      await context.rollbackTransaction();

      // Assert
      const result = await repository
        // .where(`name LIKE '%Rollback Test%'`)
        .firstOrDefault();
      expect(result).toBeNull();
    });
  });
}); 
