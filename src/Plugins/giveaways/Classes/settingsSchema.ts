import { PresenceActivityType, type GiveawaySetting } from '@ayako/database';
import { ChannelType } from 'discord-api-types/v10';

import { EmoteName } from '../../../Classes/EmoteName.js';
import { parseColor } from '../../../Util/parseColor.js';
import { EditorType } from '../../settings/EditorType.js';
import {
 FieldArity,
 type FieldTransform,
 type SettingsSchemaDef,
} from '../../settings/SettingsSchema.js';
import { minCollectMs } from '../constants.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type GiveawaysPlugin from '../Plugin.js';
import type { GiveawaysTranslator } from '../Plugin.js';
import {
 BotProfilePart,
 giveawayBotTokenTransform,
 giveawayPresenceEmojiTransform,
 giveawayProfileImageTransform,
 giveawayProfileVirtual,
} from '../Util/botToken.js';

export enum GiveawaySettingsGroup {
 Defaults = 'defaults',
 Appearance = 'appearance',
 Notifications = 'notifications',
 Activity = 'activity',
 Bot = 'bot',
 Presence = 'presence',
 Profile = 'profile',
}

type GiveawayVirtualColumns = {
 profileNick: string | null;
 profileAvatar: string | null;
 profileBanner: string | null;
 profileBio: string | null;
};

type Row = GiveawaySetting & GiveawayVirtualColumns;

const logChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

const messageChannelTypes = [
 ChannelType.GuildText,
 ChannelType.GuildAnnouncement,
 ChannelType.GuildForum,
 ChannelType.GuildCategory,
];

const voiceChannelTypes = [
 ChannelType.GuildVoice,
 ChannelType.GuildStageVoice,
 ChannelType.GuildCategory,
];

export const claimFloorTransform: FieldTransform = async (value) => {
 const seconds = Number(value);
 if (!Number.isFinite(seconds) || seconds <= 0) return { value: null };

 return seconds < minCollectMs / 1000
  ? { error: en.errors.collectTooShort }
  : { value: seconds };
};

export const colorTransform: FieldTransform = async (value) => {
 const raw = String(value).trim();
 if (!raw.length) return { value: null };

 return parseColor(raw) === null ? { error: en.errors.invalidColor } : { value: raw };
};

const customBotOnly = (row: Row) => ({
 ok: Boolean(row.botToken),
 reason: en.settings.reasons.customBotOnly,
});

const settingsSchema: SettingsSchemaDef = {
 table: 'giveawaySetting',
 rowKey: 'id',
 multiRow: false,
 title: (t: GiveawaysTranslator) => t.settings.configTitle(),
 overviewDescription: (t: GiveawaysTranslator) => t.settings.overviewDescription(),
 rowLabel: (t: GiveawaysTranslator) => t.settings.configTitle(),
 onChange: async (ctx) => {
  await (ctx.plugin as GiveawaysPlugin).activity.refreshGuild(ctx.guildId);
 },
 groups: [
  {
   id: GiveawaySettingsGroup.Defaults,
   label: (t: GiveawaysTranslator) => t.settings.groups.defaults(),
   emote: EmoteName.Gift,
   fields: [
    {
     column: 'winnerCount',
     editor: EditorType.Number,
     label: (t: GiveawaysTranslator) => t.settings.fields.winnerCount(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.winnerCount(),
    },
    {
     column: 'duration',
     editor: EditorType.Duration,
     label: (t: GiveawaysTranslator) => t.settings.fields.duration(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.duration(),
    },
    {
     column: 'collectSeconds',
     editor: EditorType.Duration,
     transform: claimFloorTransform,
     label: (t: GiveawaysTranslator) => t.settings.fields.collectSeconds(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.collectSeconds(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Appearance,
   label: (t: GiveawaysTranslator) => t.settings.groups.appearance(),
   emote: EmoteName.Palette,
   fields: [
    {
     column: 'accentColor',
     editor: EditorType.String,
     transform: colorTransform,
     label: (t: GiveawaysTranslator) => t.settings.fields.accentColor(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.accentColor(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Notifications,
   label: (t: GiveawaysTranslator) => t.settings.groups.notifications(),
   emote: EmoteName.Send,
   fields: [
    {
     column: 'logChannel',
     editor: EditorType.Channel,
     channelTypes: logChannelTypes,
     label: (t: GiveawaysTranslator) => t.settings.fields.logChannel(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.logChannel(),
    },
    {
     column: 'dmWinners',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.settings.fields.dmWinners(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.dmWinners(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Activity,
   label: (t: GiveawaysTranslator) => t.settings.groups.activity(),
   emote: EmoteName.Curve,
   fields: [
    {
     column: 'trackActivity',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.settings.fields.trackActivity(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.trackActivity(),
    },
    {
     column: 'messageChannels',
     editor: EditorType.Channels,
     arity: FieldArity.Multi,
     channelTypes: messageChannelTypes,
     label: (t: GiveawaysTranslator) => t.settings.fields.messageChannels(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.messageChannels(),
    },
    {
     column: 'voiceChannels',
     editor: EditorType.Channels,
     arity: FieldArity.Multi,
     channelTypes: voiceChannelTypes,
     label: (t: GiveawaysTranslator) => t.settings.fields.voiceChannels(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.voiceChannels(),
    },
    {
     column: 'voiceCountMuted',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.settings.fields.voiceCountMuted(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.voiceCountMuted(),
    },
    {
     column: 'voiceCountDeafened',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.settings.fields.voiceCountDeafened(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.voiceCountDeafened(),
    },
    {
     column: 'voiceMinMembers',
     editor: EditorType.Number,
     label: (t: GiveawaysTranslator) => t.settings.fields.voiceMinMembers(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.voiceMinMembers(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Bot,
   label: (t: GiveawaysTranslator) => t.settings.groups.bot(),
   emote: EmoteName.Bot,
   fields: [
    {
     column: 'botToken',
     editor: EditorType.BotToken,
     emote: EmoteName.Lock,
     arity: FieldArity.Single,
     secret: true,
     transform: giveawayBotTokenTransform,
     label: (t: GiveawaysTranslator) => t.settings.fields.botToken(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.botToken(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Presence,
   label: (t: GiveawaysTranslator) => t.settings.groups.presence(),
   emote: EmoteName.Activity,
   fields: [
    {
     column: 'presenceType',
     editor: EditorType.PresenceActivityType,
     emote: EmoteName.Activity,
     arity: FieldArity.Single,
     showIf: customBotOnly,
     label: (t: GiveawaysTranslator) => t.settings.fields.presenceType(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.presenceType(),
     options: Object.values(PresenceActivityType).map((value) => ({
      value,
      label: (t: GiveawaysTranslator) => t.settings.presenceTypes[value](),
     })),
    },
    {
     column: 'presenceText',
     editor: EditorType.String,
     emote: EmoteName.Message,
     showIf: customBotOnly,
     label: (t: GiveawaysTranslator) => t.settings.fields.presenceText(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.presenceText(),
    },
    {
     column: 'presenceEmoji',
     editor: EditorType.String,
     emote: EmoteName.Emoji,
     transform: giveawayPresenceEmojiTransform,
     showIf: customBotOnly,
     label: (t: GiveawaysTranslator) => t.settings.fields.presenceEmoji(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.presenceEmoji(),
    },
   ],
  },
  {
   id: GiveawaySettingsGroup.Profile,
   label: (t: GiveawaysTranslator) => t.settings.groups.profile(),
   emote: EmoteName.Image,
   fields: [
    {
     column: 'profileNick',
     editor: EditorType.String,
     emote: EmoteName.Author,
     arity: FieldArity.Single,
     virtual: giveawayProfileVirtual(BotProfilePart.Nick),
     label: (t: GiveawaysTranslator) => t.settings.fields.profileNick(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.profileNick(),
    },
    {
     column: 'profileAvatar',
     editor: EditorType.String,
     emote: EmoteName.Avatar,
     arity: FieldArity.Single,
     transform: giveawayProfileImageTransform,
     virtual: giveawayProfileVirtual(BotProfilePart.Avatar),
     label: (t: GiveawaysTranslator) => t.settings.fields.profileAvatar(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.profileAvatar(),
    },
    {
     column: 'profileBanner',
     editor: EditorType.String,
     emote: EmoteName.Banner,
     arity: FieldArity.Single,
     transform: giveawayProfileImageTransform,
     virtual: giveawayProfileVirtual(BotProfilePart.Banner),
     label: (t: GiveawaysTranslator) => t.settings.fields.profileBanner(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.profileBanner(),
    },
    {
     column: 'profileBio',
     editor: EditorType.String,
     emote: EmoteName.Paragraph,
     arity: FieldArity.Single,
     multiline: true,
     virtual: giveawayProfileVirtual(BotProfilePart.Bio),
     label: (t: GiveawaysTranslator) => t.settings.fields.profileBio(),
     description: (t: GiveawaysTranslator) => t.settings.descriptions.profileBio(),
    },
   ],
  },
 ],
 guide: {
  title: (t: GiveawaysTranslator) => t.guide.title(),
  intro: (t: GiveawaysTranslator) => t.guide.intro(),
  advert: {
   text: (t: GiveawaysTranslator) => t.guide.advertText(),
   buttonLabel: (t: GiveawaysTranslator) => t.guide.advertButton(),
   emote: EmoteName.Gift,
  },
  sections: [
   {
    id: GiveawaySettingsGroup.Defaults,
    label: (t: GiveawaysTranslator) => t.settings.groups.defaults(),
    emote: EmoteName.Gift,
    steps: [
     {
      column: 'duration',
      label: (t: GiveawaysTranslator) => t.settings.fields.duration(),
     },
     {
      column: 'winnerCount',
      label: (t: GiveawaysTranslator) => t.settings.fields.winnerCount(),
     },
    ],
   },
   {
    id: GiveawaySettingsGroup.Notifications,
    label: (t: GiveawaysTranslator) => t.settings.groups.notifications(),
    emote: EmoteName.Send,
    steps: [
     {
      column: 'logChannel',
      label: (t: GiveawaysTranslator) => t.settings.fields.logChannel(),
     },
     {
      column: 'dmWinners',
      label: (t: GiveawaysTranslator) => t.settings.fields.dmWinners(),
     },
    ],
   },
  ],
 },
} satisfies SettingsSchemaDef<Row, GiveawaysTranslator>;

export default settingsSchema;
