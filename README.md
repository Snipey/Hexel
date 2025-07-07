# Bitcraft Discord Bot

A Discord bot for Bitcraft communities, written in TypeScript using discord.js. Provides crafting information and basic bot functionality.

---

## Features
- **Slash Commands** for crafting info and basic bot operations
- **Crafting Information**: Show crafting recipes, drill down on ingredients, and see item icons
- **Modern UX**: Friendly error messages and clear status reporting

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
```

### 3. Run the Bot
```sh
pnpm run dev           # For development (single process)
pnpm run shard         # For production with sharding
```

---

## Permissions
When inviting the bot, use these OAuth2 scopes and permissions:
- **Scopes:** `bot`, `applications.commands`
- **Bot Permissions:**
  - Send Messages, Embed Links, Read Message History
  - Use Slash Commands, View Channels

---

## Usage

### **Crafting Info**
- `/craft <item>` — Show crafting recipe, drill down on ingredients, and see item icons

### **Basic Commands**
- `/ping` — Check bot latency and status

---

## Data
- Place your Bitcraft data files in `src/data/region/` (e.g., `item_desc.json`, `building_type_desc.json`, `crafting_recipe_desc.json`)

---

## Contributing
- Fork and clone the repo
- Use TypeScript and follow the existing code style
- Add new commands in `src/commands/`, interactions in `src/interactions/`, and utilities in `src/utils/`
- Run `pnpm run dev` for development

---

## License
MIT 