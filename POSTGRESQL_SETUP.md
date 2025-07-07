# PostgreSQL Setup Guide

## Prisma Configuration

The bot has been configured to use PostgreSQL instead of SQLite. Here's what you need to do:

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
# PostgreSQL connection string format:
# postgresql://username:password@host:port/database?schema=public
DATABASE_URL="postgresql://username:password@localhost:5432/discordbot?schema=public"

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

### 4. Update Connection String

Replace the placeholders in the DATABASE_URL:
- `username`: Your PostgreSQL username
- `password`: Your PostgreSQL password
- `host`: Your PostgreSQL host (usually `localhost`)
- `port`: Your PostgreSQL port (usually `5432`)
- `database`: Your database name (e.g., `discordbot`)

### 5. Generate Prisma Client

After setting up your environment variables, generate the Prisma client:

```bash
pnpm prisma generate
```

### 6. Run Database Migrations

Create and apply the database schema:

```bash
pnpm prisma migrate dev --name init
```

### 7. Verify Connection

You can verify the connection by running:

```bash
pnpm prisma db pull
```

This will pull the current database schema and confirm the connection is working.

## Dependencies Added

The following dependencies have been added to support PostgreSQL:

- `pg`: PostgreSQL client for Node.js
- `@types/pg`: TypeScript definitions for pg

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