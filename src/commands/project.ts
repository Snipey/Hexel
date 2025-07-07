import { ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, MessageFlags, TextChannel, ThreadAutoArchiveDuration, AutocompleteInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Load building data for autocomplete
const buildingsPath = path.join(__dirname, '../data/region/building_type_desc.json');
let buildingTypes: any[] = [];
try {
  const rawBuildings = fs.readFileSync(buildingsPath, 'utf-8');
  buildingTypes = JSON.parse(rawBuildings);
} catch (e) {
  buildingTypes = [];
}

// Load item data for autocomplete
const itemsPath = path.join(__dirname, '../data/region/item_desc.json');
let itemNames: string[] = [];
try {
  const rawItems = fs.readFileSync(itemsPath, 'utf-8');
  const items = JSON.parse(rawItems);
  itemNames = items.map((i: any) => i.name).filter(Boolean);
} catch (e) {
  itemNames = [];
}

// Load crafting recipe data for precursor tracking
const recipesPath = path.join(__dirname, '../data/region/crafting_recipe_desc.json');
let recipes: any[] = [];
try {
  const rawRecipes = fs.readFileSync(recipesPath, 'utf-8');
  recipes = JSON.parse(rawRecipes);
} catch (e) {
  recipes = [];
}

// Helper: Find item by name (case-insensitive)
function findItemByName(name: string) {
  try {
    const rawItems = fs.readFileSync(itemsPath, 'utf-8');
    const items = JSON.parse(rawItems);
    return items.find((i: any) => i.name.toLowerCase() === name.toLowerCase());
  } catch {
    return undefined;
  }
}

// Helper: Find recipe for an item by item id
function findRecipeByItemId(itemId: number) {
  return recipes.find((r: any) => Array.isArray(r.crafted_item_stacks) && r.crafted_item_stacks.some((stack: any) => stack[0] === itemId));
}

// Recursive: Add resource and all precursors
async function addResourceWithPrecursors({ projectId, resource, amount, type, parentId }: { projectId: number, resource: string, amount: number, type?: string | null, parentId?: number | null }) {
  // Add the main resource
  const res = await prisma.resource.create({ data: { projectId, resource, amount, type: type ?? undefined, parentId: parentId ?? undefined, progress: 0 } as any });
  // If it's an item, look up its recipe and add ingredients as children
  const item = findItemByName(resource);
  if (item) {
    const recipe = findRecipeByItemId(item.id);
    if (recipe && Array.isArray(recipe.consumed_item_stacks)) {
      for (const stack of recipe.consumed_item_stacks) {
        const ingredientId = stack[0];
        const ingredientAmount = stack[1];
        // Find ingredient name
        const rawItems = fs.readFileSync(itemsPath, 'utf-8');
        const items = JSON.parse(rawItems);
        const ingredient = items.find((i: any) => i.id === ingredientId);
        if (ingredient) {
          await addResourceWithPrecursors({ projectId, resource: ingredient.name, amount: ingredientAmount, type: 'item', parentId: res.id });
        }
      }
    }
  }
  return res;
}

// Recursive: Mark resource and all children as completed
async function completeResourceAndChildren(resourceId: number) {
  await prisma.resource.update({ where: { id: resourceId }, data: { completed: true } });
  const children = await prisma.resource.findMany({ where: { parentId: resourceId } });
  for (const child of children) {
    await completeResourceAndChildren(child.id);
  }
  await notifySubscribers(resourceId, `Resource **${resource?.resource}** in project **${resource?.project?.name}** has been completed!`);
}

// Remove resource and optionally all children
async function removeResourceAndChildren(resourceId: number, cascade: boolean) {
  if (cascade) {
    const children = await prisma.resource.findMany({ where: { parentId: resourceId } });
    for (const child of children) {
      await removeResourceAndChildren(child.id, true);
    }
  } else {
    // Reparent children to null
    await prisma.resource.updateMany({ where: { parentId: resourceId }, data: { parentId: null } });
  }
  await prisma.resource.delete({ where: { id: resourceId } });
}

// In completeResourceAndChildren, after marking as completed, notify all subscribers via DM
async function notifySubscribers(resourceId: number, message: string) {
  const resource = await prisma.resource.findUnique({ where: { id: resourceId }, include: { project: true, subscriptions: true } });
  if (!resource) return;
  // Project-level subscribers
  const projectSubs = await prisma.subscription.findMany({ where: { projectId: resource.projectId, resourceId: null } });
  // Resource-level subscribers
  const resourceSubs = await prisma.subscription.findMany({ where: { resourceId } });
  const userIds = new Set([...projectSubs, ...resourceSubs].map(s => s.userId));
  for (const userId of userIds) {
    try {
      const user = await globalThis.client?.users?.fetch(userId);
      if (user) await user.send(message);
    } catch {}
  }
}

// Helper: Check if user is a project member
async function isProjectMember(userId: string, projectId: number) {
  const member = await prisma.projectMember.findFirst({ where: { userId, projectId } });
  return !!member;
}

const command = {
  data: new SlashCommandBuilder()
    .setName('project')
    .setDescription('Project resource tracking')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new project and thread')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Project name').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('addresource')
        .setDescription('Add a resource or building to a project')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource or building name').setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('Amount').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('type').setDescription('Type (optional)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('complete')
        .setDescription('Mark a resource (and its sub-resources) as completed')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('listresources')
        .setDescription('List resources for a project')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('completeone')
        .setDescription('Mark a single resource as completed (without affecting sub-resources)')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('editresource')
        .setDescription('Edit a resource (amount/type)')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('New amount').setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('type').setDescription('New type').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('removeresource')
        .setDescription('Remove a resource (and optionally its sub-resources)')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name').setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('cascade').setDescription('Also remove all sub-resources?').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('subscribe')
        .setDescription('Subscribe to a project or resource for notifications')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name (optional)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('unsubscribe')
        .setDescription('Unsubscribe from a project or resource')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name (optional)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('addmember')
        .setDescription('Add a user as a project member')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to add').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('removemember')
        .setDescription('Remove a user from a project')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to remove').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('help')
        .setDescription('Show help and usage for project tracking')
    )
    .addSubcommand(sub =>
      sub.setName('setdeadline')
        .setDescription('Set a deadline for a project')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('deadline').setDescription('Deadline (YYYY-MM-DD or ISO)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('resourcedeadline')
        .setDescription('Set a deadline for a resource')
        .addStringOption(opt =>
          opt.setName('project').setDescription('Project name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('resource').setDescription('Resource name').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('deadline').setDescription('Deadline (YYYY-MM-DD or ISO)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('search')
        .setDescription('Search for projects or resources across all shards')
        .addStringOption(opt =>
          opt.setName('query').setDescription('Project or resource name to search for').setRequired(true)
        )
    ),
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    // Suggest both buildings and items
    const allChoices = [
      ...buildingTypes.map((b: any) => b.name),
      ...itemNames
    ];
    const choices = allChoices.filter((name: string) => name.toLowerCase().includes(focused.toLowerCase()));
    await interaction.respond(choices.slice(0, 25).map((name: string) => ({ name, value: name })));
  },
  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'help') {
      await interaction.reply({
        content:
`**Project Tracking Help**

• /project create name:<name> — Create a new project
• /project addresource project:<name> resource:<item/building> amount:<n> — Add a resource (recursively adds ingredients for items)
• /project listresources project:<name> — Show all resources and their status
• /project complete project:<name> resource:<name> — Mark a resource and all sub-resources as completed
• /project completeone project:<name> resource:<name> — Mark only a single resource as completed
• /project editresource project:<name> resource:<name> [amount:<n>] [type:<type>] — Edit a resource
• /project removeresource project:<name> resource:<name> [cascade:true|false] — Remove a resource (and optionally its sub-resources)

**Tips:**
- Use autocomplete for resource names!
- Use a Forum Channel for best project tracking experience.
- Mark resources as completed as you go!
`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      // Find or create the projects channel (prefer forum)
      let channel = interaction.guild?.channels.cache.find(c => c.name === 'projects' && (c.type === ChannelType.GuildForum || c.type === ChannelType.GuildText));
      if (!channel) {
        // Prefer forum channel
        channel = await interaction.guild?.channels.create({ name: 'projects', type: ChannelType.GuildForum });
      }
      let threadId = '';
      let threadLink = '';
      if (channel && channel.type === ChannelType.GuildForum) {
        // Create a forum post for the project
        const forum = channel;
        const post = await (forum as any).threads.create({
          name,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          message: { content: `Tracking project: **${name}**` },
        });
        threadId = post.id;
        threadLink = `<#${post.id}>`;
      } else if (channel && channel.type === ChannelType.GuildText) {
        // Fallback: create a thread in the text channel
        const textChannel = channel as TextChannel;
        const thread = await textChannel.threads.create({
          name,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          reason: 'Project tracking',
        });
        threadId = thread.id;
        threadLink = `<#${thread.id}>`;
      }
      // Store in DB
      const project = await prisma.project.create({ data: { name, threadId } });
      let suggestion = '';
      if (channel && channel.type === ChannelType.GuildText) {
        suggestion = '\n*Tip: For best project tracking, consider converting #projects to a Forum Channel!*';
      }
      await interaction.reply({ content: `Project created: ${threadLink}${suggestion}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'addresource') {
      const projectName = interaction.options.getString('project', true);
      const resource = interaction.options.getString('resource', true);
      const amount = interaction.options.getInteger('amount', true);
      const type = interaction.options.getString('type', false);
      // Find project
      const project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Check if user is a project member
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to manage resources.', flags: MessageFlags.Ephemeral });
        return;
      }
      // Add resource (with precursors if item)
      await addResourceWithPrecursors({ projectId: project.id, resource, amount, type });
      // Post update in thread/post
      const threadChannel = interaction.guild?.channels.cache.get(project.threadId);
      if (threadChannel && threadChannel.isTextBased()) {
        await threadChannel.send(`Resource added: **${resource}** x${amount}${type ? ` (${type})` : ''}`);
      }
      await interaction.reply({ content: `Resource (and any precursors) added to project.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'complete') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      // Find project
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Check if user is a project member
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to manage resources.', flags: MessageFlags.Ephemeral });
        return;
      }
      // Find resource (case-insensitive, not already completed)
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase() && !r.completed);
      if (!resource) {
        await interaction.reply({ content: `Resource not found. Use /project listresources to see available resources.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await completeResourceAndChildren(resource.id);
      await interaction.reply({ content: `Resource **${resource.resource}** and all sub-resources marked as completed.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'listresources') {
      const projectName = interaction.options.getString('project', true);
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (!project.resources.length) {
        await interaction.reply({ content: `No resources tracked for this project.`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Build a tree of resources
      function buildTree(resources: any[], parentId: number | null = null): any[] {
        return resources.filter((r: any) => (r as any).parentId === parentId).map((r: any) => ({
          ...r,
          children: buildTree(resources, r.id)
        }));
      }
      function renderTree(nodes: any[], depth = 0): string {
        return nodes.map((n: any) => {
          const status = (n as any).completed ? '✅' : '❌';
          const indent = '  '.repeat(depth);
          const progress = n.progress !== undefined ? ` [${n.progress}/${n.amount} ${Math.round((n.progress/n.amount)*100)}%]` : '';
          return `${indent}${status} **${n.resource}** x${n.amount}${n.type ? ` (${n.type})` : ''}${progress}\n${renderTree(n.children, depth + 1)}`;
        }).join('');
      }
      const tree = buildTree(project.resources);
      const list = renderTree(tree);
      await interaction.reply({ content: `Resources for **${project.name}**:\n${list}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'completeone') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Check if user is a project member
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to manage resources.', flags: MessageFlags.Ephemeral });
        return;
      }
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase() && !r.completed);
      if (!resource) {
        await interaction.reply({ content: `Resource not found. Use /project listresources to see available resources.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.resource.update({ where: { id: resource.id }, data: { completed: true } });
      await interaction.reply({ content: `Resource **${resource.resource}** marked as completed.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'editresource') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      const newAmount = interaction.options.getInteger('amount');
      const newType = interaction.options.getString('type');
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Check if user is a project member
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to manage resources.', flags: MessageFlags.Ephemeral });
        return;
      }
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
      if (!resource) {
        await interaction.reply({ content: `Resource not found. Use /project listresources to see available resources.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.resource.update({ where: { id: resource.id }, data: { amount: newAmount ?? resource.amount, type: newType ?? resource.type, progress: Math.min(resource.progress, newAmount ?? resource.amount) } });
      await interaction.reply({ content: `Resource **${resource.resource}** updated. Use /project listresources to check the new status.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'removeresource') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      const cascade = interaction.options.getBoolean('cascade') ?? false;
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found. Use /project create to start a new project!`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Check if user is a project member
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to manage resources.', flags: MessageFlags.Ephemeral });
        return;
      }
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
      if (!resource) {
        await interaction.reply({ content: `Resource not found. Use /project listresources to see available resources.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await removeResourceAndChildren(resource.id, cascade);
      await interaction.reply({ content: `Resource **${resource.resource}**${cascade ? ' and all sub-resources' : ''} removed.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'subscribe') {
      const userId = interaction.user.id;
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource');
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      let resource = null;
      if (resourceName) {
        resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
        if (!resource) {
          await interaction.reply({ content: `Resource not found in project.`, flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await prisma.subscription.upsert({
        where: { userId_projectId_resourceId: { userId, projectId: project.id, resourceId: resource?.id ?? null } },
        update: {},
        create: { userId, projectId: project.id, resourceId: resource?.id },
      });
      await interaction.reply({ content: `Subscribed to ${resource ? `resource **${resource.resource}**` : `project **${project.name}**`}. You will receive DMs for updates!`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'unsubscribe') {
      const userId = interaction.user.id;
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource');
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      let resource = null;
      if (resourceName) {
        resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
        if (!resource) {
          await interaction.reply({ content: `Resource not found in project.`, flags: MessageFlags.Ephemeral });
          return;
        }
      }
      await prisma.subscription.deleteMany({ where: { userId, projectId: project.id, resourceId: resource?.id ?? null } });
      await interaction.reply({ content: `Unsubscribed from ${resource ? `resource **${resource.resource}**` : `project **${project.name}**`}.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'addmember') {
      const projectName = interaction.options.getString('project', true);
      const user = interaction.options.getUser('user', true);
      const project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: project.id } },
        update: {},
        create: { userId: user.id, projectId: project.id },
      });
      await interaction.reply({ content: `Added <@${user.id}> as a member of **${project.name}**.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'removemember') {
      const projectName = interaction.options.getString('project', true);
      const user = interaction.options.getUser('user', true);
      const project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.projectMember.deleteMany({ where: { userId: user.id, projectId: project.id } });
      await interaction.reply({ content: `Removed <@${user.id}> from **${project.name}**.`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'setdeadline') {
      const projectName = interaction.options.getString('project', true);
      const deadlineStr = interaction.options.getString('deadline', true);
      const deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime())) {
        await interaction.reply({ content: 'Invalid deadline format. Use YYYY-MM-DD or ISO.', flags: MessageFlags.Ephemeral });
        return;
      }
      const project = await prisma.project.findFirst({ where: { name: projectName } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.project.update({ where: { id: project.id }, data: { deadline } });
      await interaction.reply({ content: `Deadline set for **${project.name}**: ${deadline.toLocaleString()}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'resourcedeadline') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      const deadlineStr = interaction.options.getString('deadline', true);
      const deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime())) {
        await interaction.reply({ content: 'Invalid deadline format. Use YYYY-MM-DD or ISO.', flags: MessageFlags.Ephemeral });
        return;
      }
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
      if (!resource) {
        await interaction.reply({ content: `Resource not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await prisma.resource.update({ where: { id: resource.id }, data: { deadline } });
      await interaction.reply({ content: `Deadline set for **${resource.resource}**: ${deadline.toLocaleString()}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'search') {
      const query = interaction.options.getString('query', true).toLowerCase();
      // Cross-shard search using broadcastEval
      const results = await interaction.client.shard?.broadcastEval(async (c, { query }) => {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const projects = await prisma.project.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { resources: { some: { resource: { contains: query, mode: 'insensitive' } } } },
            ],
          },
          include: { resources: true },
        });
        // Get guild names for each project (if possible)
        const guilds = c.guilds.cache.map(g => ({ id: g.id, name: g.name }));
        return projects.map(p => ({
          name: p.name,
          resources: p.resources.map(r => r.resource),
          guilds,
        }));
      }, { context: { query } });
      // Aggregate and format results
      const flat = (results || []).flat();
      if (!flat.length) {
        await interaction.reply({ content: 'No projects or resources found matching your query.', flags: MessageFlags.Ephemeral });
        return;
      }
      const lines = flat.map(p => `• **${p.name}** (resources: ${p.resources.join(', ')}) [Guilds: ${p.guilds.map((g: any) => g.name).join(', ')}]`).join('\n');
      await interaction.reply({ content: `Search results for \`${query}\`:\n${lines}`, flags: MessageFlags.Ephemeral });
    } else if (sub === 'summary') {
      const projectName = interaction.options.getString('project', true);
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true, members: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const completed = project.resources.filter(r => r.completed).length;
      const total = project.resources.length;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      const embed = new EmbedBuilder()
        .setTitle(`Project Summary: ${project.name}`)
        .setDescription(`Members: ${project.members.map(m => `<@${m.userId}>`).join(', ') || 'None'}\nResources: ${total}\nCompleted: ${completed}\nProgress: ${percent}%`)
        .setColor(0x3498db)
        .setTimestamp(new Date())
        .addFields(
          { name: 'Deadline', value: project.deadline ? `<t:${Math.floor(new Date(project.deadline).getTime()/1000)}:F>` : 'None', inline: true },
          { name: 'Created', value: `<t:${Math.floor(new Date(project.createdAt).getTime()/1000)}:F>`, inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'export') {
      const projectName = interaction.options.getString('project', true);
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true, members: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      // Generate CSV
      const rows = [
        ['Resource', 'Amount', 'Progress', 'Completed', 'Type', 'Deadline'],
        ...project.resources.map(r => [
          r.resource,
          r.amount,
          r.progress,
          r.completed ? 'Yes' : 'No',
          r.type || '',
          r.deadline ? new Date(r.deadline).toLocaleString() : ''
        ])
      ];
      const csv = rows.map(row => row.map(String).join(',')).join('\n');
      const buffer = Buffer.from(csv, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `${project.name.replace(/[^a-z0-9]/gi, '_')}_export.csv` });
      await interaction.reply({ content: `Export for **${project.name}**:`, files: [attachment], ephemeral: true });
    } else if (sub === 'updateprogress') {
      const projectName = interaction.options.getString('project', true);
      const resourceName = interaction.options.getString('resource', true);
      const progressDelta = interaction.options.getInteger('progress', true);
      const project = await prisma.project.findFirst({ where: { name: projectName }, include: { resources: true } });
      if (!project) {
        await interaction.reply({ content: `Project not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      if (!(await isProjectMember(interaction.user.id, project.id))) {
        await interaction.reply({ content: 'You must be a project member to update progress.', flags: MessageFlags.Ephemeral });
        return;
      }
      const resource = project.resources.find(r => r.resource.toLowerCase() === resourceName.toLowerCase());
      if (!resource) {
        await interaction.reply({ content: `Resource not found.`, flags: MessageFlags.Ephemeral });
        return;
      }
      const newProgress = Math.min((resource.progress ?? 0) + progressDelta, resource.amount);
      const completed = newProgress >= resource.amount;
      await prisma.resource.update({ where: { id: resource.id }, data: { progress: newProgress, completed } });
      await interaction.reply({ content: `Progress updated: **${resource.resource}** is now ${newProgress}/${resource.amount}${completed ? ' (Completed!)' : ''}`, flags: MessageFlags.Ephemeral });
    }
  },
};

export default command; 