import {
 ApplicationCommandType,
 InteractionType,
 type APIApplicationCommandInteraction,
 type APIApplicationCommandInteractionDataSubcommandOption,
 type APIChatInputApplicationCommandInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { getStringOption, getSubcommand } from '../../../../Util/interactionOptions.js';
import Reminder from '../../Classes/Reminder.js';
import { commandName, ReminderOption, ReminderSub } from '../../Classes/Routes.js';
import type RemindersPlugin from '../../Plugin.js';

type Sub = APIApplicationCommandInteractionDataSubcommandOption;
type Translator = Awaited<ReturnType<RemindersPlugin['t']>>;

export default async function (
 this: RemindersPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   command.call(this, cmd);
   break;
  case InteractionType.ApplicationCommandAutocomplete:
   if (cmd.data.name === commandName) Reminder.autocomplete(this, cmd);
   break;
  default:
   break;
 }
}

const showError = function (
 this: RemindersPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 t: Translator,
 error: Error,
) {
 if (Object.keys(t.errors).includes(error.message)) {
  ephemeralNote.call(this, cmd, t.errors[error.message as keyof typeof t.errors]());
  return;
 }

 this.nonFatalError(error, 'reminderError');
 ephemeralNote.call(this, cmd, t.base.errors.unknownError());
};

const run = async function (
 this: RemindersPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 op: () => Promise<unknown>,
) {
 const t = await this.t(cmd.guild_id ?? null);

 try {
  await op();
 } catch (error) {
  showError.call(this, cmd, t, error as Error);
 }
};

const fromId = function (
 this: RemindersPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
 sub: Sub,
) {
 const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';
 const startTime = parseInt(getStringOption(sub, ReminderOption.Id), 36) || 0;
 return new Reminder(this, userId, startTime);
};

const command = async function (this: RemindersPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.ChatInput) return;
 const chat = cmd as APIChatInputApplicationCommandInteraction;
 if (chat.data.name !== commandName) return;

 const sub = getSubcommand(chat);
 if (!sub) return;

 switch (sub.name as ReminderSub) {
  case ReminderSub.Create:
   run.call(this, chat, () => Reminder.create(this, chat, sub));
   break;
  case ReminderSub.List:
   Reminder.list(this, chat);
   break;
  case ReminderSub.Edit:
   run.call(this, chat, () => fromId.call(this, chat, sub).edit(chat, sub));
   break;
  case ReminderSub.Delete:
   run.call(this, chat, () => fromId.call(this, chat, sub).delete(chat));
   break;
  default:
   break;
 }
};
