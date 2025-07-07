import { Client, GatewayIntentBits, Interaction, MessageFlags } from 'discord.js';
import logger from '../utils/logger';
import { CommandModule } from '../types/command';
import { InteractionModule } from '../types/interaction';

export async function startBot(commands: Map<string, CommandModule>, interactions: InteractionModule[]) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

  client.once('ready', () => {
    logger.info(`Logged in as ${client.user?.tag}!`);
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(error);
        await interaction.reply({ content: 'There was an error executing this command!', flags: MessageFlags.Ephemeral });
      }
    } else if (interaction.isButton()) {
      let handler: InteractionModule | undefined;
      for (const h of interactions) {
        const names = Array.isArray(h.data.name) ? h.data.name : [h.data.name];
        for (const n of names) {
          if (typeof n === 'string' && n === interaction.customId) {
            handler = h;
            break;
          } else if (n instanceof RegExp && n.test(interaction.customId)) {
            handler = h;
            break;
          }
        }
        if (handler) break;
      }
      if (!handler) {
        logger.error(`No handler found for button customId: ${interaction.customId}`);
        return;
      }
      logger.info(`Found handler for button customId: ${interaction.customId}`);
      try {
        await handler.execute(interaction);
      } catch (error) {
        logger.error(error);
        await interaction.reply({ content: 'There was an error handling this interaction!', flags: MessageFlags.Ephemeral });
      }
    }
  });

  await client.login(process.env.BOT_TOKEN!);
} 