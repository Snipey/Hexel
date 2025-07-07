import { ButtonInteraction, MessageFlags } from 'discord.js';

export const data = {
  name: 'example_button',
};

export async function execute(interaction: ButtonInteraction) {
  await interaction.reply({ content: 'Button clicked!', flags: MessageFlags.Ephemeral });
}

module.exports = { data, execute }; 