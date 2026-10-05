import type {
 APIApplicationCommandInteractionDataSubcommandOption,
 APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import {
 getIntegerOption,
 getGroupSubcommand,
 getStringOption,
 getSubcommandGroup,
 getUserOption,
} from '../../../../Util/interactionOptions.js';
import Afk from '../../Classes/Afk.js';
import { AfkCommand, AfkModSub, AfkOption } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';
import { previewOf } from '../../Util/text.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;

type ModHandler = (
 this: AFKPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 sub: Sub,
 guildId: string,
) => Promise<void>;

const listPageSize = 10;

const clear: ModHandler = async function (cmd, sub, guildId) {
 const target = getUserOption(sub, AfkOption.User);
 if (!target) return;

 await new Afk(this, target, guildId).forceRemove(cmd, getStringOption(sub, AfkOption.Reason));
};

const resetReason: ModHandler = async function (cmd, sub, guildId) {
 const target = getUserOption(sub, AfkOption.User);
 if (!target) return;

 await new Afk(this, target, guildId).resetReason(cmd);
};

const list: ModHandler = async function (cmd, sub, guildId) {
 const t = await this.t(guildId);
 const total = await this.client.db.client.afkState.count({ where: { guild: guildId } });
 if (!total) {
  ephemeralNote.call(this, cmd, t.t.listEmpty());
  return;
 }

 const pages = Math.ceil(total / listPageSize);
 const page = Math.min(Math.max(getIntegerOption(sub, AfkOption.Page) ?? 1, 1), pages);
 const rows = await this.client.db.client.afkState.findMany({
  where: { guild: guildId },
  orderBy: { since: 'asc' },
  skip: (page - 1) * listPageSize,
  take: listPageSize,
 });

 const lines = rows.map((row) =>
  t.t.listLine({
   user: row.user,
   since: constants.formatters.getTime(Number(row.since)),
   reason: row.reason ? ` · ${previewOf(row.reason)}` : '',
  }),
 );

 ephemeralNote.call(
  this,
  cmd,
  [
   t.t.listTitle({ count: String(total) }),
   ...lines,
   t.t.listPage({ page: String(page), pages: String(pages) }),
  ].join('\n'),
 );
};

const handlers: Record<AfkModSub, ModHandler> = {
 [AfkModSub.List]: list,
 [AfkModSub.Clear]: clear,
 [AfkModSub.ResetReason]: resetReason,
};

export default async function (this: AFKPlugin, cmd: APIChatInputApplicationCommandInteraction) {
 if (cmd.application_id === this.client.getBaseAPI().botId) return;
 if (!cmd.guild_id) return;
 if (getSubcommandGroup(cmd)?.name !== AfkCommand.Afk) return;

 const sub = getGroupSubcommand(cmd);
 const handler = sub ? handlers[sub.name as AfkModSub] : undefined;
 if (!sub || !handler) return;

 await handler.call(this, cmd, sub, cmd.guild_id);
}
