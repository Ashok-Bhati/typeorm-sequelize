# EF Core-Style TypeORM Wrapper

A TypeScript ORM that provides Entity Framework Core-like syntax and features on top of TypeORM.

## Features

- EF Core-like query syntax
- Enhanced entity tracking
- Simplified relationship management
- Express.js integration
- Transaction management
- Type-safe queries

## Installation

```bash
# Using npm
npm install ef-core-typeorm

# Using yarn
yarn add ef-core-typeorm
```

## Building from Source

1. Clone the repository:

```bash
git clone <your-repo-url>
cd ef-core-typeorm
```

2. Install dependencies:

```bash
yarn install
```

3. Build the package:

```bash
yarn build
```

4. (Optional) Create a local link:

```bash
yarn link
```

## Usage

### Basic Setup

```typescript
import { DbContext, Entity, Column } from 'ef-core-typeorm';

@Entity()
class User {
  @Column()
  id: number;

  @Column()
  name: string;
}

const options = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'password',
  database: 'mydb',
  entities: [User],
  synchronize: true
};

const context = new DbContext(options);
await context.initialize();
```

### Querying

```typescript
// Get repository
const userRepo = context.set(User);

// Basic queries
const firstUser = await userRepo.first();
const users = await userRepo
  .where(u => u.name === 'John')
  .orderBy(u => u.id)
  .toList();

// Include related data
const usersWithPosts = await userRepo
  .include(u => u.posts)
  .toList();
```

### Express Integration

```typescript
import express from 'express';
import { withDbContext, withTransaction } from 'ef-core-typeorm';

const app = express();
const context = new DbContext(options);

// Add middleware
app.use(withDbContext(context));

// Use transactions in routes
app.post('/users', withTransaction, async (req, res) => {
  const userRepo = req.dbContext.set(User);
  const user = new User();
  user.name = req.body.name;
  await userRepo.getRepository().save(user);
  res.json(user);
});
```

## Publishing as a Package

1. Update package.json:

```json
{
  "name": "ef-core-typeorm",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "prepublishOnly": "yarn build"
  }
}
```

2. Build the package:

```bash
yarn build
```

3. Publish to npm:

```bash
npm login
npm publish
```

## Using in Another Project

1. Install the package:

```bash
yarn add ef-core-typeorm
```

2. Import and use:

```typescript
import { DbContext, Entity, Column } from 'ef-core-typeorm';

// Set up entities and context as shown above
```

## Development

1. Local Testing:

```bash
# In ef-core-typeorm directory
yarn link
yarn build --watch

# In your test project directory
yarn link ef-core-typeorm
```

2. Running Tests:

```bash
yarn test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
