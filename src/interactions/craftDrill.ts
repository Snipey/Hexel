import { ButtonInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import logger from '../logger';

const recipesPath = path.join(__dirname, '../data/region/crafting_recipe_desc.json');
const itemsPath = path.join(__dirname, '../data/region/item_desc.json');
const buildingsPath = path.join(__dirname, '../data/region/building_type_desc.json');
let recipes: any[] = [];
let items: any[] = [];
let buildings: any[] = [];
let itemIdToName = new Map<number, string>();
let buildingTypeToName = new Map<number, string>();
try {
  const rawRecipes = fs.readFileSync(recipesPath, 'utf8');
  recipes = JSON.parse(rawRecipes);
  const rawItems = fs.readFileSync(itemsPath, 'utf8');
  items = JSON.parse(rawItems);
  for (const item of items) {
    itemIdToName.set(item.id, item.name);
  }
  const rawBuildings = fs.readFileSync(buildingsPath, 'utf8');
  buildings = JSON.parse(rawBuildings);
  for (const building of buildings) {
    buildingTypeToName.set(building.id, building.name);
  }
} catch (e) {
  console.error('Failed to load crafting recipes, items, or buildings:', e);
}

function findRecipeByOutputId(id: number) {
  return recipes.find(recipe =>
    recipe.crafted_item_stacks && recipe.crafted_item_stacks.some((stack: any) => stack[0] === id)
  );
}

function getCraftingStationAndTier(recipe: any): string {
  if (Array.isArray(recipe.building_requirement) && recipe.building_requirement.length > 1) {
    const req = recipe.building_requirement[1];
    if (req && typeof req.building_type === 'number') {
      const name = buildingTypeToName.get(req.building_type) || `Building Type ${req.building_type}`;
      const tier = req.tier !== undefined ? ` (Tier ${req.tier})` : '';
      return name + tier;
    }
  }
  return 'Any';
}

function getItemTier(recipe: any): string {
  if (recipe.crafted_item_stacks && recipe.crafted_item_stacks.length > 0) {
    const itemId = recipe.crafted_item_stacks[0][0];
    const item = items.find((i: any) => i.id === itemId);
    if (item && item.tier !== undefined && item.tier !== -1) {
      return `Tier ${item.tier}`;
    }
  }
  return 'Unknown';
}

function getItemIconUrl(item: any): string {
  // Use the provided base URL for icons if icon_asset_name is present
  if (item && item.icon_asset_name) {
    // Remove leading slashes if present
    const asset = item.icon_asset_name.replace(/^\/+/, "");
    return `https://bitcraftdex.com/images/${asset}.png`;
  }
  // Fallback: Use a public domain wood log icon or emoji for now
  return 'https://cdn-icons-png.flaticon.com/512/616/616490.png';
}

function getIngredientName(id: number): string {
  // Add more special cases as needed
  if (id === 1001) return 'Unknown Item';
  return itemIdToName.get(id) || `Unknown Item (ID: ${id})`;
}

function formatRecipe(recipe: any) {
  const resultStacks = recipe.crafted_item_stacks?.map((stack: any) => `${itemIdToName.get(stack[0]) || 'ID: ' + stack[0]} x${stack[1]}`).join('\n') || 'Unknown';
  const ingredients = recipe.consumed_item_stacks?.map((stack: any) => `${itemIdToName.get(stack[0]) || 'ID: ' + stack[0]} x${stack[1]}`).join('\n') || 'None';
  const station = getCraftingStationAndTier(recipe);
  const itemTier = getItemTier(recipe);
  return `**Result:**\n${resultStacks}\n\n**Ingredients:**\n${ingredients}\n\n**Crafting Station:** ${station}\n**Item Tier:** ${itemTier}`;
}

function recipeToEmbed(recipe: any): EmbedBuilder {
  const resultStacks = recipe.crafted_item_stacks?.map((stack: any) => {
    const name = getIngredientName(stack[0]);
    return `✨ **${name}** x${stack[1]}`;
  }).join('\n') || 'Unknown';
  const ingredients = recipe.consumed_item_stacks?.map((stack: any) => {
    const name = getIngredientName(stack[0]);
    return `🪵 ${name} x${stack[1]}`;
  }).join('\n') || 'None';
  const station = getCraftingStationAndTier(recipe);
  const itemTier = getItemTier(recipe);
  // Use the first crafted item for icon and description
  let item = null;
  if (recipe.crafted_item_stacks && recipe.crafted_item_stacks.length > 0) {
    item = items.find((i: any) => i.id === recipe.crafted_item_stacks[0][0]);
  }
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`${item ? '🪓 ' : ''}${item ? item.name : 'Crafting Recipe'}`)
    .setDescription(item && item.description && item.description.length > 0 ? item.description : "*No Description*")
    // Add a link to the item page if item and item.id and item.name exist
    .setURL(item && item.id && item.name ? `https://bitcraftdex.com/item/${item.id}/${slugify(item.name)}` : null)
    .addFields(
      { name: '✨ Result', value: resultStacks, inline: false },
      { name: '🧩 Ingredients', value: ingredients, inline: false },
      { name: '🛠️ Crafting Station', value: `**${station}**`, inline: true },
      { name: '⭐ Item Tier', value: `**${itemTier}**`, inline: true }
    );
  if (item) {
    embed.setThumbnail(getItemIconUrl(item));
  }
  return embed;
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except space and hyphen
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // Trim hyphens
}

export const data = {
  name: [/^craft_drill_\d+$/, /^craft_select_\d+$/],
};

export async function execute(interaction: ButtonInteraction) {
  logger.info(`Interaction received: customId=${interaction.customId}`);
  let match = interaction.customId.match(/^craft_drill_(\d+)$/);
  if (!match) {
    match = interaction.customId.match(/^craft_select_(\d+)$/);
  }
  if (!match) {
    logger.error(`Invalid button customId: ${interaction.customId}`);
    await interaction.reply({ content: 'Invalid button.', flags: MessageFlags.Ephemeral });
    return;
  }
  const id = parseInt(match[1]);
  logger.info(`Matched item ID: ${id}`);
  const recipe = findRecipeByOutputId(id);
  if (!recipe) {
    logger.error(`No recipe found for item ID: ${id}`);
    await interaction.reply({ content: 'No recipe found for that item.', flags: MessageFlags.Ephemeral });
    return;
  }
  // Create buttons for each ingredient to drill down
  const buttons = (recipe.consumed_item_stacks || []).map((stack: any) =>
    new ButtonBuilder()
      .setCustomId(`craft_drill_${stack[0]}`)
      .setLabel(`Show recipe for ${itemIdToName.get(stack[0]) || 'ID: ' + stack[0]}`)
      .setStyle(ButtonStyle.Primary)
  );
  const row = buttons.length ? [
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0,5))
  ] : [];
  try {
    await interaction.reply({
      embeds: [recipeToEmbed(recipe)],
      components: row,
      flags: undefined
    });
    logger.info(`Successfully replied with recipe for item ID: ${id}`);
  } catch (error) {
    logger.error(`Failed to reply to interaction for item ID: ${id}`, error);
  }
}

module.exports = { data, execute }; 