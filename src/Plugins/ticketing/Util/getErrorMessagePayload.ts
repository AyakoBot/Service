import {
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
} from '@discordjs/builders';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import type Client from '../../../Classes/Client.js';
import { Colors } from '../../../Types/index.js';

export default function (
 this: Client,
 t: BaseLang,
 error: string,
 debugInfo: { origin: string; reason: string },
) {
 return new MessagePayload(this, debugInfo).setComponents([
  new ContainerBuilder()
   .setAccentColor(Colors.Danger)
   .addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${t.t.error()}\n-# ${error}`),
     )
     .setThumbnailAccessory(
      new ThumbnailBuilder()
       .setURL('https://cdn.ayakobot.com/Ayako_Assets/Warning.png')
       .setDescription(t.t.error()),
     ),
   )
   .toJSON(),
 ]);
}
