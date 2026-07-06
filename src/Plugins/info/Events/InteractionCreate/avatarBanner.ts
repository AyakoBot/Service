import {
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import type {
 APIApplicationCommandInteraction,
 APIApplicationCommandInteractionDataSubcommandOption,
} from 'discord-api-types/v10';

import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import { getUserOption } from '../../../../Util/interactionOptions.js';
import { textEmote } from '../../../settings/Util/settingsEmotes.js';
import { InfoOption } from '../../Classes/Commands.js';
import type InfoPlugin from '../../Plugin.js';
import { getHide, respond, respondError, type Translator } from '../../Util/respond.js';

import { resolveUser } from './user.js';

const size4k = '?size=4096';

export enum ImageKind {
 Avatar = 'avatar',
 Banner = 'banner',
}

const imageContainer = (
 t: Translator,
 kind: ImageKind,
 username: string,
 globalUrl: string | null,
 serverUrl: string | null,
): ContainerBuilder => {
 const lang = kind === ImageKind.Avatar ? t.avatar : t.banner;
 const emote = kind === ImageKind.Avatar ? emotes.avatar : emotes.banner;
 const container = new ContainerBuilder().setAccentColor(Colors.Info);

 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`## ${textEmote(emote)} ${lang.title()}\n**${username}**`),
 );

 if (!globalUrl && !serverUrl) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lang.none()));
  return container;
 }

 if (globalUrl) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`### ${lang.global()}`),
  );
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(`${globalUrl}${size4k}`),
   ),
  );
 }
 if (serverUrl && serverUrl !== globalUrl) {
  container.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(`### ${lang.server()}`),
  );
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(`${serverUrl}${size4k}`),
   ),
  );
 }

 return container;
};

export default async function (
 this: InfoPlugin,
 cmd: APIApplicationCommandInteraction,
 sub: APIApplicationCommandInteractionDataSubcommandOption,
 kind: ImageKind,
) {
 const t = await this.t(cmd.guild_id ?? cmd.locale);
 const targetId =
  getUserOption(sub, InfoOption.User) ?? cmd.member?.user.id ?? cmd.user?.id ?? '';

 const user = await resolveUser.call(this, targetId);
 if (!user) {
  respondError.call(this, cmd, t.errors.userNotFound());
  return;
 }

 const member = cmd.guild_id
  ? await this.client.cache.members.get(cmd.guild_id, user.id)
  : null;

 const globalUrl = kind === ImageKind.Avatar ? user.avatar_url : user.banner_url;
 const serverUrl =
  kind === ImageKind.Avatar ? (member?.avatar_url ?? null) : (member?.banner_url ?? null);

 respond.call(
  this,
  cmd,
  [imageContainer(t, kind, constants.formatters.user(user), globalUrl, serverUrl)],
  getHide(sub, false),
 );
}
