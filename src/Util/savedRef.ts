import type { APIEmbed, APIMessageTopLevelComponent } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';
import type {
 OptionsResolver,
 RowGuardContext,
 SettingsDelegate,
 SettingsFieldVirtual,
 ShowIfResult,
} from '../Plugins/settings/SettingsSchema.js';
import type { TableName } from '../Types/prisma.js';

import {
 countComponents,
 messageComponentLimit,
 type CountableComponent,
} from './componentBudget.js';

export enum SavedDesignKind {
 Embed = 'e',
 Components = 'c',
}

export const noSavedDesign = 'none';

const optionLimit = 25;

export interface SavedDesignColumns {
 embed: string;
 components: string;
}

export interface SavedContent {
 embed?: APIEmbed;
 components?: APIMessageTopLevelComponent[];
}

interface SavedDesign {
 kind: SavedDesignKind;
 id: string;
 name: string;
 size: number;
}

const designValue = (kind: SavedDesignKind, id: unknown): string => `${kind}:${String(id)}`;

const newestFirst = (a: SavedDesign, b: SavedDesign): number =>
 b.id.length - a.id.length || b.id.localeCompare(a.id);

const select = { id: true, name: true } as const;
const designSelect = { ...select, components: true } as const;

const sizeOf = (components: unknown): number =>
 Array.isArray(components) ? countComponents(components as CountableComponent[]) : 0;

const byName = (ctx: RowGuardContext, kind: SavedDesignKind, name: string) =>
 kind === SavedDesignKind.Embed
  ? ctx.client.db.client.customEmbed.findFirst({ where: { guild: ctx.guildId, name }, select })
  : ctx.client.db.client.customComponents.findFirst({
     where: { guild: ctx.guildId, name },
     select,
    });

const byId = (ctx: RowGuardContext, kind: SavedDesignKind, id: string) =>
 kind === SavedDesignKind.Embed
  ? ctx.client.db.client.customEmbed.findFirst({ where: { guild: ctx.guildId, id }, select })
  : ctx.client.db.client.customComponents.findFirst({
     where: { guild: ctx.guildId, id },
     select: designSelect,
    });

const savedDesigns = async (ctx: RowGuardContext): Promise<SavedDesign[]> => {
 const where = { guild: ctx.guildId };
 const [embeds, components] = await Promise.all([
  ctx.client.db.client.customEmbed.findMany({ where, select }),
  ctx.client.db.client.customComponents.findMany({ where, select: designSelect }),
 ]);

 return [
  ...embeds.map((row) => ({
   kind: SavedDesignKind.Embed,
   id: String(row.id),
   name: row.name,
   size: 0,
  })),
  ...components.map((row) => ({
   kind: SavedDesignKind.Components,
   id: String(row.id),
   name: row.name,
   size: sizeOf(row.components),
  })),
 ].sort(newestFirst);
};

const designOptions = (limit: number): OptionsResolver => async (ctx) => {
 const { base } = await ctx.plugin.t(ctx.guildId);
 const designs = await savedDesigns(ctx);
 const shown = designs.slice(0, optionLimit - 1);
 const note =
  shown.length < designs.length
   ? {
      description: base.savedDesigns.truncated({
       shown: String(shown.length),
       total: String(designs.length),
      }),
     }
   : {};

 return [
  { label: base.t.None(), value: noSavedDesign, ...note },
  ...shown.map((design) => ({
   label: (design.name || design.id).slice(0, 100),
   value: designValue(design.kind, design.id),
   description:
    design.kind === SavedDesignKind.Embed
     ? base.savedDesigns.embed()
     : design.size > limit
       ? `${base.savedDesigns.components()} · ${base.savedDesigns.tooLarge({
          count: String(design.size),
          limit: String(limit),
         })}`
       : base.savedDesigns.components(),
  })),
 ];
};

const storedPick = async (
 name: unknown,
 kind: SavedDesignKind,
 ctx: RowGuardContext,
): Promise<string | null> => {
 if (typeof name !== 'string' || !name) return null;

 const saved = await byName(ctx, kind, name);
 return saved ? designValue(kind, saved.id) : '';
};

const parsePick = (value: unknown): { kind: SavedDesignKind; id: string } | null => {
 const [kind, id] = String(value ?? '').split(':');
 if (!id) return null;
 if (kind === SavedDesignKind.Embed) return { kind: SavedDesignKind.Embed, id };
 if (kind === SavedDesignKind.Components) return { kind: SavedDesignKind.Components, id };
 return null;
};

export const savedDesignField = (
 table: TableName,
 columns: SavedDesignColumns,
 reserve = 0,
): { options: OptionsResolver; virtual: SettingsFieldVirtual } => ({
 options: designOptions(messageComponentLimit - reserve),
 virtual: {
  read: async (row, ctx) =>
   (await storedPick(row[columns.components], SavedDesignKind.Components, ctx)) ??
   (await storedPick(row[columns.embed], SavedDesignKind.Embed, ctx)) ??
   '',
  write: async (value, row, ctx): Promise<ShowIfResult> => {
   const pick = parsePick(value);
   const data: Record<string, string | null> = {
    [columns.embed]: null,
    [columns.components]: null,
   };

   if (pick) {
    const saved = await byId(ctx, pick.kind, pick.id);
    if (!saved) {
     const { base } = await ctx.plugin.t(ctx.guildId);
     return { ok: false, reason: base.savedDesigns.notFound() };
    }

    const size = 'components' in saved ? sizeOf(saved.components) : 0;
    const limit = messageComponentLimit - reserve;
    if (size > limit) {
     const { base } = await ctx.plugin.t(ctx.guildId);
     return {
      ok: false,
      reason: base.savedDesigns.tooLargeReason({ count: String(size), limit: String(limit) }),
     };
    }
    data[pick.kind === SavedDesignKind.Embed ? columns.embed : columns.components] = saved.name;
   }

   await (ctx.client.db.client as unknown as Record<string, SettingsDelegate>)[table]?.updateMany({
    where: { id: row.id, guild: ctx.guildId },
    data,
   });

   return { ok: true };
  },
 },
});

export const resolveSavedContent = async (
 client: Client,
 guildId: string,
 refs: { embed?: string | null; components?: string | null },
): Promise<SavedContent | null> => {
 if (refs.components) {
  const saved = await client.db.client.customComponents.findFirst({
   where: { guild: guildId, name: refs.components },
  });

  if (saved?.components) {
   return { components: saved.components as unknown as APIMessageTopLevelComponent[] };
  }
 }

 if (refs.embed) {
  const saved = await client.db.client.customEmbed.findFirst({
   where: { guild: guildId, name: refs.embed },
  });

  if (saved?.embed) return { embed: saved.embed as APIEmbed };
 }

 return null;
};
