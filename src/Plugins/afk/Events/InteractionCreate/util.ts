import { FilterType, type AfkState } from '@ayako/database';
import { AutoModerationActionType, AutoModerationRuleEventType } from '@discordjs/core';

import { filtered_content as filterContent } from '../../../../../rust/rust.js';
import getUser from '../../../../Util/getUser.js';
import type AFKPlugin from '../../Plugin.js';

export const getCensoredContent = async function (
 this: AFKPlugin,
 guildId: string,
 rawContent: string,
 channelId: string,
 roleIds: string[],
) {
 const autoModerationRules = await this.client.cache.automods.getAll(guildId);
 const channel = await this.client.cache.channels.get(channelId);
 const guild = await this.client.cache.guilds.get(guildId);
 const rulesChannel = guild?.rules_channel_id
  ? await this.client.cache.channels.get(guild.rules_channel_id)
  : null;

 const rules = autoModerationRules
  .filter((r) => r.event_type === AutoModerationRuleEventType.MessageSend)
  .filter((r) => {
   if (!r.exempt_channels.length) return true;

   const includesChannel = r.exempt_channels.includes(channelId);
   if (includesChannel) return false;

   const includesParent = channel?.parent_id
    ? r.exempt_channels.includes(channel.parent_id)
    : false;
   if (includesParent) return false;

   if (
    !channel &&
    (r.exempt_channels.includes(guild?.rules_channel_id ?? '') ||
     r.exempt_channels.includes(rulesChannel?.parent_id ?? ''))
   ) {
    return false;
   }
   return true;
  })
  .filter((r) => {
   if (!r.exempt_roles.length) return true;

   const includesRole = roleIds.length
    ? roleIds.some((role) => r.exempt_roles.includes(role))
    : false;

   if (includesRole) return false;
   if (r.exempt_roles.includes(guildId)) return false;
   return true;
  });

 if (!rules.length) return rawContent;

 const presetRule = rules.find(
  (r) =>
   r.trigger_metadata.presets?.length &&
   r.enabled &&
   r.actions.find((a) => a.type === AutoModerationActionType.BlockMessage),
 );

 const presetKeywords = presetRule
  ? await this.client.db.client.filteredWord.findMany({
     where: {
      filterType: {
       in: [
        ...(presetRule.trigger_metadata.presets
         ? (presetRule.trigger_metadata.presets.map(
            (key) => Object.keys(FilterType)[key],
           ) as FilterType[])
         : []),
       ],
      },
     },
    })
  : [];

 let content = String(rawContent);

 presetKeywords?.forEach((p) => {
  content = content.replace(new RegExp(p.keyword, 'g'), '[...]');
 });

 rules.forEach((r) => {
  if (!r.enabled) return;

  if (r.trigger_metadata.regex_patterns?.length) {
   content = filterContent([...r.trigger_metadata.regex_patterns], content);
  }

  content
   .match(
    new RegExp(
     (r.trigger_metadata.keyword_filter || [])
      .map((k) =>
       k
        .replace(/\s*\*\s*/g, '*')
        .replace(/(?!^)\*(?!$)/gm, '*{1}')
        .replace(/[\\\\.\\+\\?\\^\\$\\[\]\\(\\)\\{\\}\\/\\'\\#\\:\\!\\=\\|]/gi, '\\$&'),
      )
      .map((k) => (k.startsWith('*') ? `\\w*${k.slice(1, k.length)}` : `(\\s|^)${k}`))
      .map((k) => (k.endsWith('*') ? `${k.slice(0, k.length - 1)}\\w*` : `${k}(\\s|$)`))
      .map(
       (k) =>
        `(${k.startsWith('(\\s|^)') ? '' : '\\w*'}${k}${k.endsWith('(\\s|$)') ? '' : '\\w*'})`,
      )
      .join('|'),
     'gi',
    ),
   )
   ?.filter((m) => m.length)
   ?.map((m) => m.trim())
   ?.forEach((m) => {
    if ((r.trigger_metadata.allow_list || []).includes(m)) return;
    content = content.replace(new RegExp(m, 'g'), '[...]');
   });
 });

 return content;
};

export const setNick = async function (this: AFKPlugin, userId: string, guildId: string) {
 const member = await this.client.cache.members.get(guildId, userId);
 if (!member) return undefined;

 const user = member.nick
  ? { username: '', global_name: '' }
  : await getUser.call(this.client, userId);
 if (!user) return undefined;

 this.client.api.guilds.editMember(guildId, userId, {
  nick: member.nick ? `${member.nick} [AFK]` : `${user.global_name || user.username} [AFK]`,
 });
};

export const getContent = async function (
 this: AFKPlugin,
 guildId: string,
 afk: AfkState | null,
 userId: string,
) {
 const t = await this.t(guildId);

 if (!afk) return t.t.set({ user: await this.client.cache.users.get(userId) });
 return t.t.updated({ user: await this.client.cache.users.get(userId) });
};
