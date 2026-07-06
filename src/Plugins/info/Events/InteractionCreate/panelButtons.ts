import { txtFileWriter } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { MessageFlags, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { RolesTarget } from '../../Classes/Routes.js';
import type InfoPlugin from '../../Plugin.js';
import { chunkByLength } from '../../Util/fmt.js';
import { respond, respondError, type Translator } from '../../Util/respond.js';

const mentionCap = 100;

const simpleContainer = (title: string, body: string): ContainerBuilder =>
 new ContainerBuilder()
  .setAccentColor(Colors.Ephemeral)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${body}`));

export const rolesButton = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const [target, id] = args;
 if (!id) return;

 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const roles =
  target === RolesTarget.Member
   ? await Promise.all(
      ((await this.client.cache.members.get(cmd.guild_id, id))?.roles ?? []).map((roleId) =>
       this.client.cache.roles.get(roleId),
      ),
     )
   : await this.client.cache.roles.getAll(cmd.guild_id);

 const sorted = roles
  .filter((role): role is NonNullable<typeof role> => Boolean(role))
  .sort((a, b) => b.position - a.position);

 if (!sorted.length) {
  respondError.call(this, cmd, t.rolesList.none());
  return;
 }

 const title =
  target === RolesTarget.Member
   ? t.rolesList.memberTitle({ user: `<@${id}>` })
   : t.rolesList.serverTitle();

 respond.call(
  this,
  cmd,
  [
   simpleContainer(
    `${textEmote(emotes.role)} ${title} (\`${sorted.length}\`)`,
    chunkByLength(sorted.map((role) => `<@&${role.id}>`))[0],
   ),
  ],
  true,
 );
};

export const membersButton = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 const [roleId] = args;
 if (!roleId) return;

 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);
 const emotes = this.client.emojis.for(api);

 const members = (await this.client.cache.members.getAll(cmd.guild_id)).filter((member) =>
  member.roles.includes(roleId),
 );
 if (!members.length) {
  respondError.call(this, cmd, t.members.none());
  return;
 }

 const mentions = members.slice(0, mentionCap).map((member) => `<@${member.user_id}>`);
 const container = simpleContainer(
  `${textEmote(emotes.member)} ${t.members.title({ role: `<@&${roleId}>` })} (\`${members.length}\`)`,
  `${mentions.join(' ')}${members.length > mentionCap ? `\n-# ${t.members.file()}` : ''}`,
 );

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Role members panel',
 })
  .setAllowedMentionsUsers([])
  .setAllowedMentionsRoles([])
  .setComponents([container.toJSON()])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);

 if (members.length > mentionCap) {
  payload.setFiles([txtFileWriter(members.map((member) => member.user_id).join('\n'), 'Members')]);
 }

 payload.reply(cmd);
};

export const featuresButton = async function (
 this: InfoPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [guildId] = args;
 if (!guildId) return;

 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const api = cmd.guild_id ? await this.getAPI(cmd.guild_id) : this.client.getBaseAPI();
 const emotes = this.client.emojis.for(api);

 const guild = await this.client.cache.guilds.get(guildId);
 if (!guild) {
  respondError.call(this, cmd, t.errors.serverNotFound());
  return;
 }

 const lines = guild.features.map(
  (feature) =>
   `${textEmote(emotes.enabled)} \`${feature}\`\n> ${featureDescription(t, feature)}`,
 );
 if (!lines.length) {
  respondError.call(this, cmd, t.errors.nothingHere());
  return;
 }

 const chunks = chunkByLength(lines);

 respond.call(
  this,
  cmd,
  [
   simpleContainer(
    `${textEmote(emotes.settings)} ${t.base.t.featuresName()} (\`${guild.features.length}\`)`,
    `${chunks[0]}${
     chunks.length > 1
      ? `\n-# ${t.features.more({ count: String(guild.features.length) })}`
      : ''
    }`,
   ),
  ],
  true,
 );
};

const featureDescription = (t: Translator, feature: string): string => {
 const lookup = (t.base.features as unknown as Record<string, () => string>)[feature];
 return lookup ? lookup() : t.base.t.Unknown();
};
