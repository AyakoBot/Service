import * as Discord from 'discord.js';

export default async (msg: Discord.AutoModerationActionExecution) => {
 const presetLength = Number(msg.autoModerationRule?.triggerMetadata.presets.length);

 if (!msg.autoModerationRule?.triggerMetadata.presets[0]) return;
 if (presetLength !== 1) return;
 if (!msg.matchedKeyword) return;

 msg.guild.client.util.DataBase.filterscraper
  .upsert({
   where: {
    keyword_filtertype: {
     keyword: msg.matchedKeyword,
     filtertype: msg.autoModerationRule?.triggerMetadata.presets[0],
    },
   },
   update: {},
   create: {
    keyword: msg.matchedKeyword,
    filtertype: msg.autoModerationRule?.triggerMetadata.presets[0],
   },
  })
  .then();
};
