import type { TicketTier } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 SeparatorSpacingSize,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { Colors } from '../../../../Types/index.js';
import { type MoveDirection, PageDirection } from '../../Classes/Enums.js';
import { TicketRoute } from '../../Classes/Routes.js';
import TicketTierEntry from '../../Classes/TicketTierEntry.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';

export const tierPageSize = 5;

export const buildTierEditor = async function (
 this: TicketPlugin,
 guildId: string,
 settingsId: string,
 tiers: TicketTier[],
 page: number,
) {
 const t = await this.t(guildId);
 const api = await this.getAPI(guildId);
 const emotes = this.client.emojis.for(api);
 const pageCount = Math.max(1, Math.ceil(tiers.length / tierPageSize));
 const safePage = Math.min(Math.max(0, page), pageCount - 1);
 const start = safePage * tierPageSize;
 const slice = tiers.slice(start, start + tierPageSize);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `${constants.formatters.getEmote(emotes.tools)} **${t.tierEditor.title()}**`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 if (!slice.length) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t.tierEditor.empty()));
 }

 slice.forEach((tier, sliceIndex) => {
  const index = start + sliceIndex;
  const roles = tier.claimRoles.map((r) => `<@&${r}>`).join(', ') || t.base.t.none();
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`-# ${index + 1}. **${tier.name}** → ${roles}`),
  );

  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(TicketRoute.TierUp, settingsId, tier.id))
     .setLabel('↑')
     .setDisabled(index <= 0),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(TicketRoute.TierDown, settingsId, tier.id))
     .setLabel('↓')
     .setDisabled(index >= tiers.length - 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.getRoute(TicketRoute.TierEdit, settingsId, tier.id))
     .setLabel(t.base.t.Edit()),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Danger)
     .setCustomId(this.getRoute(TicketRoute.TierDel, settingsId, tier.id))
     .setLabel(t.base.t.Delete()),
   ),
  );
 });

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`-# ${t.base.t.Page()} ${safePage + 1}/${pageCount}`),
 );

 const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.TierPage, settingsId, PageDirection.Prev, safePage))
   .setLabel('←')
   .setDisabled(safePage <= 0),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.TierPage, settingsId, PageDirection.Next, safePage))
   .setLabel('→')
   .setDisabled(safePage >= pageCount - 1),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(TicketRoute.TierAdd, settingsId))
   .setLabel(t.base.t.Add()),
 );

 const components: APIMessageTopLevelComponent[] = [
  container.toJSON(),
  nav.toJSON() as unknown as APIMessageTopLevelComponent,
 ];

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket tier editor' })
  .setComponents(components)
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

export const tierManageOpen = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId] = args;
 const tiers = await new TicketTierEntry(this.client, settingsId).list();
 const payload = await buildTierEditor.call(this, cmd.guild_id, settingsId, tiers, 0);
 payload.reply(cmd);
};

export const tierPage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId, dir, currentArg] = args;
 const current = Number(currentArg) || 0;
 const page = dir === PageDirection.Next ? current + 1 : current - 1;

 const tiers = await new TicketTierEntry(this.client, settingsId).list();
 const payload = await buildTierEditor.call(this, cmd.guild_id, settingsId, tiers, page);
 payload.update(cmd);
};

export const tierMove = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
 direction: MoveDirection,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId, tierId] = args;
 const tiers = await new TicketTierEntry(this.client, settingsId)
  .move(tierId, direction)
  .catch((error: Error) => error);
 if (tiers instanceof Error) {
  this.nonFatalError(tiers, 'tierMove');
  tierWarn.call(this, cmd, (await this.t(cmd.guild_id)).base.errors.unknownError());
  return;
 }

 const payload = await buildTierEditor.call(this, cmd.guild_id, settingsId, tiers, 0);
 payload.update(cmd);
};

export const tierDel = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [settingsId, tierId] = args;
 const tiers = await new TicketTierEntry(this.client, settingsId)
  .remove(tierId)
  .catch((error: Error) => error);
 if (tiers instanceof Error) {
  this.nonFatalError(tiers, 'tierDel');
  tierWarn.call(this, cmd, (await this.t(cmd.guild_id)).base.errors.unknownError());
  return;
 }

 const payload = await buildTierEditor.call(this, cmd.guild_id, settingsId, tiers, 0);
 payload.update(cmd);
};

export const tierWarn = function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Tier editor warning' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
