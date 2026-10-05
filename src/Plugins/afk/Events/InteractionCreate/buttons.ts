import { RequestHandlerError } from '@ayako/api';
import {
 ComponentType,
 MessageFlags,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import Afk from '../../Classes/Afk.js';
import { AfkRoute } from '../../Enums.js';
import type AFKPlugin from '../../Plugin.js';

type ButtonHandler = (
 this: AFKPlugin,
 cmd: APIMessageComponentInteraction,
 guildId: string,
 userId: string,
) => Promise<void>;

const restore: ButtonHandler = async function (cmd, guildId, userId) {
 await new Afk(this, userId, guildId).restore(cmd);
};

const dmPings: ButtonHandler = async function (cmd, guildId, userId) {
 const t = await this.t(guildId);
 const api = await this.getAPI(guildId);
 const meta = { origin: this.name, reason: 'Send the AFK ping summary' };
 const containers = cmd.message.components?.filter(
  (component) => component.type === ComponentType.Container,
 );

 const dm = await api.users.createDM(userId, meta);
 const sent =
  dm instanceof RequestHandlerError
   ? dm
   : await api.channels.createDirectMessage(
      dm.id,
      {
       components: containers ?? [],
       flags: MessageFlags.IsComponentsV2,
       allowed_mentions: { parse: [] },
      },
      meta,
     );

 ephemeralNote.call(this, cmd, sent instanceof RequestHandlerError ? t.t.dmFailed() : t.t.dmSent());
};

const handlers: Record<AfkRoute, ButtonHandler> = {
 [AfkRoute.Restore]: restore,
 [AfkRoute.DmPings]: dmPings,
};

export default async function (this: AFKPlugin, cmd: APIMessageComponentInteraction) {
 const [route, userId] = cmd.data.custom_id.split('_');
 const handler = handlers[route as AfkRoute];
 if (!handler || !userId || !cmd.guild_id) return;

 const clicker = cmd.member?.user.id ?? cmd.user?.id;
 if (clicker !== userId) {
  ephemeralNote.call(this, cmd, (await this.t(cmd.guild_id)).t.notYours({ user: userId }));
  return;
 }

 await handler.call(this, cmd, cmd.guild_id, userId);
}
