import { Client, GatewayIntentBits, Interaction, MessageFlags } from 'discord.js';
import logger from '../utils/logger';
import { CommandModule } from '../types/command';
import { InteractionModule } from '../types/interaction';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

  // Periodic deadline reminder system
  setInterval(async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    // Projects with deadlines within 24h or overdue and not completed
    const projects = await prisma.project.findMany({
      where: {
        deadline: { not: null, lte: soon, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
      include: { members: true, subscriptions: true },
    });
    for (const project of projects) {
      const isOverdue = project.deadline && project.deadline < now;
      const msg = `⏰ Project **${project.name}** deadline is ${isOverdue ? 'OVERDUE' : 'within 24 hours'}: ${project.deadline?.toLocaleString()}`;
      const userIds = new Set([
        ...project.members.map(m => m.userId),
        ...project.subscriptions.map(s => s.userId),
      ]);
      for (const userId of userIds) {
        try {
          const user = await client.users.fetch(userId);
          if (user) await user.send(msg);
        } catch {}
      }
    }
    // Resources with deadlines within 24h or overdue and not completed
    const resources = await prisma.resource.findMany({
      where: {
        deadline: { not: null, lte: soon, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        completed: false,
      },
      include: { project: { include: { members: true, subscriptions: true } }, subscriptions: true },
    });
    for (const resource of resources) {
      const isOverdue = resource.deadline && resource.deadline < now;
      const msg = `⏰ Resource **${resource.resource}** in project **${resource.project.name}** deadline is ${isOverdue ? 'OVERDUE' : 'within 24 hours'}: ${resource.deadline?.toLocaleString()}`;
      const userIds = new Set([
        ...resource.project.members.map(m => m.userId),
        ...resource.project.subscriptions.map(s => s.userId),
        ...resource.subscriptions.map(s => s.userId),
      ]);
      for (const userId of userIds) {
        try {
          const user = await client.users.fetch(userId);
          if (user) await user.send(msg);
        } catch {}
      }
    }
  }, 10 * 60 * 1000); // every 10 minutes

  await client.login(process.env.BOT_TOKEN!);
} 