import util from 'util';

import { txtFileWriter } from '@ayako/utility';
import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import type EvalPlugin from '../../Plugin.js';

const { log } = console;

export default async function (
 this: EvalPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (!msg.guild_id) return;

 const args = msg.content.split(/\s+/g);
 args.shift();
 const code = `${args.slice(0).join(' ')}`;
 const api = await this.getAPI(msg.guild_id);

 try {
  let evaled =
   code.includes('await') || code.includes('return')
    ? await eval(`(async () => {${code}})()`)
    : eval(code);
  if (typeof evaled !== 'string') evaled = util.inspect(evaled);

  if (evaled.length > 2000) {
   new MessagePayload(this.client, {
    origin: this.name,
    reason: 'Eval output too long, sending as file',
   })
    .addFiles(txtFileWriter(evaled, `eval-${Date.now()}.txt`))
    .setReply(msg.id)
    .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id || '@me' }])
    .setReply(msg.id)
    .send();

   log(evaled);
   return;
  }
  if (evaled !== '"undefined"') {
   new MessagePayload(this.client, {
    origin: this.name,
    reason: 'Eval output',
   })
    .setContent(`\n\`\`\`${`js\n${evaled}`}\`\`\``)
    .setReply(msg.id)
    .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id || '@me' }])
    .send();

   log(evaled);
   return;
  }

  api.channels.addMessageReaction(
   msg.guild_id,
   msg.channel_id,
   msg.id,
   { main: constants.formatters.getEmoteIdentifier(emotes.cross), alt: '❌' },
   { origin: this.name, reason: 'Eval returned undefined' },
  );
 } catch (e) {
  const err = e as string;
  if (err.length > 2000) {
   new MessagePayload(this.client, {
    origin: this.name,
    reason: 'Eval error output too long, sending as file',
   })
    .addFiles(txtFileWriter(err, `eval-error-${Date.now()}.txt`))
    .setReply(msg.id)
    .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id || '@me' }])
    .send();

   log(err);
   return;
  }

  if (err !== '"undefined"') {
   new MessagePayload(this.client, {
    origin: this.name,
    reason: 'Eval error output',
   })
    .setContent(`\n\`\`\`${`js\n${err}`}\`\`\``)
    .setReply(msg.id)
    .setSendTo([{ channel: msg.channel_id, guildId: msg.guild_id || '@me' }])
    .send();

   log(err);
   return;
  }

  api.channels.addMessageReaction(
   msg.guild_id,
   msg.channel_id,
   msg.id,
   { main: constants.formatters.getEmoteIdentifier(emotes.cross), alt: '❌' },
   { origin: this.name, reason: 'Eval returned undefined' },
  );
 }
}
