import * as Discord from 'discord.js';

export const requiresSlashCommand = true;
export default (msg: RMessage) => msg.client.util.interactionHelpers(msg);
