import type { Giveaway, Prisma } from '@ayako/database';
import {
 MessageFlags,
 type APIEmbed,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { Colors } from '../../../Types/index.js';
import interpolate from '../../../Util/interpolate.js';
import { parseColor } from '../../../Util/parseColor.js';
import { serverVars, type PlaceholderVars } from '../../../Util/placeholderVars.js';
import { resolveSavedContent } from '../../../Util/savedRef.js';
import { GiveawayErrors } from '../Classes/DBGiveaway.js';
import type GiveawaysPlugin from '../Plugin.js';

import { bonusSnapshot } from './bonusEntries.js';
import buildGiveaway, { entryCount, giveawayButtons, rel } from './container.js';
import { designFits, savedDesign, type GiveawayDesign } from './design.js';
import { giveawayDefaults } from './giveawayDefaults.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export interface GiveawaySurface {
 flags: MessageFlags | 0;
 content: string | null;
 components: APIMessageTopLevelComponent[];
 embeds: APIEmbed[];
}

export const giveawayVars = async function (
 this: GiveawaysPlugin,
 giveaway: Giveaway,
): Promise<PlaceholderVars> {
 const guild = await this.client.cache.guilds.get(giveaway.guild);
 const server = await serverVars.call(
  this,
  giveaway.guild,
  String(guild?.approximate_member_count ?? ''),
 );

 return {
  ...server,
  prize: giveaway.description,
  time: rel(giveaway.endTime),
  winners: String(Number(giveaway.winnerCount)),
  entries: String(entryCount(giveaway)),
  host: `<@${giveaway.host}>`,
 };
};

export const resolveTemplateDesign = async function (
 this: GiveawaysPlugin,
 guildId: string,
 names: { embed: string | null; components: string | null },
): Promise<Prisma.InputJsonValue | null> {
 if (!names.embed && !names.components) return null;

 const design = savedDesign(await resolveSavedContent(this.client, guildId, names));
 if (!design) throw new Error(GiveawayErrors.invalidDesign);
 if (!designFits(design)) throw new Error(GiveawayErrors.designTooLarge);

 return design as unknown as Prisma.InputJsonValue;
};

const resolveAccent = async function (this: GiveawaysPlugin, giveaway: Giveaway) {
 if (giveaway.accentColor) return parseColor(giveaway.accentColor) ?? Colors.Base;

 const defaults = await giveawayDefaults.call(this, giveaway.guild);
 if (!defaults.accentColor) return Colors.Base;

 return parseColor(defaults.accentColor) ?? Colors.Base;
};

const designSurface = async function (
 this: GiveawaysPlugin,
 t: Translator,
 emotes: EmoteSet,
 giveaway: Giveaway,
): Promise<GiveawaySurface> {
 const vars = await giveawayVars.call(this, giveaway);
 const design = interpolate(giveaway.design as unknown as GiveawayDesign, vars);
 const buttons = giveawayButtons.call(this, t, emotes, giveaway).toJSON();

 if (design.components) {
  return {
   flags: MessageFlags.IsComponentsV2,
   content: null,
   embeds: [],
   components: [...design.components, buttons],
  };
 }

 return {
  flags: 0,
  content: design.content ?? null,
  embeds: design.embeds ?? [],
  components: [buttons],
 };
};

export const resolveSurface = async function (
 this: GiveawaysPlugin,
 giveaway: Giveaway,
): Promise<GiveawaySurface> {
 const t = await this.t(giveaway.guild);
 const api = await this.api(giveaway.guild);
 const emotes = this.client.emojis.for(api);

 if (giveaway.design) return designSurface.call(this, t, emotes, giveaway);

 const [snapshot, accentColor] = await Promise.all([
  bonusSnapshot.call(this, giveaway.message),
  resolveAccent.call(this, giveaway),
 ]);

 return {
  flags: MessageFlags.IsComponentsV2,
  content: null,
  embeds: [],
  components: buildGiveaway.call(this, t, emotes, giveaway, { snapshot, accentColor }),
 };
};
