import type { APIMessageComponentInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import type { GreetingKind } from '../../Classes/Enums.js';
import type WelcomePlugin from '../../Plugin.js';
import sendGreeting from '../../Util/sendWelcome.js';

export default async function (
 this: WelcomePlugin,
 cmd: APIMessageComponentInteraction,
 kind: GreetingKind,
) {
 if (!cmd.guild_id || !cmd.member) return;

 const t = await this.t(cmd.guild_id);
 if (!hasManageGuild(cmd.member.permissions)) {
  ephemeralNote.call(this, cmd, t.errors.manageGuildRequired());
  return;
 }

 const sent = await sendGreeting.call(this, kind, cmd.guild_id, cmd.member.user, true);
 ephemeralNote.call(this, cmd, sent ? t.settings.test.sent() : t.settings.test.failed());
}
