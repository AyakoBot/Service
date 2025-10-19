import metricsCollector from '../../../../BaseClient/Metrics.js';
import client from '../../../../BaseClient/Client.js';

type ReturnType = Promise<number[] | undefined>;

let run = 0;

export default async () => {
 run += 1;
 if (process.argv.includes('--dev')) return;
 if (run % 30 !== 0) return;

 const [
  emoteCount,
  userCount,
  allUsers,
  roleCount,
  channelCount,
  guildCount,
  stickerCount,
  userInstalls,
 ] = (
  await Promise.all([
   client.cluster?.fetchClientValues('emojis?.cache.size') as ReturnType,
   client.cluster?.fetchClientValues('users?.cache.size') as ReturnType,
   client.cluster?.broadcastEval((c) =>
    c.guilds?.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
   ) as ReturnType,
   client.cluster?.broadcastEval((c) =>
    c.guilds?.cache.reduce((acc, guild) => acc + Number(guild.roles?.cache.size), 0),
   ) as ReturnType,
   client.cluster?.broadcastEval((c) =>
    c.guilds?.cache.reduce((acc, guild) => acc + Number(guild.channels?.cache.size), 0),
   ) as ReturnType,
   client.cluster?.fetchClientValues('guilds?.cache.size') as ReturnType,
   client.cluster?.broadcastEval((c) =>
    c.guilds?.cache.reduce((acc, guild) => acc + Number(guild.stickers?.cache.size), 0),
   ) as ReturnType,
   client.util.request.applications
    .getCurrent(undefined)
    .then((r) => ('message' in r ? [0] : [r.approximate_user_install_count ?? 0])),
  ])
 ).map((v) => (v ?? []).reduce((acc, count) => acc + count, 0));

 const shardList = (client.util.files.sharding.getInfo().SHARD_LIST?.flat() ?? [1]).length;

 metricsCollector.guildCount(guildCount);
 metricsCollector.userInstallCount(userInstalls);
 metricsCollector.userCount(allUsers);
 metricsCollector.emojiCount(emoteCount);
 metricsCollector.roleCount(roleCount);
 metricsCollector.channelCount(channelCount);
 metricsCollector.stickerCount(stickerCount);
 metricsCollector.clusterCount(client.util.files.sharding.getInfo().CLUSTER_COUNT ?? 1);
 metricsCollector.shardCount(shardList);

 client.util.DataBase.stats
  .create({
   data: {
    userCount,
    guildCount,
    channelCount,
    roleCount,
    allUsers,
    emoteCount,
    stickerCount,
    userInstalls,
    clusterCount: client.util.files.sharding.getInfo().CLUSTER_COUNT ?? 1,
    shardCount: shardList,
    timestamp: Date.now(),
   },
  })
  .then();
};
