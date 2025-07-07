import { REST, Routes } from 'discord.js';
import path from 'path';
import 'dotenv/config';
import logger from './logger';
import { loadModules, CommandModule } from './utils';

function hasToJSON(obj: any): obj is { toJSON: () => any } {
  return obj && typeof obj.toJSON === 'function';
}

(async () => {
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, 'commands');
  const loadedCommands = await loadModules<CommandModule>(commandsPath);
  loadedCommands.forEach(cmd => {
    if (cmd.data) {
      if (hasToJSON(cmd.data)) {
        commands.push(cmd.data.toJSON());
      } else {
        commands.push(cmd.data);
      }
    }
  });

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);

  try {
    logger.info('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands },
    );
    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error(error);
  }
})(); 