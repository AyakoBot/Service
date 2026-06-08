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
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { type MoveDirection, PageDirection } from '../../Classes/Enums.js';
import { TicketRoute } from '../../Classes/Routes.js';
import TicketRoleMap, { type RoleMapEntry } from '../../Classes/TicketRoleMap.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';

export const roleMapPageSize = 5;

export const buildRoleMapEditor = async function (
 this: TicketPlugin,
 guildId: string,
 entries: RoleMapEntry[],
 page: number,
) {
 const t = await this.t(guildId);
 const pageCount = Math.max(1, Math.ceil(entries.length / roleMapPageSize));
 const safePage = Math.min(Math.max(0, page), pageCount - 1);
 const start = safePage * roleMapPageSize;
 const slice = entries.slice(start, start + roleMapPageSize);

 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `${constants.formatters.getEmote(emotes.Member)} **${t.roleMap.title()}**`,
  ),
 );

 container.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );

 if (!slice.length) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(t.roleMap.empty()));
 }

 slice.forEach((entry, sliceIndex) => {
  const index = start + sliceIndex;
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`-# ${index + 1}. <@&${entry.role}> → ${entry.label}`),
  );

  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(TicketRoute.RoleMapUp, index))
     .setLabel('↑')
     .setDisabled(index <= 0),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(TicketRoute.RoleMapDown, index))
     .setLabel('↓')
     .setDisabled(index >= entries.length - 1),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Primary)
     .setCustomId(this.getRoute(TicketRoute.RoleMapEdit, index))
     .setLabel(t.base.t.Edit()),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Danger)
     .setCustomId(this.getRoute(TicketRoute.RoleMapRemove, index))
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
   .setCustomId(this.getRoute(TicketRoute.RoleMapPage, PageDirection.Prev, safePage))
   .setLabel('←')
   .setDisabled(safePage <= 0),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Secondary)
   .setCustomId(this.getRoute(TicketRoute.RoleMapPage, PageDirection.Next, safePage))
   .setLabel('→')
   .setDisabled(safePage >= pageCount - 1),
  new ButtonBuilder()
   .setStyle(ButtonStyle.Success)
   .setCustomId(this.getRoute(TicketRoute.RoleMapAdd))
   .setLabel(t.base.t.Add()),
 );

 const components: APIMessageTopLevelComponent[] = [
  container.toJSON(),
  nav.toJSON() as unknown as APIMessageTopLevelComponent,
 ];

 return new MessagePayload(this.client, { origin: this.name, reason: 'Ticket role map editor' })
  .setComponents(components)
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

export const roleMapOpen = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const entries = await new TicketRoleMap(this.client, cmd.guild_id).list();
 const payload = await buildRoleMapEditor.call(this, cmd.guild_id, entries, 0);
 payload.reply(cmd);
};

export const roleMapPage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const [dir, currentArg] = args;
 const current = Number(currentArg) || 0;
 const page = dir === PageDirection.Next ? current + 1 : current - 1;

 const entries = await new TicketRoleMap(this.client, cmd.guild_id).list();
 const payload = await buildRoleMapEditor.call(this, cmd.guild_id, entries, page);
 payload.update(cmd);
};

export const roleMapRemove = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const index = Number(args[0]);
 const entries = await new TicketRoleMap(this.client, cmd.guild_id)
  .removeAt(index)
  .catch((error: Error) => {
   this.nonFatalError(error, 'roleMapRemove');
   return [];
  });

 const payload = await buildRoleMapEditor.call(this, cmd.guild_id, entries, 0);
 payload.update(cmd);
};

export const roleMapMove = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
 direction: MoveDirection,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const index = Number(args[0]);
 const entries = await new TicketRoleMap(this.client, cmd.guild_id)
  .move(index, direction)
  .catch((error: Error) => {
   this.nonFatalError(error, 'roleMapMove');
   return [];
  });

 const payload = await buildRoleMapEditor.call(this, cmd.guild_id, entries, 0);
 payload.update(cmd);
};
