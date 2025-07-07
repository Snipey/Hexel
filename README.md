# Bitcraft Discord Bot

A feature-rich, extensible Discord bot for Bitcraft communities, written in TypeScript using discord.js, Prisma, and SQLite. Supports advanced project/resource tracking with recursive item dependencies, building tracking, and a modern command UX.

---

## Features
- **Slash Commands** for crafting info, pings, and project/resource tracking
- **Project Tracking**: Track buildings, items, and any resource for collaborative projects
- **Recursive Dependencies**: Automatically track all precursor items for crafted resources
- **Forum Channel Support**: Uses Discord forum channels for best project management (with fallback to text channels)
- **Persistent Storage**: Uses Prisma ORM and SQLite for robust, type-safe data storage
- **Autocomplete**: Fast, user-friendly autocomplete for items and buildings
- **Modern UX**: Friendly error messages, help command, and clear status reporting

---

## Setup

### 1. Clone & Install
```sh
pnpm install
```

### 2. Environment Variables
Create a `.env` file in the project root:
```
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
DATABASE_URL=file:./projects.sqlite
```

### 3. Prisma Setup
```sh
npx prisma migrate deploy
npx prisma generate
```

### 4. Run the Bot
```sh
pnpm run dev           # For development (single process)
pnpm run shard         # For production with sharding
```

---

## Permissions
When inviting the bot, use these OAuth2 scopes and permissions:
- **Scopes:** `bot`, `applications.commands`
- **Bot Permissions:**
  - Manage Channels (for project channel/thread creation)
  - Send Messages, Embed Links, Read Message History
  - Use Slash Commands, View Channels

---

## Usage

### **Project Tracking**
- `/project help` — Show all project tracking commands and tips
- `/project create name:<name>` — Create a new project (forum post or thread)
- `/project addresource project:<name> resource:<item/building> amount:<n>` — Add a resource (recursively adds ingredients for items)
- `/project listresources project:<name>` — Show all resources and their status
- `/project complete project:<name> resource:<name>` — Mark a resource and all sub-resources as completed
- `/project completeone project:<name> resource:<name>` — Mark only a single resource as completed
- `/project editresource project:<name> resource:<name> [amount:<n>] [type:<type>]` — Edit a resource
- `/project removeresource project:<name> resource:<name> [cascade:true|false]` — Remove a resource (and optionally its sub-resources)

### **Crafting Info**
- `/craft <item>` — Show crafting recipe, drill down on ingredients, and see item icons

---

## Data
- Place your Bitcraft data files in `src/data/region/` (e.g., `item_desc.json`, `building_type_desc.json`, `crafting_recipe_desc.json`)

---

## Contributing
- Fork and clone the repo
- Use TypeScript and follow the existing code style
- Add new commands in `src/commands/`, interactions in `src/interactions/`, and utilities in `src/utils/`
- Run `pnpm run dev` for development
- Use `prisma/schema.prisma` to update the database schema

---

## License
MIT 