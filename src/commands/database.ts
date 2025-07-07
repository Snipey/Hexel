import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandModule } from '../types/command';
import { databaseManager } from '../utils/database';

export const database: CommandModule = {
  data: new SlashCommandBuilder()
    .setName('database')
    .setDescription('Manage database configuration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Show current database status')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('switch')
        .setDescription('Switch database type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Database type to switch to')
            .setRequired(true)
            .addChoices(
              { name: 'SQLite', value: 'sqlite' },
              { name: 'PostgreSQL', value: 'postgresql' }
            )
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'status': {
          const status = databaseManager.getStatus();
          
          const embed = new EmbedBuilder()
            .setTitle('Database Status')
            .setColor(status.connected ? '#00ff00' : '#ff0000')
            .addFields(
              { name: 'Type', value: status.type, inline: true },
              { name: 'Connected', value: status.connected ? 'Yes' : 'No', inline: true },
              { name: 'URL', value: status.url || 'Not configured', inline: false }
            )
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'switch': {
          const dbType = interaction.options.getString('type') as 'sqlite' | 'postgresql';
          
          await interaction.deferReply({ ephemeral: true });
          
          try {
            await databaseManager.switchDatabase(dbType);
            
            const embed = new EmbedBuilder()
              .setTitle('Database Switched')
              .setDescription(`Successfully switched to ${dbType} database`)
              .setColor('#00ff00')
              .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
          } catch (error) {
            const embed = new EmbedBuilder()
              .setTitle('Database Switch Failed')
              .setDescription(`Failed to switch to ${dbType}: ${error}`)
              .setColor('#ff0000')
              .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
          }
          break;
        }

        default:
          await interaction.reply({ 
            content: 'Unknown subcommand', 
            ephemeral: true 
          });
      }
    } catch (error) {
      console.error('Database command error:', error);
      await interaction.reply({ 
        content: `An error occurred: ${error}`, 
        ephemeral: true 
      });
    }
  },
}; 