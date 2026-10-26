import { TicketPriority, TicketState, type Prisma, type TicketSetting } from '@ayako/database';
import {
 ApplicationCommandOptionType,
 MessageFlags,
 type APIApplicationCommandInteractionDataBasicOption,
 type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type ChannelTicket from '../../Classes/ChannelTicket.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';
import { TicketCommandOption, TicketSubcommand } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';
import handleTicketError from '../../Util/handleTicketError.js';
import isSettingsStaff from '../../Util/isSettingsStaff.js';
import { byUrgency, priorityLabel } from '../../Util/priority.js';
import { resolveTicketHere } from '../../Util/resolveTicket.js';
import showCommandError from '../../Util/showCommandError.js';
import { systemDisplayLabel } from '../../Util/systemLabel.js';

import claim from './claim.js';
import close from './close.js';
import del from './delete.js';
import escalate from './escalate.js';
import escalateTo from './escalateTo.js';
import { forceOpenFor } from './forceOpen.js';
import take from './take.js';
import unclaim from './unclaim.js';

type ChatInput = APIChatInputApplicationCommandInteraction;
type Options = APIApplicationCommandInteractionDataBasicOption[];
type Translator = Awaited<ReturnType<TicketPlugin['t']>>;
type ListRow = Prisma.TicketGetPayload<{ include: { settings: true } }>;

type SubcommandHandler = (this: TicketPlugin, cmd: ChatInput, options: Options) => Promise<unknown>;
type TicketHandler = (
 this: TicketPlugin,
 cmd: ChatInput,
 ticket: ChannelTicket,
 options: Options,
) => Promise<unknown>;
type RouteHandler = (this: TicketPlugin, cmd: ChatInput, args: string[]) => Promise<unknown>;

const listBudget = 1900;
const openStates = [TicketState.opened, TicketState.claimed];

const optionValue = (options: Options, name: TicketCommandOption): string | null => {
 const option = options.find((o) => o.name === name);
 return option ? String(option.value) : null;
};

const actorOf = (cmd: ChatInput): string => cmd.member?.user.id ?? '';

const withTicket = (handler: TicketHandler): SubcommandHandler =>
 async function (this: TicketPlugin, cmd: ChatInput, options: Options) {
  const ticket = await resolveTicketHere.call(this.client, cmd.channel.id);
  if (!ticket) {
   const t = await this.t(cmd.guild_id!);
   showCommandError.call(this.client, t.command.notTicket(), cmd, t.base);
   return;
  }

  await handler
   .call(this, cmd, ticket, options)
   .catch((error: Error) =>
    handleTicketError.call(this.client, { guildId: cmd.guild_id!, error, cmd }),
   );
 };

const delegate = (handler: RouteHandler): SubcommandHandler =>
 withTicket(function (cmd, ticket) {
  return handler.call(this, cmd, [ticket.id]);
 });

const open: SubcommandHandler = function (cmd, options) {
 const targetId = optionValue(options, TicketCommandOption.User) ?? '';
 return forceOpenFor.call(this, cmd, targetId, cmd.data.resolved);
};

const escalateCommand = withTicket(async function (cmd, ticket, options) {
 await ticket.getTicket();
 if (!(await ticket.listTiers()).length) throw new Error(BaseTicketErrors.escalate_NoTiers);

 const tier = optionValue(options, TicketCommandOption.Tier);
 if (tier) return escalateTo.call(this, cmd, [ticket.id, tier]);
 return escalate.call(this, cmd, [ticket.id]);
});

const add = withTicket(async function (cmd, ticket, options) {
 const targetId = optionValue(options, TicketCommandOption.User) ?? '';
 await ticket.addMember(actorOf(cmd), targetId);
 await ticket.ackEphemeral(cmd, (t) =>
  t.command.added({ user: `<@${actorOf(cmd)}>`, target: `<@${targetId}>` }),
 );
});

const remove = withTicket(async function (cmd, ticket, options) {
 const targetId = optionValue(options, TicketCommandOption.User) ?? '';
 await ticket.removeMember(actorOf(cmd), targetId);
 await ticket.ackEphemeral(cmd, (t) =>
  t.command.removed({ user: `<@${actorOf(cmd)}>`, target: `<@${targetId}>` }),
 );
});

const priority = withTicket(async function (cmd, ticket, options) {
 const level = optionValue(options, TicketCommandOption.Level) as TicketPriority;
 await ticket.setPriority(actorOf(cmd), level);
 await ticket.ackEphemeral(cmd, (t) =>
  t.command.priorityChanged({ priority: priorityLabel(t, level) }),
 );
 await ticket.refreshSurface();
});

const info = withTicket(async function (cmd, ticket) {
 if (!(await ticket.isUserStaff(actorOf(cmd)))) {
  throw new Error(BaseTicketErrors.manage_UserNotStaff);
 }

 const content = await ticket.describe();
 await ticket.ackEphemeral(cmd, () => content);
});

const listLine = (t: Translator, row: ListRow): string =>
 [
  `- <#${row.channel}> <@${row.user}>`,
  systemDisplayLabel(t, row.settings),
  row.state === TicketState.claimed ? t.stateClaimed() : t.stateOpened(),
  ...(row.priority !== TicketPriority.None ? [priorityLabel(t, row.priority)] : []),
  `<t:${Math.floor(Number(row.id) / 1000)}:R>`,
 ].join(' · ');

const listText = (t: Translator, rows: ListRow[]): string => {
 if (!rows.length) return t.command.listEmpty();

 const lines = [t.command.listTitle({ count: String(rows.length) })];
 let shown = 0;

 for (const row of rows) {
  const line = listLine(t, row);
  if (lines.join('\n').length + line.length + 1 > listBudget) break;
  lines.push(line);
  shown += 1;
 }

 const more = rows.length - shown;
 return [...lines, ...(more > 0 ? [t.command.listMore({ count: String(more) })] : [])].join('\n');
};

const list: SubcommandHandler = async function (cmd, options) {
 const guildId = cmd.guild_id!;
 const roles = cmd.member?.roles ?? [];
 const t = await this.t(guildId);
 const isStaff = (settings: TicketSetting) => isSettingsStaff(settings, actorOf(cmd), roles);

 const systems = await this.client.db.client.ticketSetting.findMany({ where: { guild: guildId } });
 if (!systems.some(isStaff)) {
  showCommandError.call(this.client, t.command.notStaff(), cmd, t.base);
  return;
 }

 const userId = optionValue(options, TicketCommandOption.User);
 const rows = await this.client.db.client.ticket.findMany({
  where: {
   settings: { guild: guildId },
   state: { in: openStates },
   ...(userId ? { user: userId } : {}),
  },
  include: { settings: true },
 });

 await new MessagePayload(this.client, { origin: this.name, reason: 'Listing open tickets' })
  .setContent(listText(t, rows.filter((row) => isStaff(row.settings)).sort(byUrgency)))
  .setAllowedMentionsUsers([])
  .setAllowedMentionsRoles([])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

const subcommands: Record<TicketSubcommand, SubcommandHandler> = {
 [TicketSubcommand.Open]: open,
 [TicketSubcommand.Claim]: delegate(claim),
 [TicketSubcommand.Unclaim]: delegate(unclaim),
 [TicketSubcommand.Take]: delegate(take),
 [TicketSubcommand.Escalate]: escalateCommand,
 [TicketSubcommand.Close]: delegate(close),
 [TicketSubcommand.Delete]: delegate(del),
 [TicketSubcommand.Add]: add,
 [TicketSubcommand.Remove]: remove,
 [TicketSubcommand.Priority]: priority,
 [TicketSubcommand.Info]: info,
 [TicketSubcommand.List]: list,
};

export default async function (this: TicketPlugin, cmd: ChatInput) {
 if (!cmd.guild_id || !cmd.member) return;

 const [sub] = cmd.data.options ?? [];
 if (sub?.type !== ApplicationCommandOptionType.Subcommand) return;

 await subcommands[sub.name as TicketSubcommand]?.call(this, cmd, sub.options ?? []);
}
