import {
 ComponentType,
 InteractionType,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { snowflakeToMs } from '../../../../Util/snowflakeToMs.js';
import { BumpRemindersRoute } from '../../Classes/Routes.js';
import type BumpRemindersPlugin from '../../Plugin.js';

const unlockDelayMs = 60000;

export default async function (
 this: BumpRemindersPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 if (cmd.type !== InteractionType.MessageComponent) return;
 if (cmd.data.component_type !== ComponentType.Button) return;
 if (!cmd.guild_id || !cmd.channel || !cmd.message) return;

 const [route, settingsId] = cmd.data.custom_id.split('_');
 if (route !== BumpRemindersRoute.Bumped || !settingsId?.length) return;

 const t = await this.t(cmd.guild_id);

 const created = snowflakeToMs(cmd.message.id);
 const unlocksAt = created ? created + unlockDelayMs : 0;
 if (unlocksAt > Date.now()) {
  ephemeralNote.call(this, cmd, t.tooEarly({ unlock: `<t:${Math.floor(unlocksAt / 1000)}:R>` }));
  return;
 }

 const setting = await this.bumps.byId(settingsId, cmd.guild_id);
 if (!setting || !setting.active) {
  ephemeralNote.call(this, cmd, t.errors.notEnabled());
  return;
 }

 ephemeralNote.call(this, cmd, t.marked());
 await this.bumps
  .bumped(setting, cmd.channel.id, cmd.message.id)
  .catch((e: Error) => this.nonFatalError(e, 'bump button'));
}
