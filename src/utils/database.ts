import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { join } from 'path';

export type DatabaseType = 'sqlite' | 'postgresql';

export interface DatabaseConfig {
  type: DatabaseType;
  url: string;
  schemaPath: string;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private prismaClient: PrismaClient | null = null;
  private currentType: DatabaseType | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get the current database type from environment variables
   */
  public getDatabaseType(): DatabaseType {
    const dbType = process.env.DATABASE_TYPE?.toLowerCase();
    if (dbType === 'postgresql' || dbType === 'sqlite') {
      return dbType;
    }
    
    // Default to SQLite if not specified
    return 'sqlite';
  }

  /**
   * Get database configuration based on type
   */
  public getDatabaseConfig(): DatabaseConfig {
    const type = this.getDatabaseType();
    
    switch (type) {
      case 'postgresql':
        return {
          type: 'postgresql',
          url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/discordbot?schema=public',
          schemaPath: join(__dirname, '../../prisma/schema.postgresql.prisma')
        };
      case 'sqlite':
      default:
        return {
          type: 'sqlite',
          url: process.env.DATABASE_URL || 'file:./dev.db',
          schemaPath: join(__dirname, '../../prisma/schema.sqlite.prisma')
        };
    }
  }

  /**
   * Switch database type and regenerate Prisma client
   */
  public async switchDatabase(type: DatabaseType): Promise<void> {
    if (this.currentType === type) {
      console.log(`Database is already set to ${type}`);
      return;
    }

    console.log(`Switching database from ${this.currentType || 'unknown'} to ${type}...`);

    // Close existing client
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
      this.prismaClient = null;
    }

    // Set environment variable
    process.env.DATABASE_TYPE = type;

    // Copy appropriate schema file
    const sourceSchema = type === 'postgresql' 
      ? join(__dirname, '../../prisma/schema.postgresql.prisma')
      : join(__dirname, '../../prisma/schema.sqlite.prisma');
    
    const targetSchema = join(__dirname, '../../prisma/schema.prisma');
    
    try {
      copyFileSync(sourceSchema, targetSchema);
      console.log(`Copied ${type} schema to prisma/schema.prisma`);
    } catch (error) {
      console.error(`Failed to copy schema file: ${error}`);
      throw error;
    }

    // Regenerate Prisma client
    try {
      execSync('pnpm prisma generate', { stdio: 'inherit' });
      console.log('Prisma client regenerated successfully');
    } catch (error) {
      console.error(`Failed to regenerate Prisma client: ${error}`);
      throw error;
    }

    this.currentType = type;
    console.log(`Successfully switched to ${type} database`);
  }

  /**
   * Get or create Prisma client
   */
  public async getPrismaClient(): Promise<PrismaClient> {
    if (!this.prismaClient) {
      const type = this.getDatabaseType();
      
      // Ensure we have the correct schema file
      if (this.currentType !== type) {
        await this.switchDatabase(type);
      }

      this.prismaClient = new PrismaClient({
        datasources: {
          db: {
            url: this.getDatabaseConfig().url
          }
        }
      });

      // Test connection
      try {
        await this.prismaClient.$connect();
        console.log(`Connected to ${type} database successfully`);
      } catch (error) {
        console.error(`Failed to connect to ${type} database: ${error}`);
        throw error;
      }
    }

    return this.prismaClient;
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
      this.prismaClient = null;
    }
  }

  /**
   * Run database migrations
   */
  public async runMigrations(): Promise<void> {
    const type = this.getDatabaseType();
    console.log(`Running migrations for ${type} database...`);

    try {
      execSync('pnpm prisma migrate dev', { stdio: 'inherit' });
      console.log('Migrations completed successfully');
    } catch (error) {
      console.error(`Failed to run migrations: ${error}`);
      throw error;
    }
  }

  /**
   * Reset database (WARNING: This will delete all data)
   */
  public async resetDatabase(): Promise<void> {
    const type = this.getDatabaseType();
    console.log(`Resetting ${type} database...`);

    try {
      execSync('pnpm prisma migrate reset --force', { stdio: 'inherit' });
      console.log('Database reset completed successfully');
    } catch (error) {
      console.error(`Failed to reset database: ${error}`);
      throw error;
    }
  }

  /**
   * Get database status
   */
  public getStatus(): { type: DatabaseType; connected: boolean; url: string } {
    return {
      type: this.getDatabaseType(),
      connected: this.prismaClient !== null,
      url: this.getDatabaseConfig().url
    };
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance(); 