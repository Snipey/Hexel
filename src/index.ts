import 'dotenv/config';
import path from 'path';
import { loadModulesArray } from './bot/loader';
import { registerCommands } from './bot/register';
import { startBot } from './bot/client';
import { CommandModule } from './types/command';
import { InteractionModule } from './types/interaction';
import { Client, GatewayIntentBits } from 'discord.js';
import logger from './utils/logger';

(async () => {
  // Load commands and interactions
  const loadedCommands = await loadModulesArray<CommandModule>(path.join(__dirname, 'commands'));
  const commandsMap = new Map<string, CommandModule>();
  loadedCommands.forEach((cmd: CommandModule) => commandsMap.set(cmd.data.name, cmd));
  const loadedInteractions = await loadModulesArray<InteractionModule>(path.join(__dirname, 'interactions'));

  // Register commands with Discord
  await registerCommands(loadedCommands);

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  // Shard-aware logging
  client.once('ready', () => {
    const shardId = client.shard?.ids[0] ?? 0;
    logger.info(`[Shard ${shardId}] Logged in as ${client.user?.tag}!`);
    // Send stats to ShardingManager (IPC)
    if (process.send) {
      process.send({ _type: 'SHARD_STATS', data: {
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        shardId,
      }});
    }
  });

  // /shardstatus command
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'shardstatus') {
      const shardId = client.shard?.ids[0] ?? 0;
      let globalStats = '';
      if (client.shard && client.shard.count > 1) {
        // Get stats from all shards
        const results = await client.shard.broadcastEval(c => ({
          guilds: c.guilds.cache.size,
          users: c.users.cache.size,
          shardId: c.shard?.ids[0] ?? 0,
        }));
        const totalGuilds = results.reduce((a, b) => a + b.guilds, 0);
        const totalUsers = results.reduce((a, b) => a + b.users, 0);
        globalStats = `Total Shards: ${client.shard.count}\nTotal Guilds: ${totalGuilds}\nTotal Users: ${totalUsers}`;
      }
      await interaction.reply({
        content: `This guild is on shard **${shardId}**.\n${globalStats}`,
        ephemeral: true,
      });
      return;
    }
  });

  // Start the bot
  await startBot(commandsMap, loadedInteractions);
})(); 