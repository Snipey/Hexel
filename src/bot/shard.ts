import { ShardingManager } from 'discord.js';
import path from 'path';
import 'dotenv/config';

const manager = new ShardingManager(path.join(__dirname, '../index.js'), {
  token: process.env.BOT_TOKEN,
  totalShards: 'auto',
  respawn: true,
});

manager.on('shardCreate', shard => {
  console.log(`[ShardManager] Launched shard ${shard.id}`);

  // Listen for messages from shards (IPC)
  shard.on('message', message => {
    if (message && message._type === 'SHARD_STATS') {
      console.log(`[ShardManager] Stats from shard ${shard.id}:`, message.data);
    }
  });
});

// Example: BroadcastEval to get stats from all shards
async function getAllShardStats() {
  const results = await manager.broadcastEval(async (client) => {
    return {
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      shardId: client.shard?.ids[0] ?? 0,
    };
  });
  console.log('[ShardManager] All shard stats:', results);
}

// Call getAllShardStats after all shards are spawned
manager.spawn().then(() => {
  setTimeout(getAllShardStats, 5000); // Wait a bit for shards to be ready
}); 