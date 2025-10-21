import { PermissionFlagsBits } from '@discordjs/core';
import { api as API } from '../../../Client.js';
import DataBase from '../../../DataBase.js';

import cache from '../../cache.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandler from '../../requestHandler.js';
import requestHandlerError from '../../requestHandlerError.js';
import resolvePartialEmoji from '../../resolvePartialEmoji.js';
import type { DiscordAPIError } from '@discordjs/rest';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Adds a reaction to a message.
 * @param msg The message to add the reaction to.
 * @param emoji The emoji to add as a reaction.
 * @returns A Promise that resolves with the DiscordAPIError if the reaction could not be added.
 */
export default async (msg: RMessage, emoji: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!isReactable(msg, emoji, (await getBotMemberFromGuild(msg.guild_id)).user_id)) {
  const e = requestHandlerError(`Cannot apply ${emoji} as reaction in ${msg.channel_id}`, [
   PermissionFlagsBits.AddReactions,
   PermissionFlagsBits.ReadMessageHistory,
   ...(emoji.includes(':') ? [PermissionFlagsBits.UseExternalEmojis] : []),
  ]);

  error(msg.guild_id, e);
  return e;
 }

 if (await hasBlocked(msg.author_id)) return undefined;

 const resolvedEmoji = resolvePartialEmoji(emoji);
 if (!resolvedEmoji) {
  const e = requestHandlerError(`Invalid Emoji ${emoji}`, []);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .addMessageReaction(
   msg.channel_id,
   msg.id,
   resolvedEmoji.id
    ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
    : (resolvedEmoji.name as string),
  )
  .catch((e: DiscordAPIError) => {
   if (msg.author_id) saveBlocked(e.message, msg.author_id);

   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if a message is reactable by a given user.
 * @param msg - The message to check.
 * @param emoji - The emoji to add as a reaction.
 * @param me - The guild member representing the user.
 * @returns A boolean indicating whether the message is reactable.
 */
export const isReactable = async (msg: RMessage, emoji: string, userId: string) =>
 (await checkChannelPermissions(
  msg.guild_id,
  msg.channel_id,
  ['AddReactions', 'ReadMessageHistory'],
  userId,
 )) &&
 (emoji.includes(':')
  ? await checkChannelPermissions(msg.guild_id, msg.channel_id, ['UseExternalEmojis'], userId)
  : true);

/**
 * Checks if the user has blocked the bot.
 *
 * @param userId - The user Id.
 * @returns A boolean indicating whether the user has blocked the bot.
 */
const hasBlocked = async (userId: string) => {
 const u = await DataBase.blockingUsers.findUnique({ where: { userId } });

 if (!u) return false;

 if (Number(u.created) < Date.now() - 2592000000) {
  DataBase.blockingUsers.delete({ where: { userId } }).then();

  return false;
 }

 return true;
};

/**
 * Saves the blocked reaction error and updates the blocking user in the database.
 *
 * @param error - The error message.
 * @param user - The user who triggered the error.
 */
const saveBlocked = async (err: string, userId: string) => {
 if (!err.includes('Reaction blocked')) return;

 DataBase.blockingUsers
  .upsert({
   where: { userId },
   create: { userId, created: Date.now() },
   update: { created: Date.now() },
  })
  .then();
};

const getTokenFromGuild = (guildId: string) =>
 DataBase.customclients
  .findUnique({
   where: { guildid: guildId, token: { not: null } },
   select: { token: true },
  })
  .then((c) => c?.token!);

export const getAPI = async (guildId: string | undefined | null) => {
 if (!guildId) return API;

 const api = (((await getBotMemberFromGuild(guildId)) && cache.apis.get(guildId)) ?? null) || null;
 if (api) return api;

 const token = await getTokenFromGuild(guildId);
 if (!token) return API;

 const newApi = await requestHandler(guildId, token);
 return newApi ? cache.apis.get(guildId) || API : API;
};
