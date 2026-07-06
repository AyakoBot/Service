import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type WelcomePlugin from '../../Plugin.js';
import { extractGifUrls } from '../../Util/gifPool.js';

export default async function (
 this: WelcomePlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (!data.guild_id) return;

 const row = await this.client.db.client.welcomeSetting.findUnique({
  where: { id: data.guild_id },
 });
 if (!row) return;
 if (![row.welcomeGifChannel, row.goodbyeGifChannel].includes(data.channel_id)) return;

 const urls = extractGifUrls(data);
 if (!urls.length) return;

 await this.client.db.client.welcomeGif.createMany({
  data: urls.map((url) => ({
   guild: data.guild_id as string,
   channel: data.channel_id,
   message: data.id,
   url,
  })),
  skipDuplicates: true,
 });
}
