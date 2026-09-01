import { FilterType } from '@ayako/database';
import { AutoModerationActionType, AutoModerationRuleEventType } from '@discordjs/core';

import { filtered_content as filterContent } from '../../rust/rust.js';
import type Client from '../Classes/Client.js';

const getApplicableRules = async function (
 this: { client: Client },
 guildId: string,
 channelId: string,
 roleIds: string[],
) {
 const autoModerationRules = await this.client.cache.automods.getAll(guildId);
 const channel = await this.client.cache.channels.get(channelId);
 const guild = await this.client.cache.guilds.get(guildId);
 const rulesChannel = guild?.rules_channel_id
  ? await this.client.cache.channels.get(guild.rules_channel_id)
  : null;

 return autoModerationRules
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
};

type ApplicableRule = Awaited<ReturnType<typeof getApplicableRules>>[number];

const applyPresetKeywords = async function (
 this: { client: Client },
 input: string,
 rules: ApplicableRule[],
) {
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
            (key) => ['Unknown', ...Object.keys(FilterType)][key],
           ) as FilterType[])
         : []),
       ],
      },
     },
    })
  : [];

 let content = input;

 presetKeywords?.forEach((p) => {
  content = content.replace(new RegExp(p.keyword, 'g'), '[...]');
 });

 return content;
};

const applyRules = (input: string, rules: ApplicableRule[]): string => {
 let content = input;

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

export const getCensoredContent = async function (
 this: { client: Client },
 guildId: string,
 rawContent: string,
 channelId: string,
 roleIds: string[],
) {
 const rules = await getApplicableRules.call(this, guildId, channelId, roleIds);
 if (!rules.length) return rawContent;

 const content = await applyPresetKeywords.call(this, String(rawContent), rules);
 return applyRules(content, rules);
};
