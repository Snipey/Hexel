import { REST, Routes } from 'discord.js';
import logger from '../utils/logger';
import { CommandModule } from '../types/command';

export async function registerCommands(commands: CommandModule[]) {
  const commandsArray: any[] = [];
  function hasToJSON(obj: any): obj is { toJSON: () => any } {
    return obj && typeof obj.toJSON === 'function';
  }
  commands.forEach(cmd => {
    if (cmd.data) {
      if (hasToJSON(cmd.data)) {
        commandsArray.push(cmd.data.toJSON());
      } else {
        commandsArray.push(cmd.data);
      }
    }
  });
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
  try {
    logger.info('Registering application (/) commands globally.');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commandsArray },
    );
    logger.info('Successfully registered application (/) commands globally.');
    logger.info(`Registered commands: ${commandsArray.map(cmd => cmd.name).join(', ')}`);
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
} 