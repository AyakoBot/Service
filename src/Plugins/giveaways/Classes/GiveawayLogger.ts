import { RequestHandlerError, type API } from '@ayako/api';
import type { Giveaway, GiveawaySetting, GiveawayTemplate } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, type CreateMessageOptions } from '@discordjs/core';
import { MessageFlags, type APIMessageTopLevelComponent } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { buttonEmoji } from '../../settings/Util/settingsEmotes.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import {
 entryCount,
 full,
 giveawayLink,
 hasClaimFlow,
 hasReward,
 rel,
} from '../Util/container.js';

import { GiveawaysRoute } from './Routes.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

const linkRow = (t: Translator, giveaway: Giveaway) =>
 new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Link)
   .setLabel(t.end.link())
   .setURL(giveawayLink(giveaway)),
 );

const winnersLine = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) => {
 const { getEmote } = constants.formatters;

 return giveaway.winners.length
  ? `${getEmote(emotes.crown)} ${t.giveaway.winners({
     winners: giveaway.winners.map((w) => `<@${w}>`).join(', '),
    })}`
  : `${getEmote(emotes.crown)} ${t.giveaway.possibleWinners({
     count: String(Number(giveaway.winnerCount)),
    })}`;
};

const logLines = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) => {
 const { getEmote } = constants.formatters;

 return [
  t.log.field({ label: t.base.t.Channel(), value: `<#${giveaway.channel}>` }),
  `${getEmote(emotes.member)} ${t.giveaway.entries({ count: String(entryCount(giveaway)) })}`,
  winnersLine(t, emotes, giveaway),
  `${getEmote(emotes.timer)} ${
   giveaway.ended
    ? t.giveaway.endedAt({ time: rel(giveaway.endTime) })
    : t.giveaway.endsAt({ time: full(giveaway.endTime) })
  }`,
  `${getEmote(emotes.author)} ${t.giveaway.host({ user: `<@${giveaway.host}>` })}`,
 ].join('\n');
};

const buildLog = (
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
 title: string,
): APIMessageTopLevelComponent[] => [
 new ContainerBuilder()
  .addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    `### ${constants.formatters.getEmote(emotes.gift)} ${title}`,
   ),
   new TextDisplayBuilder().setContent(giveaway.description),
  )
  .addSeparatorComponents(new SeparatorBuilder())
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(logLines(t, emotes, giveaway)))
  .addActionRowComponents(linkRow(t, giveaway))
  .toJSON(),
];

const buildWinnerDM = (
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
 server: string,
): APIMessageTopLevelComponent[] => {
 const claiming = hasClaimFlow(giveaway) && !!giveaway.claimUntil;

 return [
  new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `### ${constants.formatters.getEmote(emotes.crown)} ${t.dm.title()}`,
    ),
    new TextDisplayBuilder().setContent(
     [
      t.dm.body({ description: giveaway.description, server }),
      claiming
       ? t.dm.claim({ time: rel(giveaway.claimUntil as Date) })
       : hasReward(giveaway)
         ? t.dm.claimOpen()
         : t.dm.hostWill({ host: `<@${giveaway.host}>` }),
     ].join('\n'),
    ),
   )
   .addActionRowComponents(linkRow(t, giveaway))
   .toJSON(),
 ];
};

export default class GiveawayLogger {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 created = async (giveaway: Giveaway) => this.log(giveaway, (t) => t.log.created());

 ended = async (giveaway: Giveaway) => this.log(giveaway, (t) => t.log.ended());

 cancelled = async (giveaway: Giveaway) => this.log(giveaway, (t) => t.log.cancelled());

 rerolled = async (giveaway: Giveaway) => this.log(giveaway, (t) => t.log.rerolled());

 claimExpired = async (giveaway: Giveaway) => this.log(giveaway, (t) => t.log.claimExpired());

 rewardFailed = async (giveaway: Giveaway, userId: string) =>
  this.log(giveaway, (t) => t.log.rewardFailed({ user: `<@${userId}>` }));

 runFailed = async (template: GiveawayTemplate, reason: string) => {
  const t = await this.plugin.t(template.guild);
  await this.notice(template.guild, `${t.log.runFailed({ name: template.name ?? '' })}\n${reason}`);
 };

 due = async (template: GiveawayTemplate) => {
  const t = await this.plugin.t(template.guild);
  const api = await this.plugin.api(template.guild);
  const emotes = this.client.emojis.for(api);

  await this.notice(
   template.guild,
   t.log.due({ name: template.name ?? '', winners: String(Number(template.winnerCount ?? 1)) }),
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.plugin.getRoute(GiveawaysRoute.Due, template.id))
     .setEmoji(buttonEmoji(emotes.gift))
     .setLabel(t.panel.open()),
   ),
  );
 };

 notifyWinners = async (giveaway: Giveaway, winners: string[]): Promise<string[]> => {
  if (!winners.length) return [];

  const setting = await this.setting(giveaway.guild);
  if (setting && !setting.dmWinners) return [];

  const t = await this.plugin.t(giveaway.guild);
  const api = await this.plugin.api(giveaway.guild);
  const emotes = this.client.emojis.for(api);
  const guild = await this.client.cache.guilds.get(giveaway.guild);

  const payload = new MessagePayload(this.client, { origin, reason: t.dm.reason() })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(buildWinnerDM(t, emotes, giveaway, guild?.name ?? giveaway.guild))
   .getAPIPayload();

  const unreachable: string[] = [];
  for (const userId of winners) {
   const sent = await this.dm(api, t, userId, payload);
   if (!sent) unreachable.push(userId);
  }

  return unreachable;
 };

 private setting = (guildId: string): Promise<GiveawaySetting | null> =>
  this.client.db.client.giveawaySetting.findFirst({ where: { guild: guildId } });

 private log = async (giveaway: Giveaway, title: (t: Translator) => string) => {
  const setting = await this.setting(giveaway.guild);
  if (!setting?.logChannel) return;

  const t = await this.plugin.t(giveaway.guild);
  const api = await this.plugin.api(giveaway.guild);
  const emotes = this.client.emojis.for(api);

  new MessagePayload(this.client, { origin, reason: t.log.reason() })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(buildLog(t, emotes, giveaway, title(t)))
   .setAPI(api)
   .addSendTo({ channel: setting.logChannel, guildId: giveaway.guild })
   .send()
   .catch((error: Error) => this.plugin.nonFatalError(error, 'giveawayLog'));
 };

 private notice = async (
  guildId: string,
  text: string,
  row?: ActionRowBuilder<ButtonBuilder>,
 ) => {
  const setting = await this.setting(guildId);
  if (!setting?.logChannel) return;

  const t = await this.plugin.t(guildId);
  const api = await this.plugin.api(guildId);
  const container = new ContainerBuilder().addTextDisplayComponents(
   new TextDisplayBuilder().setContent(text),
  );
  if (row) container.addActionRowComponents(row);

  const payload = new MessagePayload(this.client, { origin, reason: t.log.reason() })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([container.toJSON()]);

  const sent = await api.channels.createMessage(setting.logChannel, payload.getAPIPayload(), {
   origin,
   reason: t.log.reason(),
  });
  if (sent instanceof RequestHandlerError) this.plugin.nonFatalError(sent, 'giveawayNotice');
 };

 private dm = async (
  api: API,
  t: Translator,
  userId: string,
  payload: CreateMessageOptions,
 ): Promise<boolean> => {
  const channel = await api.users.createDM(userId, { origin, reason: t.dm.reason() });
  if (channel instanceof RequestHandlerError) {
   this.plugin.nonFatalError(channel, 'giveawayWinnerDM');
   return false;
  }

  const sent = await api.channels.createDirectMessage(channel.id, payload, {
   origin,
   reason: t.dm.reason(),
  });
  if (sent instanceof RequestHandlerError) {
   this.plugin.nonFatalError(sent, 'giveawayWinnerDM');
   return false;
  }

  return true;
 };
}
