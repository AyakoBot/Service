import type * as Discord from 'discord.js';
import client from '../../../../BaseClient/Client.js';
import * as CT from '../../../../Typings/Typings.js';

export default async (msg: RMessage) => {
 rolePing(msg);
 banHandler(msg);
};

const banHandler = async (msg: RMessage) => {
 if (msg.author.id !== '868115102681956404') return;
 if (msg.channelId !== '757879586439823440') return;
 if (!msg.inGuild()) return;
 if (!msg.content.includes('@Known-Scammers ping:')) return;

 const isUnban = msg.content.includes('REMOVAL FROM LIST');
 const executor = await msg.client.util.getUser('646937666251915264');

 const ids = msg.content.match(/\d{17,19}/gm);
 if (!ids || !ids.length) return;

 ids.forEach(async (id) => {
  const user = await msg.client.util.getUser(id);
  if (!user) {
   const language = await msg.client.util.getLanguage(msg.guildId);
   msg.client.util.errorMsg(msg, language.errors.userNotFound, language);
   return;
  }

  const reasonArgs = msg.content.replace(/```/g, '').split(/:/);
  const reason = reasonArgs[reasonArgs.findIndex((c) => c.includes('Reason')) + 1];

  if (!msg.guildId) return;
  if (!client.user?.id) return;

  const modOptions: CT.ModOptions<CT.ModTypes.BanRemove> = {
   target: user,
   executor: executor || client.user,
   dbOnly: false,
   reason,
   guild: msg.guild,
   skipChecks: false,
  };

  msg.client.util.mod(undefined, isUnban ? CT.ModTypes.BanRemove : CT.ModTypes.BanAdd, modOptions);
 });
};

const rolePing = (msg: RMessage) => {
 if (!['808095830677782558', '757879586439823440'].includes(msg.channelId)) return;
 if (msg.author.id !== '646937666251915264n') return;

 const getRole = () => {
  if (msg.channelId === '757879586439823440') return '893986129773207582';
  if (msg.channelId === '808095830677782558') return '1059212168962257068';
  return undefined;
 };

 let content = '';
 const role = getRole();
 if (!role) return;

 if (msg.content.includes('since this server is currently active')) {
  content = `<@&${role}> Karuta has dropped Cards! Move or lose.`;
 }

 if (msg.content.includes('A card from your wishlist is dropping')) {
  content = `<@&${role}> a wished Card was dropped! Move or lose.`;
 }

 if (!content) return;

 msg.client.util.replyMsg(msg, { content, allowed_mentions: { roles: [role] } });
};
