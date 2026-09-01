import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SeparatorBuilder,
 StringSelectMenuBuilder,
 StringSelectMenuOptionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ComponentType,
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { hasManageGuild } from '../../../settings/Util/authorizeSettings.js';
import { buttonEmoji, textEmote } from '../../../settings/Util/settingsEmotes.js';
import { GreetingKind } from '../../Classes/Enums.js';
import { WelcomeRoute } from '../../Classes/Routes.js';
import type WelcomePlugin from '../../Plugin.js';
import { countGifs, listGifs } from '../../Util/gifPool.js';

type Translator = Awaited<ReturnType<WelcomePlugin['t']>>;

const perPage = 5;
const listReason = 'Welcome GIF pool';

const parseKind = (value?: string) => {
 if (value === GreetingKind.Welcome) return GreetingKind.Welcome;
 if (value === GreetingKind.Goodbye) return GreetingKind.Goodbye;
 return null;
};

const fileLabel = (url: string) => {
 const [path] = url.split('?');
 return ((path ?? url).split('/').pop() || url).slice(0, 100);
};

const authorize = async function (
 this: WelcomePlugin,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction,
 guildId: string,
) {
 if (cmd.member && hasManageGuild(cmd.member.permissions)) return true;

 const t = await this.t(guildId);
 ephemeralNote.call(this, cmd, t.errors.manageGuildRequired());
 return false;
};

const titleOf = (t: Translator, kind: GreetingKind) =>
 (kind === GreetingKind.Welcome ? t.gifs.title.welcome() : t.gifs.title.goodbye());

const buildPage = async function (
 this: WelcomePlugin,
 guildId: string,
 kind: GreetingKind,
 page: number,
) {
 const t = await this.t(guildId);
 const emotes = this.client.emojis.for(await this.getAPI(guildId));

 const total = await countGifs.call(this, guildId, kind);
 const pages = Math.max(1, Math.ceil(total / perPage));
 const current = Math.min(Math.max(page, 0), pages - 1);
 const rows = total ? await listGifs.call(this, guildId, kind, current * perPage, perPage) : [];

 const summary = total
  ? t.gifs.count({ total: String(total), page: String(current + 1), pages: String(pages) })
  : t.gifs.empty();

 const container = new ContainerBuilder();
 container.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `# ${textEmote(emotes.image)} ${titleOf(t, kind)}\n${summary}`,
  ),
 );

 if (rows.length) {
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    rows.map((row) => new MediaGalleryItemBuilder().setURL(row.url)),
   ),
  );
  container.addActionRowComponents(
   new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
     .setCustomId(this.getRoute(WelcomeRoute.GifDelete, kind, current))
     .setPlaceholder(t.gifs.deletePlaceholder())
     .setMinValues(1)
     .setMaxValues(1)
     .addOptions(
      rows.map((row, i) =>
       new StringSelectMenuOptionBuilder()
        .setLabel(t.gifs.entry({ index: String(current * perPage + i + 1) }).slice(0, 100))
        .setDescription(fileLabel(row.url))
        .setValue(row.id)
        .setEmoji(buttonEmoji(emotes.trash)),
      ),
     ),
   ),
  );
 }

 if (pages > 1) {
  container.addActionRowComponents(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(WelcomeRoute.GifPage, kind, current - 1))
     .setEmoji(buttonEmoji(emotes.prev))
     .setDisabled(current === 0),
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setCustomId(this.getRoute(WelcomeRoute.GifPage, kind, current + 1))
     .setEmoji(buttonEmoji(emotes.next))
     .setDisabled(current >= pages - 1),
   ),
  );
 }

 return new MessagePayload(this.client, { origin: this.name, reason: listReason })
  .setComponents([container.toJSON() as APIMessageTopLevelComponent])
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);
};

export const gifList = async function (
 this: WelcomePlugin,
 cmd: APIApplicationCommandInteraction | APIMessageComponentInteraction,
 kind: GreetingKind,
) {
 if (!cmd.guild_id) return;
 if (!(await authorize.call(this, cmd, cmd.guild_id))) return;

 const payload = await buildPage.call(this, cmd.guild_id, kind, 0);
 payload.reply(cmd);
};

export const gifPage = async function (
 this: WelcomePlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorize.call(this, cmd, cmd.guild_id))) return;

 const [kindArg, page] = args;
 const kind = parseKind(kindArg);
 if (!kind) return;

 const payload = await buildPage.call(this, cmd.guild_id, kind, Number(page) || 0);
 payload.update(cmd);
};

export const gifDelete = async function (
 this: WelcomePlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 if (!(await authorize.call(this, cmd, cmd.guild_id))) return;

 const [kindArg, page] = args;
 const kind = parseKind(kindArg);
 if (!kind) return;

 const [id] = (cmd as APIMessageComponentSelectMenuInteraction).data.values;
 if (id) {
  await this.client.db.client.welcomeGif.deleteMany({ where: { id, guild: cmd.guild_id } });
 }

 const payload = await buildPage.call(this, cmd.guild_id, kind, Number(page) || 0);
 payload.update(cmd);
};
