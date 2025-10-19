import { StoredPunishmentTypes, type punishments } from '@prisma/client';
import * as Discord from 'discord.js';
import type { languages } from '../../../BaseClient/Other/language.js';
import client from '../../../BaseClient/Client.js';
import * as CT from '../../../Typings/Typings.js';

export const keys: Record<
 keyof (typeof languages)['en-GB']['slashCommands']['check']['punishmentTypes'],
 StoredPunishmentTypes[]
> = {
 warn: [StoredPunishmentTypes.warn],
 ban: [StoredPunishmentTypes.ban, StoredPunishmentTypes.tempban],
 mute: [StoredPunishmentTypes.mute, StoredPunishmentTypes.tempmute],
 channelban: [StoredPunishmentTypes.channelban, StoredPunishmentTypes.tempchannelban],
 kick: [StoredPunishmentTypes.kick],
 voiceD: [StoredPunishmentTypes.vcdeaf, StoredPunishmentTypes.vctempdeaf],
 voiceM: [StoredPunishmentTypes.vcmute, StoredPunishmentTypes.vctempmute],
};

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 const userRes = await client.util.getUserFromUserAndUsernameOptions(cmd);
 if (!userRes) return;

 const { user, language, member } = userRes;
 client.util.replyCmd(cmd, await getPayload({ user, guild: cmd.guild, language, member }));
};

export const getPayload = async (
 baseInfo: {
  user: RUser;
  guild: Discord.Guild;
  language?: CT.Language;
  member?: RMember;
 },
 selected: {
  type?: keyof typeof keys;
  page: number;
  values: number[];
 } = { page: 1, values: [] },
): Promise<Discord.InteractionReplyOptions> => {
 const language = baseInfo.language ?? (await client.util.getLanguage(baseInfo.guild.id));
 const lan = language.slashCommands.check;
 const allPunishments = await client.util.getPunishment(baseInfo.user.id, {
  identType: 'all-on',
  includeTemp: true,
  guildid: baseInfo.guild.id,
 });

 const ban = await client.util.request.guilds.getMemberBan(baseInfo.guild, baseInfo.user.id);

 const punishedOpts = {
  isBanned: !('message' in ban),
  isMuted: !!baseInfo.member?.isCommunicationDisabled(),
  isChannelBanned: !!baseInfo.guild.channels.cache.find((c) => {
   const perms = c.permissionsFor(baseInfo.user.id)?.serialize();

   if (!perms) return false;
   if (perms.ViewChannel) return false;
   if (perms.SendMessages) return false;
   if (perms.Connect) return false;
   if (perms.SendMessagesInThreads) return false;
   if (perms.AddReactions) return false;
   return true;
  }),
 };

 const punishmentsOfType = allPunishments?.filter((p) =>
  (selected.type ? keys[selected.type] : []).includes(p.type),
 );

 if (selected.page < 1) selected.page = 1;
 if (selected.page > Math.ceil(Number(punishmentsOfType?.length) / 25)) {
  selected.page = Math.ceil(Number(punishmentsOfType?.length) / 25);
 }

 const punishmentsOfPage = punishmentsOfType?.slice(25 * selected.page - 25, 25 * selected.page);

 const componentChunks: Discord.APIButtonComponentWithCustomId[][] = client.util.getChunks(
  Object.entries(lan.punishmentTypes).map(([key, value]) => ({
   label: value,
   custom_id: `mod/check/type_${key}_${baseInfo.user.id}`,
   type: Discord.ComponentType.Button,
   style: selected.type === key ? Discord.ButtonStyle.Primary : Discord.ButtonStyle.Secondary,
   disabled: !allPunishments?.filter((p) => keys[key as keyof typeof keys].includes(p.type)).length,
  })),
  5,
 );

 return {
  embeds: [
   {
    color: client.util.getColor(await client.util.getBotMemberFromGuild(baseInfo.guild)),
    author: { name: lan.name },
    description: lan.desc(
     baseInfo.user,
     {
      w: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.warn).length ?? 0,
      m: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.mute).length ?? 0,
      cb: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.channelban).length ?? 0,
      b: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.ban).length ?? 0,
      vcD: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.vcdeaf).length ?? 0,
      vcM: allPunishments?.filter((p) => p.type === StoredPunishmentTypes.vcmute).length ?? 0,
      r: allPunishments?.filter((p) => p.type.includes('temp')).length ?? 0,
     },
     punishedOpts,
     {
      banEmote:
       client.util.constants.standard.getEmote(
        punishedOpts.isBanned ? client.util.emotes.banTick : client.util.emotes.banCross,
       ) ?? '❌',
      muteEmote:
       client.util.constants.standard.getEmote(
        punishedOpts.isMuted ? client.util.emotes.timedoutTick : client.util.emotes.timedoutCross,
       ) ?? '❌',
      channelbanEmote:
       client.util.constants.standard.getEmote(
        punishedOpts.isChannelBanned ? client.util.emotes.mutedTick : client.util.emotes.mutedCross,
       ) ?? '❌',
     },
    ),
   },
   ...selected.values
    .map((v) => punishmentsOfType?.find((p) => Number(p.uniquetimestamp) === v))
    .filter((p): p is punishments => !!p)
    .map(
     (p): Discord.APIEmbed => ({
      color: CT.Colors.Ephemeral,
      description: `${client.util.util.makeUnderlined(language.t.Reason)}:\n${p.reason}`,
      fields: [
       {
        name: lan.date,
        value: client.util.constants.standard.getTime(Number(p.uniquetimestamp)),
        inline: true,
       },
       {
        name: lan.executor,
        value: language.languageFunction.getUser({
         bot: false,
         username: p.executorname,
         id: p.executorid,
         discriminator: '0',
        }),
        inline: true,
       },
       {
        name: lan.channel,
        value: language.languageFunction.getChannel({ name: p.channelname, id: p.channelid }),
        inline: true,
       },
       {
        name: lan.id,
        value: `${client.util.util.makeInlineCode(Number(p.uniquetimestamp).toString(36))}${
         p.type.includes('temp') ? `\n${lan.cantPardon}` : ''
        }`,
        inline: true,
       },
       ...('duration' in p && p.duration
        ? [
           {
            name: lan.duration,
            value: client.util.moment(Number(p.duration) * 1000, language),
            inline: true,
           },
           {
            name: lan.endDate,
            value: client.util.constants.standard.getTime(
             Number(p.uniquetimestamp) + Number(p.duration) * 1000,
            ),
            inline: true,
           },
          ]
        : []),
       ...('context' in p && p.context
        ? [
           {
            name: lan.banChannel,
            value: `<#${p.context}> / ${client.util.util.makeInlineCode(p.context)}`,
            inline: true,
           },
          ]
        : []),
       {
        name: lan.message,
        value: client.util.constants.standard.msgurl(p.guildid, p.channelid, p.msgid),
        inline: true,
       },
      ],
     }),
    ),
  ],
  components: [
   ...componentChunks.map(
    (c) =>
     ({
      type: Discord.ComponentType.ActionRow,
      components: c,
     }) as Discord.APIActionRowComponent<Discord.APIButtonComponentWithCustomId>,
   ),
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      type: Discord.ComponentType.StringSelect,
      placeholder: lan.placeholder,
      max_values:
       Number(punishmentsOfPage?.length) > 9 ? 9 : Number(punishmentsOfPage?.length) || 1,
      min_values: 1,
      disabled: !punishmentsOfPage?.length,
      custom_id: `check_${baseInfo.user.id}_${selected.page}${
       selected.type ? `_${selected.type}` : ''
      }`,
      options: punishmentsOfPage?.length
       ? punishmentsOfPage.slice(0, 25).map((p) => ({
          label: `ID: ${Number(p.uniquetimestamp).toString(36)} | ${
           baseInfo.language?.slashCommands.pardon.executor
          }: ${p.executorname}`,
          description: p.reason?.slice(0, 100),
          value: String(p.uniquetimestamp),
          default: selected.values.includes(Number(p.uniquetimestamp)),
         }))
       : [{ label: '-', value: '-' }],
     },
    ],
   },
   {
    type: Discord.ComponentType.ActionRow,
    components: [
     {
      emoji: client.util.emotes.back,
      custom_id: `mod/check/page_${selected.type}_${baseInfo.user.id}_back_${selected.page}`,
      type: Discord.ComponentType.Button,
      style: Discord.ButtonStyle.Secondary,
      disabled: selected.page === 1 || !selected.type,
     },
     {
      type: Discord.ComponentType.Button,
      style: Discord.ButtonStyle.Secondary,
      label: `${selected.page}/${Math.ceil(Number(punishmentsOfType?.length) / 25) || 1}`,
      disabled: Number(punishmentsOfType?.length) <= 25 || !selected.type,
      custom_id: `mod/check/select_${selected.type}_${baseInfo.user.id}_${selected.page}_${
       Number(punishmentsOfType?.length) / 25
      }`,
     },
     {
      emoji: client.util.emotes.forth,
      custom_id: `mod/check/page_${selected.type}_${baseInfo.user.id}_forth_${selected.page}`,
      type: Discord.ComponentType.Button,
      style: Discord.ButtonStyle.Secondary,
      disabled:
       Math.ceil(Number(punishmentsOfType?.length) / 25) === selected.page || !selected.type,
     },
    ],
   },
  ],
 };
};
