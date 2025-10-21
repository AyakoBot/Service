import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (member: RMember) => {
 const channels = await member.client.util.getLogChannels('memberevents', member.guild);
 if (!channels) return;

 const language = await member.client.util.getLanguage(member.guild.id);
 const lan = language.events.logs.guild;
 const con = member.client.util.constants.events.logs.guild;

 const audit = member.user.bot
  ? await member.client.util.getAudit(member.guild, 28, member.id)
  : undefined;
 const auditUser = audit?.executor ?? undefined;
 let description = auditUser ? lan.descJoinAudit(member.user, auditUser) : undefined;

 if (!description) {
  description = member.user.bot ? lan.descBotJoin(member.user) : lan.descMemberJoin(member.user);
 }

 const embed: Discord.APIEmbed = {
  author: {
   icon_url: member.user.bot ? con.BotCreate : con.MemberCreate,
   name: member.user.bot ? lan.botJoin : lan.memberJoin,
  },
  description,
  fields: [],
  color: CT.Colors.Success,
  timestamp: new Date().toISOString(),
 };

 const usedInvite = await getUsedInvite(member.guild, member.user);
 if (usedInvite && typeof usedInvite !== 'boolean') {
  const inviter =
   usedInvite.inviter ??
   (usedInvite.inviterId ? await member.client.util.getUser(usedInvite.inviterId) : undefined);

  embed.fields?.push({
   name: lan.invite,
   value: language.languageFunction.getInviteDetails(
    usedInvite,
    inviter,
    usedInvite.channel ? language.channelTypes[usedInvite.channel.type] : undefined,
   ),
  });
 } else if (usedInvite) {
  embed.fields?.push({
   name: lan.invite,
   value: lan.discovery,
  });
 }

 const flagsText = new RMemberFlagsBitField(member.flags || 0)
  .toArray()
  .map((f) => lan.memberFlags[f])
  .filter((f): f is string => !!f)
  .map((f) => `\`${f}\``)
  .join(', ');

 if (flagsText?.length) {
  embed.fields?.push({
   name: lan.memberFlagsName,
   value: flagsText,
   inline: true,
  });
 }

 member.client.util.send({ id: channels, guildId: member.guild.id }, { embeds: [embed] }, 10000);
};

const getUsedInvite = async (guild: RGuild, user: RUser) => {
 if (user.bot) return undefined;

 const oldInvites = Array.from(guild.client.util.cache.invites.cache.get(guild.id) ?? [], ([, i]) =>
  Array.from(i, ([c, i2]) => ({ uses: i2.uses, code: c })),
 ).flat();
 const newInvites = await guild.client.util.request.guilds
  .getInvites(guild)
  .then((invites) => ('message' in invites ? undefined : invites.map((i) => i)));
 if (!newInvites) return undefined;

 const setInvites = () =>
  newInvites.forEach((i) => guild.client.util.cache.invites.set(i, guild.id));

 if (!oldInvites) {
  setInvites();
  return undefined;
 }

 const inv = oldInvites
  .map((oldInvite) => {
   const newInvite = newInvites.find((invite) => invite.code === oldInvite.code);
   if (newInvite && Number(oldInvite.uses) < Number(newInvite.uses)) return newInvite;
   return undefined;
  })
  .find((i): i is RInvite => !!i);

 setInvites();
 if (inv) return inv;

 const vanity = await guild.client.util.request.guilds.getVanityURL(guild);
 if (!vanity) return undefined;
 if ('message' in vanity) return undefined;

 guild.client.util.cache.invites.set(vanity, guild.id);
 const parsedVanity = vanity.code
  ? guild.client.util.cache.invites.find(vanity.code as string)
  : undefined;
 const changedVanity = oldInvites.find((i) => i.code === vanity?.code);
 if (Number(changedVanity?.uses) < Number(parsedVanity)) return parsedVanity;
 return true;
};
