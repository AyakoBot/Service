import { RequestHandlerError } from '@ayako/api';
import {
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
} from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import { getStringOption } from '../../../../Util/interactionOptions.js';
import { parseWebhookUrl } from '../../../../Util/parseWebhookUrl.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import type InfoPlugin from '../../Plugin.js';
import { codeId, line, nameOf, timeOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError } from '../../Util/respond.js';

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 if (!cmd.guild_id) {
  respondError.call(this, cmd, t.errors.guildOnly());
  return;
 }

 const parsed = parseWebhookUrl(getStringOption(sub, InfoOption.Url));
 if (!parsed) {
  respondError.call(this, cmd, t.errors.invalidWebhookUrl());
  return;
 }

 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);
 const webhook = await api.webhooks.get(
  parsed.id,
  { token: parsed.token },
  { origin: this.name, reason: 'Fetching webhook for info panel' },
 );
 if (!webhook || webhook instanceof RequestHandlerError) {
  respondError.call(this, cmd, t.errors.webhookNotFound());
  return;
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 const content = [
  `## ${textEmote(emotes.webhook)} ${t.webhook.title()}`,
  line(emotes.info, t.base.t.name(), `\`${webhook.name ?? t.base.t.Unknown()}\``),
  line(emotes.number, t.common.id(), codeId(webhook.id)),
  line(
   emotes.settings,
   t.base.t.Type(),
   nameOf(t.webhook.typeNames, webhook.type, t.base.t.Unknown()),
  ),
  line(emotes.calendar, t.base.t.Created(), timeOf(snowflakeToMs(webhook.id), t.base)),
  webhook.channel_id
   ? line(emotes.message, t.base.t.Channel(), `<#${webhook.channel_id}>`)
   : null,
  webhook.user
   ? line(
      emotes.member,
      t.common.uploader(),
      `${constants.formatters.user(webhook.user)} (${codeId(webhook.user.id)})`,
     )
   : null,
  webhook.application_id
   ? line(emotes.bot, t.base.t.Application(), codeId(webhook.application_id))
   : null,
  line(emotes.lock, t.webhook.hasToken(), yesNo(emotes, t.base, Boolean(webhook.token))),
 ]
  .filter((entry): entry is string => entry !== null)
  .join('\n');

 if (webhook.avatar) {
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .setThumbnailAccessory(
     new ThumbnailBuilder().setURL(
      `https://cdn.discordapp.com/avatars/${webhook.id}/${webhook.avatar}.webp`,
     ),
    ),
  );
 } else {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
 }

 respond.call(this, cmd, [container], getHide(sub));
}
