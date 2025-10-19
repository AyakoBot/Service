import type * as Discord from 'discord.js';
import log from './log.js';

export default async (sticker: RSticker) => {
 if (!sticker.guild) return;

 log(sticker);
};
