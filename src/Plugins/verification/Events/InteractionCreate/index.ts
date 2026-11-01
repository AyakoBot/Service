import {
 ComponentType,
 InteractionType,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
 type GatewayDispatchEvents,
} from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { VerificationRoute } from '../../Classes/Routes.js';
import Verification from '../../Classes/Verification.js';
import type VerificationPlugin from '../../Plugin.js';

export default async function (
 this: VerificationPlugin,
 cmd: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
) {
 switch (cmd.type) {
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

const component = async function (this: VerificationPlugin, cmd: APIMessageComponentInteraction) {
 if (cmd.data.component_type !== ComponentType.Button) return;
 if (!cmd.guild_id) return;
 const [route] = cmd.data.custom_id.split('_');

 switch (route) {
  case VerificationRoute.Verify:
   run.call(this, cmd, (v) => v.startCaptcha(cmd));
   break;
  case VerificationRoute.EnterCode:
   run.call(this, cmd, (v) => v.openModal(cmd));
   break;
  case VerificationRoute.PostPanel:
   run.call(this, cmd, (v) => v.postPanel(cmd), false);
   break;
  default:
   break;
 }
};

const modal = async function (this: VerificationPlugin, cmd: APIModalSubmitInteraction) {
 if (!cmd.guild_id) return;
 const [route] = cmd.data.custom_id.split('_');
 if (route !== VerificationRoute.Submit) return;

 run.call(this, cmd, (v) => v.submit(cmd));
};

const run = async function (
 this: VerificationPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 op: (verification: Verification) => Promise<unknown>,
 activeOnly = true,
) {
 if (!cmd.guild_id) return;

 const verification = await Verification.fetch(this, cmd.guild_id, activeOnly);
 if (!verification) {
  const t = await this.t(cmd.guild_id);
  ephemeralNote.call(this, cmd, t.errors.notEnabled());
  return;
 }

 await op(verification).catch((e: Error) => this.nonFatalError(e, 'verification interaction'));
};
