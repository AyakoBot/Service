import {
 ApplicationCommandType,
 ComponentType,
 InteractionType,
 type APIApplicationCommandAutocompleteInteraction,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIModalSubmitInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import {
 findFocusedOption,
 getGroupSubcommand,
 getStringOption,
 getSubcommand,
} from '../../../../Util/interactionOptions.js';
import Giveaway from '../../Classes/Giveaway.js';
import { parsePanelArgs } from '../../Classes/PrizePanel.js';
import {
 commandName,
 GiveawayGroup,
 GiveawayOption,
 GiveawaysRoute,
 GiveawayStartSub,
 GiveawaySub,
} from '../../Classes/Routes.js';
import type GiveawaysPlugin from '../../Plugin.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;
type SlashHandler = (
 plugin: GiveawaysPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 sub: Sub,
) => Promise<unknown>;
type AutocompleteHandler = (
 plugin: GiveawaysPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) => Promise<void>;
type ButtonHandler = (
 plugin: GiveawaysPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) => Promise<unknown>;

const autocompleteHandlers: Partial<Record<GiveawayOption, AutocompleteHandler>> = {
 [GiveawayOption.MessageId]: Giveaway.autocomplete,
 [GiveawayOption.Template]: (plugin, cmd) => plugin.templates.autocomplete(cmd),
};

const messageOp =
 (
  op: (
   giveaway: Giveaway,
   cmd: APIChatInputApplicationCommandInteraction,
   sub: Sub,
  ) => Promise<unknown>,
 ): SlashHandler =>
 async (plugin, cmd, sub) => {
  const messageId = getStringOption(sub, GiveawayOption.MessageId);
  if (!messageId || !cmd.guild_id || !cmd.member) return;

  await op(new Giveaway(plugin, messageId, cmd.guild_id), cmd, sub);
 };

const subHandlers: Record<GiveawaySub, SlashHandler> = {
 [GiveawaySub.Quick]: (plugin, cmd, sub) => plugin.launcher.quick(cmd, sub),
 [GiveawaySub.List]: (plugin, cmd) => Giveaway.list(plugin, cmd),
 [GiveawaySub.End]: messageOp((giveaway, cmd) => giveaway.end(cmd)),
 [GiveawaySub.Edit]: messageOp((giveaway, cmd, sub) => giveaway.edit(cmd, sub)),
 [GiveawaySub.Reroll]: messageOp((giveaway, cmd) => giveaway.reroll(cmd)),
 [GiveawaySub.Cancel]: messageOp((giveaway, cmd) => giveaway.cancel(cmd)),
 [GiveawaySub.Prizes]: messageOp((giveaway, cmd) => giveaway.openPrizes(cmd)),
};

const startHandlers: Record<GiveawayStartSub, SlashHandler> = {
 [GiveawayStartSub.Default]: (plugin, cmd, leaf) => plugin.launcher.quick(cmd, leaf),
 [GiveawayStartSub.FromTemplate]: (plugin, cmd, leaf) => plugin.launcher.fromTemplate(cmd, leaf),
};

const groupHandlers: Record<GiveawayGroup, SlashHandler> = {
 [GiveawayGroup.Start]: async (plugin, cmd, leaf) => {
  await startHandlers[leaf.name as GiveawayStartSub]?.(plugin, cmd, leaf);
 },
};

const panelButton =
 (
  op: (
   plugin: GiveawaysPlugin,
   cmd: APIMessageComponentInteraction,
   target: NonNullable<ReturnType<typeof parsePanelArgs>>,
  ) => Promise<unknown>,
 ): ButtonHandler =>
 async (plugin, cmd, args) => {
  const target = parsePanelArgs(args);
  if (target) await op(plugin, cmd, target);
 };

const buttonHandlers: Partial<Record<GiveawaysRoute, ButtonHandler>> = {
 [GiveawaysRoute.Participate]: (plugin, cmd) =>
  new Giveaway(plugin, cmd.message.id, cmd.guild_id ?? '').participate(cmd),
 [GiveawaysRoute.Claim]: (plugin, cmd) =>
  new Giveaway(plugin, cmd.message.id, cmd.guild_id ?? '').claim(cmd),
 [GiveawaysRoute.Reroll]: async (plugin, cmd, [messageId]) => {
  if (messageId) await new Giveaway(plugin, messageId, cmd.guild_id ?? '').reroll(cmd);
 },
 [GiveawaysRoute.List]: (plugin, cmd, [page]) => Giveaway.listPage(plugin, cmd, Number(page)),
 [GiveawaysRoute.Due]: async (plugin, cmd, [templateId]) => {
  if (templateId) await plugin.panel.due(cmd, templateId);
 },
 [GiveawaysRoute.PanelEdit]: panelButton((plugin, cmd, target) => plugin.panel.edit(cmd, target)),
 [GiveawaysRoute.PanelStart]: panelButton((plugin, cmd, target) => plugin.panel.start(cmd, target)),
};

type GuardedInteraction =
 | APIChatInputApplicationCommandInteraction
 | APIMessageComponentInteraction
 | APIModalSubmitInteraction;

const runGuarded = async function (
 this: GiveawaysPlugin,
 cmd: GuardedInteraction,
 op: () => Promise<unknown>,
) {
 const guildId = cmd.guild_id;
 if (!guildId) return;

 try {
  await op();
 } catch (error) {
  ephemeralNote.call(this, cmd, await this.errorText(guildId, error as Error));
 }
};

const command = async function (this: GiveawaysPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;
 const chat = cmd as APIChatInputApplicationCommandInteraction;
 if (chat.data.name !== commandName) return;

 const group = getGroupSubcommand(chat);
 if (group) {
  const groupName = chat.data.options?.[0]?.name as GiveawayGroup;
  const handler = groupHandlers[groupName];
  if (handler) await runGuarded.call(this, chat, () => handler(this, chat, group));
  return;
 }

 const sub = getSubcommand(chat);
 if (!sub) return;

 const handler = subHandlers[sub.name as GiveawaySub];
 if (!handler) return;

 await runGuarded.call(this, chat, () => handler(this, chat, sub));
};

const component = async function (this: GiveawaysPlugin, cmd: APIMessageComponentInteraction) {
 const [route, ...args] = cmd.data.custom_id.split('_');
 if (!cmd.guild_id || !cmd.member) return;

 if (cmd.data.component_type === ComponentType.StringSelect) {
  if (route !== GiveawaysRoute.RerollCount || !args[0]) return;

  await runGuarded.call(this, cmd, () =>
   new Giveaway(this, args[0], cmd.guild_id as string).rerollCount(
    cmd as APIMessageComponentSelectMenuInteraction,
   ),
  );
  return;
 }

 if (cmd.data.component_type !== ComponentType.Button) return;

 const handler = buttonHandlers[route as GiveawaysRoute];
 if (handler) await runGuarded.call(this, cmd, () => handler(this, cmd, args));
};

const modal = async function (this: GiveawaysPlugin, cmd: APIModalSubmitInteraction) {
 const [route, ...args] = cmd.data.custom_id.split('_');
 const guildId = cmd.guild_id;
 if (!guildId) return;

 if (route === GiveawaysRoute.Prizes && args[0]) {
  await runGuarded.call(this, cmd, () => new Giveaway(this, args[0], guildId).savePrizes(cmd));
  return;
 }

 const target = route === GiveawaysRoute.PanelSave ? parsePanelArgs(args) : null;
 if (target) await runGuarded.call(this, cmd, () => this.panel.save(cmd, target));
};

export default async function (
 this: GiveawaysPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   command.call(this, cmd);
   break;
  case InteractionType.ApplicationCommandAutocomplete: {
   if (cmd.data.name !== commandName) break;

   const focused = findFocusedOption(cmd.data.options)?.name as GiveawayOption;
   const run = autocompleteHandlers[focused];
   if (run) run(this, cmd);
   break;
  }
  case InteractionType.MessageComponent:
   component.call(this, cmd);
   break;
  case InteractionType.ModalSubmit:
   modal.call(this, cmd);
   break;
  default:
   break;
 }
}
