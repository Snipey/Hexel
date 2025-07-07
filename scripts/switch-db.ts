#!/usr/bin/env ts-node

import { databaseManager } from '../src/utils/database';
import { DatabaseType } from '../src/utils/database';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dbType = args[1] as DatabaseType;

  if (!command) {
    console.log('Database Management Script');
    console.log('');
    console.log('Usage:');
    console.log('  pnpm run switch-db <command> [database-type]');
    console.log('');
    console.log('Commands:');
    console.log('  switch <type>    Switch to specified database type (sqlite|postgresql)');
    console.log('  status           Show current database status');
    console.log('  migrate          Run database migrations');
    console.log('  reset            Reset database (WARNING: deletes all data)');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm run switch-db switch sqlite');
    console.log('  pnpm run switch-db switch postgresql');
    console.log('  pnpm run switch-db status');
    console.log('  pnpm run switch-db migrate');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'switch':
        if (!dbType || !['sqlite', 'postgresql'].includes(dbType)) {
          console.error('Error: Please specify a valid database type (sqlite or postgresql)');
          process.exit(1);
        }
        
        console.log(`Switching to ${dbType} database...`);
        await databaseManager.switchDatabase(dbType);
        console.log(`Successfully switched to ${dbType}`);
        break;

      case 'status':
        const status = databaseManager.getStatus();
        console.log('Database Status:');
        console.log(`  Type: ${status.type}`);
        console.log(`  Connected: ${status.connected ? 'Yes' : 'No'}`);
        console.log(`  URL: ${status.url}`);
        break;

      case 'migrate':
        console.log('Running database migrations...');
        await databaseManager.runMigrations();
        console.log('Migrations completed successfully');
        break;

      case 'reset':
        console.log('WARNING: This will delete all data in the database!');
        console.log('Type "yes" to confirm:');
        
        // Wait for user confirmation
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (key) => {
          if (key.toString().toLowerCase().includes('yes')) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            
            await databaseManager.resetDatabase();
            console.log('Database reset completed');
            process.exit(0);
          } else {
            console.log('Database reset cancelled');
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.exit(0);
          }
        });
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await databaseManager.disconnect();
  }
}

main().catch(console.error); 