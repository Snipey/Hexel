import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

// Load crafting recipes, item data, and building types once at startup
const recipesPath = path.join(__dirname, '../data/region/crafting_recipe_desc.json');
const itemsPath = path.join(__dirname, '../data/region/item_desc.json');
const buildingsPath = path.join(__dirname, '../data/region/building_type_desc.json');
let recipes: any[] = [];
let items: any[] = [];
let buildings: any[] = [];
let itemIdToName = new Map<number, string>();
let nameToItemIds = new Map<string, number[]>();
let buildingTypeToName = new Map<number, string>();
try {
  const rawRecipes = fs.readFileSync(recipesPath, 'utf8');
  recipes = JSON.parse(rawRecipes);
  const rawItems = fs.readFileSync(itemsPath, 'utf8');
  items = JSON.parse(rawItems);
  for (const item of items) {
    itemIdToName.set(item.id, item.name);
    const lower = item.name.toLowerCase();
    if (!nameToItemIds.has(lower)) nameToItemIds.set(lower, []);
    nameToItemIds.get(lower)!.push(item.id);
  }
  const rawBuildings = fs.readFileSync(buildingsPath, 'utf8');
  buildings = JSON.parse(rawBuildings);
  for (const building of buildings) {
    buildingTypeToName.set(building.id, building.name);
  }
} catch (e) {
  console.error('Failed to load crafting recipes, items, or buildings:', e);
}

export const data = new SlashCommandBuilder()
  .setName('craft')
  .setDescription('Show crafting recipe for an item')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Item name fragment or item ID')
      .setRequired(true)
  );

function getItemIconUrl(item: any): string {
  // Placeholder: Use a public domain wood log icon or emoji for now
  // Replace this with a real CDN or static URL if you have the icons
  if (!item) return 'https://cdn-icons-png.flaticon.com/512/616/616490.png'; // Example log icon
  // If you ever host icons, you could do something like:
  // return `https://yourcdn.com/icons/${item.icon_asset_name}.png`;
  return 'https://cdn-icons-png.flaticon.com/512/616/616490.png';
}

function findItemIdsByQuery(query: string): number[] {
  const id = parseInt(query);
  if (!isNaN(id) && itemIdToName.has(id)) return [id];
  const lower = query.toLowerCase();
  // Exact match
  if (nameToItemIds.has(lower)) return nameToItemIds.get(lower)!;
  // Special: If query is 'wood log', match all variants
  if (lower === 'wood log') {
    const matches: number[] = [];
    for (const [name, ids] of nameToItemIds.entries()) {
      if (name.includes('wood log')) matches.push(...ids);
    }
    return matches;
  }
  // Partial match
  const matches: number[] = [];
  for (const [name, ids] of nameToItemIds.entries()) {
    if (name.includes(lower)) matches.push(...ids);
  }
  return matches;
}

function findRecipesByOutputItemIds(itemIds: number[]) {
  return recipes.filter(recipe =>
    recipe.crafted_item_stacks && recipe.crafted_item_stacks.some((stack: any) => itemIds.includes(stack[0]))
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
  // Use the first crafted item stack to get the item tier
  if (recipe.crafted_item_stacks && recipe.crafted_item_stacks.length > 0) {
    const itemId = recipe.crafted_item_stacks[0][0];
    const item = items.find((i: any) => i.id === itemId);
    if (item && item.tier !== undefined && item.tier !== -1) {
      return `Tier ${item.tier}`;
    }
  }
  return 'Unknown';
}

function getIngredientName(id: number): string {
  // Add more special cases as needed
  if (id === 1001) return 'Unknown Item';
  return itemIdToName.get(id) || `Unknown Item (ID: ${id})`;
}

function recipeToEmbed(recipe: any): EmbedBuilder {
  const resultStacks = recipe.crafted_item_stacks?.map((stack: any) => {
    const name = getIngredientName(stack[0]);
    return `**${name}** x${stack[1]}`;
  }).join('\n') || 'Unknown';
  const ingredients = recipe.consumed_item_stacks?.map((stack: any) => {
    const name = getIngredientName(stack[0]);
    return `• ${name} x${stack[1]}`;
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
    .setTitle(item ? item.name : 'Crafting Recipe')
    .setDescription(item && item.description ? item.description : undefined)
    .addFields(
      { name: 'Result', value: resultStacks, inline: false },
      { name: 'Ingredients', value: ingredients, inline: false },
      { name: 'Crafting Station', value: station, inline: true },
      { name: 'Item Tier', value: itemTier, inline: true }
    );
  if (item) {
    embed.setThumbnail(getItemIconUrl(item));
  }
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  const itemIds = findItemIdsByQuery(query);
  if (itemIds.length === 0) {
    await interaction.reply({ content: 'No item found matching that query.', flags: MessageFlags.Ephemeral });
    return;
  }
  const matches = findRecipesByOutputItemIds(itemIds);
  if (matches.length === 0) {
    await interaction.reply({ content: 'No recipe found for that item.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (matches.length === 1) {
    const recipe = matches[0];
    // Create buttons for each ingredient to drill down
    const buttons = (recipe.consumed_item_stacks || []).map((stack: any) =>
      new ButtonBuilder()
        .setCustomId(`craft_drill_${stack[0]}`)
        .setLabel(`Show recipe for ${itemIdToName.get(stack[0]) || 'ID: ' + stack[0]}`)
        .setStyle(ButtonStyle.Primary)
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0,5));
    await interaction.reply({
      embeds: [recipeToEmbed(recipe)],
      components: buttons.length ? [row] : [],
      flags: undefined
    });
    return;
  }
  // Multiple matches: suggest options
  const suggestionButtons = matches.slice(0,5).map((recipe: any) => {
    const firstResult = recipe.crafted_item_stacks?.[0];
    const id = firstResult ? firstResult[0] : 'unknown';
    return new ButtonBuilder()
      .setCustomId(`craft_select_${id}`)
      .setLabel(`${itemIdToName.get(id) || 'ID: ' + id}`)
      .setStyle(ButtonStyle.Secondary);
  });
  const suggestionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...suggestionButtons);
  await interaction.reply({
    content: `Multiple items found for "${query}". Please select the correct one:`,
    components: [suggestionRow],
    flags: MessageFlags.Ephemeral
  });
}

module.exports = { data, execute }; 