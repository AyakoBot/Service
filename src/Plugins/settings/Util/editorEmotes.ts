import type { APIPartialEmoji } from '@discordjs/core';
import type { ChannelType } from 'discord-api-types/v10';

import emotes from '../../../Classes/Emotes.js';
import { EditorType } from '../EditorType.js';

type EmoteResolver = APIPartialEmoji | ((value: never) => APIPartialEmoji) | undefined;

const channelEmote = (channelType: ChannelType): APIPartialEmoji =>
 emotes.channelTypes[channelType as keyof typeof emotes.channelTypes] || emotes.channelTypes[0];

class EditorEmotes {
 private resolvers: Record<EditorType, EmoteResolver> = {
  [EditorType.Channel]: channelEmote,
  [EditorType.Channels]: channelEmote,
  [EditorType.Role]: emotes.Role,
  [EditorType.Roles]: emotes.Role,
  [EditorType.User]: emotes.Member,
  [EditorType.Users]: emotes.Member,
  [EditorType.Mention]: undefined,
  [EditorType.Mentions]: undefined,
  [EditorType.Boolean]: (value: boolean) => (value ? emotes.enabled : emotes.disabled),
  [EditorType.Duration]: emotes.timer,
  [EditorType.String]: undefined,
  [EditorType.Language]: undefined,
  [EditorType.Number]: emotes.number,
  [EditorType.Punishment]: emotes.hammer,
  [EditorType.AntiRaidPunishment]: emotes.hammer,
  [EditorType.Embed]: emotes.Message,
  [EditorType.Token]: emotes.lock,
  [EditorType.BotToken]: emotes.lock,
  [EditorType.Message]: emotes.Message,
  [EditorType.ShopType]: emotes.shop,
  [EditorType.FormulaType]: emotes.brain,
  [EditorType.Emote]: emotes.Emoji,
  [EditorType.Emotes]: emotes.Emoji,
  [EditorType.Command]: emotes.Command,
  [EditorType.AutoModRules]: emotes.AutoMod,
  [EditorType.SettingLink]: emotes.settings,
  [EditorType.AutoPunishment]: emotes.hammer,
  [EditorType.LvlUpMode]: undefined,
  [EditorType.Strings]: undefined,
  [EditorType.QuestionType]: emotes.question,
  [EditorType.Category]: emotes.channelTypes[4],
  [EditorType.Voice]: emotes.channelTypes[2],
  [EditorType.Permission]: emotes.settings,
  [EditorType.RoleMode]: emotes.Role,
  [EditorType.Commands]: emotes.Command,
  [EditorType.Questions]: emotes.question,
  [EditorType.Position]: emotes.number,
  [EditorType.ThreadAutoArchiveDuration]: emotes.timer,
  [EditorType.WeekendsType]: emotes.calendar,
  [EditorType.TicketType]: emotes.ticket,
  [EditorType.TicketLogMode]: emotes.log,
  [EditorType.TicketPanelKinds]: emotes.ticket,
  [EditorType.RoleLabelMap]: emotes.Role,
  [EditorType.TicketPlacementMode]: emotes.channelTypes[15],
  [EditorType.TicketTiers]: emotes.settings,

  [EditorType.GuildId]: undefined,
  [EditorType.Id]: undefined,
 };

 forEditor = (editor: EditorType, value?: unknown): APIPartialEmoji => {
  const resolver = this.resolvers[editor];
  if (!resolver) return emotes.settings;
  if (typeof resolver === 'function') return resolver(value as never);
  return resolver;
 };
}

export default new EditorEmotes();
