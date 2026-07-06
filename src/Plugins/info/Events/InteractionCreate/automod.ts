import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 SeparatorSpacingSize,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIAutoModerationRule,
} from 'discord-api-types/v10';

import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import type InfoPlugin from '../../Plugin.js';
import { codeId, line, nameOf, yesNo } from '../../Util/fmt.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

const keywordPreviewCap = 15;

const ruleBlock = (t: Translator, rule: APIAutoModerationRule): string =>
 [
  `### ${rule.name}`,
  line(emotes.number, t.common.id(), codeId(rule.id)),
  line(emotes.enabled, t.base.t.Enabled(), yesNo(t.base, rule.enabled)),
  line(
   emotes.automod,
   t.automod.trigger(),
   nameOf(t.automod.triggerNames, rule.trigger_type, t.base.t.Unknown()),
  ),
  line(
   emotes.hammer,
   t.automod.actions(),
   rule.actions
    .map((action) => `\`${nameOf(t.automod.actionNames, action.type, t.base.t.Unknown())}\``)
    .join(', '),
  ),
  line(emotes.member, t.events.creator(), `<@${rule.creator_id}>`),
  rule.trigger_metadata?.keyword_filter?.length
   ? line(
      emotes.paragraph,
      t.automod.keywords(),
      `\`${rule.trigger_metadata.keyword_filter.length}\` (${rule.trigger_metadata.keyword_filter
       .slice(0, keywordPreviewCap)
       .map((keyword) => `\`${keyword}\``)
       .join(', ')}${rule.trigger_metadata.keyword_filter.length > keywordPreviewCap ? ', …' : ''})`,
     )
   : null,
  rule.exempt_roles?.length
   ? line(emotes.role, t.automod.exemptRoles(), rule.exempt_roles.map((id) => `<@&${id}>`).join(' '))
   : null,
  rule.exempt_channels?.length
   ? line(
      emotes.message,
      t.automod.exemptChannels(),
      rule.exempt_channels.map((id) => `<#${id}>`).join(' '),
     )
   : null,
 ]
  .filter((entry): entry is string => entry !== null)
  .join('\n');

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

 const rules = await this.client.cache.automods.getAll(cmd.guild_id);
 if (!rules.length) {
  respondError.call(this, cmd, t.automod.none());
  return;
 }

 const container = new ContainerBuilder().setAccentColor(Colors.Info);
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `## ${textEmote(emotes.automod)} ${t.automod.title()} (\`${rules.length}\`)`,
  ),
 );

 rules.forEach((rule) => {
  container.addSeparatorComponents(
   new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ruleBlock(t, rule)));
 });

 respond.call(this, cmd, [container], getHide(sub));
}
