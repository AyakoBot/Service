import * as Discord from 'discord.js';
import ms from 'ms';
import util from 'util';
import * as CT from '../../../../Typings/Typings.js';

// eslint-disable-next-line  @typescript-eslint/no-unused-expressions
ms;
// eslint-disable-next-line  @typescript-eslint/no-unused-expressions
CT;
// eslint-disable-next-line  @typescript-eslint/no-unused-expressions
Discord;

const reg = new RegExp(
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? '',
 'g',
);

// eslint-disable-next-line no-console
const { log } = console;

export default async (msg: RMessage) => {
 if (msg.author.id !== process.env.ownerId) return;
 if (!msg.content.startsWith('eval')) return;

 const args = msg.content.split(/\s+/g);
 args.shift();
 const code = `${args.slice(0).join(' ')}`;

 try {
  // eslint-disable-next-line no-eval
  let evaled = code.includes('await') ? await eval(`(async () => {${code}})()`) : eval(code);
  if (typeof evaled !== 'string') evaled = util.inspect(evaled);

  if (evaled.length > 2000) {
   msg.client.util.replyMsg(msg, { files: [msg.client.util.txtFileWriter(clean(evaled))] });
   log(clean(evaled));
   return;
  }
  if (clean(evaled) !== '"undefined"') {
   msg.client.util.replyMsg(msg, {
    content: `\n${msg.client.util.util.makeCodeBlock(`js\n${clean(evaled)}`)}`,
   });
   log(clean(evaled));
   return;
  }

  msg.client.util.request.channels.addReaction(
   msg,
   msg.client.util.constants.standard.getEmoteIdentifier(msg.client.util.emotes.cross),
  );
 } catch (err) {
  if (clean(err).length > 2000) {
   msg.client.util.replyMsg(msg, { files: [msg.client.util.txtFileWriter(clean(err))] });
   log(clean(err));
   return;
  }

  if (clean(err) !== '"undefined"') {
   msg.client.util.replyMsg(msg, {
    content: `\`ERROR\` \n${msg.client.util.util.makeCodeBlock(
     `js\n${clean((err as Error).message)}`,
    )}\n`,
   });
   log(clean(err));
   return;
  }

  msg.client.util.request.channels.addReaction(
   msg,
   msg.client.util.constants.standard.getEmoteIdentifier(msg.client.util.emotes.cross),
  );
 }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clean = (text: unknown): any =>
 JSON.parse(
  JSON.stringify(text, null, 2)
   .replace(/`/g, `\`${String.fromCharCode(8203)}`)
   .replace(/@/g, `@${String.fromCharCode(8203)}`)
   .replace(reg, 'TOKEN'),
 );
