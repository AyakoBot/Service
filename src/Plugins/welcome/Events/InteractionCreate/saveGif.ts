import {
 ApplicationCommandType,
 type APIApplicationCommandInteraction,
 type APIMessageApplicationCommandInteraction,
} from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import type { GreetingKind } from '../../Classes/Enums.js';
import type WelcomePlugin from '../../Plugin.js';
import { hasPendingEmbed, saveGifs } from '../../Util/gifPool.js';

export default async function (
 this: WelcomePlugin,
 cmd: APIApplicationCommandInteraction,
 kind: GreetingKind,
) {
 if (!cmd.guild_id || !cmd.member) return;
 if (cmd.data.type !== ApplicationCommandType.Message) return;

 const t = await this.t(cmd.guild_id);
 if (!hasManageGuild(cmd.member.permissions)) {
  ephemeralNote.call(this, cmd, t.errors.manageGuildRequired());
  return;
 }

 const { data } = cmd as APIMessageApplicationCommandInteraction;
 const message = data.resolved.messages[data.target_id];
 if (!message) return;

 const { found, added } = await saveGifs.call(this, cmd.guild_id, kind, message);
 if (!found) {
  ephemeralNote.call(
   this,
   cmd,
   hasPendingEmbed(message) ? t.gifs.embedPending() : t.gifs.noneFound(),
  );
  return;
 }

 ephemeralNote.call(
  this,
  cmd,
  added ? t.gifs.saved({ count: String(added) }) : t.gifs.alreadySaved(),
 );
}
