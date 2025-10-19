import type * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (oldStage: Discord.StageInstance, stage: Discord.StageInstance) => {
 if (!stage.guild) return;
 if (!stage.channel) return;

 const channels = await stage.client.util.getLogChannels('stageevents', stage.guild);
 if (!channels) return;

 const language = await stage.client.util.getLanguage(stage.guild.id);
 const lan = language.events.logs.channel;
 const con = stage.client.util.constants.events.logs.channel;
 const audit = await stage.client.util.getAudit(stage.guild, 84, stage.id);
 const auditUser = audit?.executor ?? undefined;
 const files: Discord.AttachmentPayload[] = [];

 const embed: Discord.APIEmbed = {
  author: {
   name: lan.nameStageUpdate,
   icon_url: con.StageUpdate,
  },
  color: CT.Colors.Loading,
  description: auditUser
   ? lan.descUpdateStageAudit(stage.channel, language.channelTypes[stage.channel.type], auditUser)
   : lan.descUpdateStage(stage.channel, language.channelTypes[stage.channel.type]),
  fields: [],
  timestamp: new Date().toISOString(),
 };

 const merge = (before: unknown, after: unknown, type: CT.AcceptedMergingTypes, name: string) =>
  stage.client.util.mergeLogging(before, after, type, embed, language, name);

 if (oldStage.guildScheduledEventId !== stage.guildScheduledEventId) {
  merge(
   oldStage.guildScheduledEvent
    ? language.languageFunction.getScheduledEvent(oldStage.guildScheduledEvent)
    : language.t.None,
   stage.guildScheduledEvent
    ? language.languageFunction.getScheduledEvent(stage.guildScheduledEvent)
    : language.t.None,
   'string',
   language.t.ScheduledEvent,
  );
 }
 if (oldStage.topic !== stage.topic) {
  merge(oldStage.topic, stage.topic, 'string', lan.topic);
 }
 if (oldStage.channelId !== stage.channelId) {
  merge(
   oldStage.channel
    ? language.languageFunction.getChannel(
       oldStage.channel,
       language.channelTypes[oldStage.channel.type],
      )
    : language.t.Unknown,
   stage.channel
    ? language.languageFunction.getChannel(stage.channel, language.channelTypes[stage.channel.type])
    : language.t.Unknown,
   'string',
   language.t.Channel,
  );
 }

 stage.client.util.send(
  { id: channels, guildId: stage.guild.id },
  { embeds: [embed], files },
  10000,
 );
};
