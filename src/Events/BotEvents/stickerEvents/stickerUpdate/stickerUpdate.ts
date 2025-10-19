import type * as Discord from 'discord.js';
import log from './log.js';

export default async (oldSticker: RSticker, sticker: RSticker) => {
 if (!sticker.guild) return;

 log(oldSticker, sticker);
};
