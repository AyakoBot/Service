import type { APIPartialEmoji } from '@discordjs/core';
import type { ChannelType } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { EditorType } from '../EditorType.js';

type EmoteResolver = EmoteName | ((emotes: EmoteSet, value: never) => APIPartialEmoji) | undefined;

const channelEmote = (emotes: EmoteSet, channelType: ChannelType): APIPartialEmoji =>
 emotes.channelTypes[channelType as keyof EmoteSet['channelTypes']] || emotes.channelTypes[0];

class EditorEmotes {
 private resolvers: Record<EditorType, EmoteResolver> = {
  [EditorType.Channel]: channelEmote,
  [EditorType.Channels]: channelEmote,
  [EditorType.Role]: EmoteName.Role,
  [EditorType.Roles]: EmoteName.Role,
  [EditorType.User]: EmoteName.Member,
  [EditorType.Users]: EmoteName.Member,
  [EditorType.Mention]: undefined,
  [EditorType.Mentions]: undefined,
  [EditorType.Boolean]: (emotes: EmoteSet, value: boolean) =>
   (value ? emotes.enabled : emotes.disabled),
  [EditorType.Duration]: EmoteName.Timer,
  [EditorType.String]: undefined,
  [EditorType.Language]: undefined,
  [EditorType.Number]: EmoteName.Number,
  [EditorType.Punishment]: EmoteName.Hammer,
  [EditorType.AntiRaidPunishment]: EmoteName.Hammer,
  [EditorType.Embed]: EmoteName.Message,
  [EditorType.Token]: EmoteName.Lock,
  [EditorType.BotToken]: EmoteName.Lock,
  [EditorType.Message]: EmoteName.Message,
  [EditorType.ShopType]: EmoteName.Shop,
  [EditorType.FormulaType]: EmoteName.Brain,
  [EditorType.Emote]: EmoteName.Emoji,
  [EditorType.Emotes]: EmoteName.Emoji,
  [EditorType.Command]: EmoteName.Command,
  [EditorType.AutoModRules]: EmoteName.Automod,
  [EditorType.SettingLink]: EmoteName.Settings,
  [EditorType.AutoPunishment]: EmoteName.Hammer,
  [EditorType.LvlUpMode]: undefined,
  [EditorType.Strings]: undefined,
  [EditorType.QuestionType]: EmoteName.Question,
  [EditorType.Category]: EmoteName.ChannelCategory,
  [EditorType.Voice]: EmoteName.ChannelVoice,
  [EditorType.Permission]: EmoteName.Settings,
  [EditorType.RoleMode]: EmoteName.Role,
  [EditorType.Commands]: EmoteName.Command,
  [EditorType.Questions]: EmoteName.Question,
  [EditorType.Position]: EmoteName.Number,
  [EditorType.ThreadAutoArchiveDuration]: EmoteName.Timer,
  [EditorType.WeekendsType]: EmoteName.Calendar,
  [EditorType.TicketType]: EmoteName.Ticket,
  [EditorType.TicketLogMode]: EmoteName.Log,
  [EditorType.TicketPanelKinds]: EmoteName.Ticket,
  [EditorType.RoleLabelMap]: EmoteName.Role,
  [EditorType.TicketPlacementMode]: EmoteName.ChannelForum,
  [EditorType.TicketTiers]: EmoteName.Settings,
  [EditorType.PresenceActivityType]: EmoteName.Member,

  [EditorType.GuildId]: undefined,
  [EditorType.Id]: undefined,
 };

 forEditor = (emotes: EmoteSet, editor: EditorType, value?: unknown): APIPartialEmoji | null => {
  const resolver = this.resolvers[editor];
  if (!resolver) return null;
  if (typeof resolver === 'function') return resolver(emotes, value as never);
  return emotes.get(resolver);
 };
}

export default new EditorEmotes();
