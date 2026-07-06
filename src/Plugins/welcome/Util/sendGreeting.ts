import {
 ComponentType,
 MessageFlags,
 type APIEmbed,
 type APIMessageTopLevelComponent,
 type APIUser,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type { GreetingKind } from '../Classes/Enums.js';
import type WelcomePlugin from '../Plugin.js';

import { pickRandomGif } from './gifPool.js';
import { getGreetingConfig, type GreetingConfig } from './greetingConfig.js';
import interpolate from './interpolate.js';

type GreetingVars = {
 user: string;
 username: string;
 displayname: string;
 server: string;
 membercount: string;
 gif?: string;
};

type GreetingContent =
 | { embed: APIEmbed; components?: undefined }
 | { embed?: undefined; components: APIMessageTopLevelComponent[] };

const hasGifPlaceholder = (json: unknown) => /{{\s?gif\s?}}/.test(JSON.stringify(json));

const buildVars = async function (
 this: WelcomePlugin,
 guildId: string,
 user: APIUser,
 gif: string | null,
): Promise<GreetingVars> {
 const guild = await this.client.cache.guilds.get(guildId);

 return {
  user: `<@${user.id}>`,
  username: user.username,
  displayname: user.global_name ?? user.username,
  server: guild?.name ?? '',
  membercount: String(guild?.approximate_member_count ?? ''),
  ...(gif ? { gif } : {}),
 };
};

const resolveContent = async function (
 this: WelcomePlugin,
 guildId: string,
 config: GreetingConfig,
): Promise<GreetingContent | null> {
 if (config.components) {
  const saved = await this.client.db.client.customComponents.findFirst({
   where: { guild: guildId, name: config.components },
  });
  if (saved?.components) {
   return { components: saved.components as unknown as APIMessageTopLevelComponent[] };
  }
 }

 if (config.embed) {
  const saved = await this.client.db.client.customEmbed.findFirst({
   where: { guild: guildId, name: config.embed },
  });
  if (saved?.embed) return { embed: saved.embed as APIEmbed };
 }

 return null;
};

const buildPingContent = (config: GreetingConfig, user: APIUser) =>
 [
  config.pingJoin ? `<@${user.id}>` : '',
  config.pingRoles.map((r) => `<@&${r}>`).join(' '),
  config.pingUsers.map((u) => `<@${u}>`).join(' '),
 ]
  .filter((p) => p.length)
  .join('\n');

export default async function sendGreeting(
 this: WelcomePlugin,
 kind: GreetingKind,
 guildId: string,
 user: APIUser,
 force = false,
): Promise<boolean> {
 const row = await this.client.db.client.welcomeSetting.findUnique({ where: { id: guildId } });
 if (!row) return false;

 const config = getGreetingConfig(row, kind);
 if (!force && !config.active) return false;
 if (!config.channel) return false;

 const content = await resolveContent.call(this, guildId, config);
 const gif = config.gifChannel
  ? await pickRandomGif.call(this, guildId, config.gifChannel)
  : null;
 const vars = await buildVars.call(this, guildId, user, gif);
 const pings = buildPingContent(config, user);

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: `${kind} greeting`,
 })
  .setAllowedMentionsRoles(config.pingRoles)
  .setAllowedMentionsUsers([...(config.pingJoin ? [user.id] : []), ...config.pingUsers])
  .setSendTo([{ channel: config.channel, guildId }]);

 if (content?.components) {
  const usesGif = hasGifPlaceholder(content.components);
  const components = interpolate(content.components, vars);
  if (gif && !usesGif) {
   components.push({ type: ComponentType.MediaGallery, items: [{ media: { url: gif } }] });
  }
  if (pings) components.push({ type: ComponentType.TextDisplay, content: pings });
  payload.setComponents(components).addFlags(MessageFlags.IsComponentsV2);
 } else {
  const t = await this.t(guildId);
  const embed: APIEmbed = content?.embed
   ? interpolate(content.embed, vars)
   : { description: t.defaults[kind](vars) };
  if (gif && !(content?.embed && hasGifPlaceholder(content.embed))) embed.image = { url: gif };
  payload.setEmbeds([embed]).setContent(pings || null);
 }

 const sent = await payload.send();
 return sent.some((m) => !!m);
}
