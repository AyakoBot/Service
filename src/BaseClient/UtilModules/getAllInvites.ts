import * as Discord from 'discord.js';
import { request } from './requestHandler.js';
import getBotMemberFromGuild from './getBotMemberFromGuild.js';

/**
 * Retrieves all the invites for a given guild.
 * @param guild - The guild to retrieve invites for.
 * @returns A promise that resolves to an array of invites for the guild.
 */
export default async (guild: RGuild) => {
 const { cache } = guild.invites;

 const me = await getBotMemberFromGuild(guild);
 if (me.permissions.has(PermissionFlagsBits.ManageGuild)) return cache.map((i) => i);

 await request.guilds.getInvites(guild);
 if (!guild.vanityURLCode) return cache.map((i) => i);

 await request.guilds.getVanityURL(guild);
 return cache.map((i) => i);
};
