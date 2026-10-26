import type { Giveaway } from '@ayako/database';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { coalesceMs, origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';

import { resolveSurface } from './resolveSurface.js';

const pending = new Map<string, NodeJS.Timeout>();

const write = async function (this: GiveawaysPlugin, giveaway: Giveaway) {
 const surface = await resolveSurface.call(this, giveaway);

 await new MessagePayload(this.client, { origin, reason: 'Updating giveaway' })
  .setFlags(surface.flags)
  .setContent(surface.content)
  .setEmbeds(surface.embeds)
  .setComponents(surface.components)
  .edit(giveaway.channel, giveaway.message, giveaway.guild, await this.api(giveaway.guild));
};

export const cancelRender = (messageId: string) => {
 const timer = pending.get(messageId);
 if (!timer) return;

 clearTimeout(timer);
 pending.delete(messageId);
};

export const renderSoon = function (this: GiveawaysPlugin, messageId: string) {
 if (pending.has(messageId)) return;

 const timer = setTimeout(() => {
  pending.delete(messageId);

  this.client.db.client.giveaway
   .findUnique({ where: { message: messageId } })
   .then((row) => (row ? write.call(this, row) : undefined))
   .catch((e: Error) => this.nonFatalError(e, 'coalescedRender'));
 }, coalesceMs);

 pending.set(messageId, timer);
};

export default async function renderGiveaway(this: GiveawaysPlugin, giveaway: Giveaway) {
 cancelRender(giveaway.message);

 await write.call(this, giveaway);
}
