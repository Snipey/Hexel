# Database Configuration Guide

## Dynamic Database Switching

The bot now supports dynamic switching between SQLite and PostgreSQL databases. You can easily switch between database types without changing code.

## Prisma Configuration

The bot has been configured to support both SQLite and PostgreSQL. Here's what you need to do:

### 1. Install PostgreSQL

Make sure you have PostgreSQL installed and running on your system.

### 2. Create a Database

Create a new database for the bot:

```sql
CREATE DATABASE discordbot;
```

### 3. Environment Variables

Create a `.env` file in the bot directory with the following variables:

```env
# Database Configuration
DATABASE_TYPE=sqlite  # or postgresql
DATABASE_URL="file:./dev.db"  # for SQLite
# DATABASE_URL="postgresql://username:password@localhost:5432/discordbot?schema=public"  # for PostgreSQL

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# API Configuration
API_PORT=3001
API_HOST=localhost
```

### 4. Database Switching

You can switch between database types using several methods:

#### Method 1: Environment Variable
Set `DATABASE_TYPE` in your `.env` file:
- `DATABASE_TYPE=sqlite` for SQLite
- `DATABASE_TYPE=postgresql` for PostgreSQL

#### Method 2: CLI Commands
Use the provided npm scripts:
```bash
# Switch to SQLite
pnpm run db:switch-sqlite

# Switch to PostgreSQL
pnpm run db:switch-postgresql

# Check database status
pnpm run db:status

# Run migrations
pnpm run db:migrate
```

#### Method 3: Discord Command
Use the `/database` command in Discord (requires Administrator permissions):
- `/database status` - Show current database status
- `/database switch type:sqlite` - Switch to SQLite
- `/database switch type:postgresql` - Switch to PostgreSQL

### 5. Update Connection String

For PostgreSQL, replace the placeholders in the DATABASE_URL:
- `username`: Your PostgreSQL username
- `password`: Your PostgreSQL password
- `host`: Your PostgreSQL host (usually `localhost`)
- `port`: Your PostgreSQL port (usually `5432`)
- `database`: Your database name (e.g., `discordbot`)

### 6. Generate Prisma Client

After setting up your environment variables, generate the Prisma client:

```bash
pnpm prisma generate
```

### 7. Run Database Migrations

Create and apply the database schema:

```bash
pnpm prisma migrate dev --name init
```

### 8. Verify Connection

You can verify the connection by running:

```bash
pnpm prisma db pull
```

This will pull the current database schema and confirm the connection is working.

## Dependencies Added

The following dependencies have been added to support both databases:

- `pg`: PostgreSQL client for Node.js
- `@types/pg`: TypeScript definitions for pg

## Features Added

- **Dynamic Database Switching**: Switch between SQLite and PostgreSQL without code changes
- **CLI Management**: Command-line tools for database management
- **Discord Integration**: Database management commands in Discord
- **Automatic Schema Management**: Automatic schema file switching
- **Connection Testing**: Built-in connection verification

## Migration from SQLite

If you were previously using SQLite, you'll need to:

1. Export your data from SQLite
2. Set up PostgreSQL as described above
3. Import your data into PostgreSQL
4. Update any hardcoded SQLite-specific code

## Troubleshooting

### Connection Issues

- Make sure PostgreSQL is running
- Verify your connection string format
- Check that your database exists
- Ensure your user has proper permissions

### Permission Issues

If you get permission errors, you may need to:

```sql
GRANT ALL PRIVILEGES ON DATABASE discordbot TO your_username;
```

### Port Issues

If PostgreSQL is running on a different port, update the port in your connection string. 