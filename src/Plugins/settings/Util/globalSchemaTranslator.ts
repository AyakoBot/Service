import { plainCommand, type CommandMention } from '../../../Util/commandMention.js';
import type { DefaultTranslator, SettingsSchema, SettingsSchemaDef } from '../SettingsSchema.js';

const fieldDescription = (
 def: SettingsSchemaDef,
 t: DefaultTranslator,
 column?: string,
): string | undefined =>
 (column
  ? def.groups
     .flatMap((g) => g.fields)
     .find((f) => f.column === column)
     ?.description?.(t)
  : undefined);

export const globalSchemaTranslator = (
 t: DefaultTranslator,
 def: SettingsSchemaDef,
 mention: CommandMention = plainCommand,
): SettingsSchema => {
 const { rowSummary } = def;

 return {
  table: def.table,
  rowKey: def.rowKey,
  multiRow: def.multiRow,
  title: def.title?.(t),
  overviewDescription: def.overviewDescription?.(t),
  rowLabel: (row) => def.rowLabel(t, row),
  rowSummary: rowSummary ? (row) => rowSummary(t, row) : undefined,
  groups: def.groups.map((g) => ({
   id: g.id,
   label: g.label(t),
   description: g.description?.(t),
   emote: g.emote,
   showIf: g.showIf,
   actions: g.actions?.map((a) => ({
    customId: a.customId,
    label: a.label(t),
    description: a.description?.(t),
    buttonLabel: a.buttonLabel?.(t),
    emote: a.emote,
   })),
   fields: g.fields.map((f) => ({
    column: f.column,
    editor: f.editor,
    label: f.label(t),
    description: f.description?.(t),
    arity: f.arity,
    options: Array.isArray(f.options)
     ? f.options.map((o) => ({
        value: o.value,
        label: o.label(t),
        description: o.description?.(t),
       }))
     : f.options,
    channelTypes: f.channelTypes,
    required: f.required,
    secret: f.secret,
    ms: f.ms,
    headerToggle: f.headerToggle,
    showIf: f.showIf,
    validate: f.validate,
    transform: f.transform,
    virtual: f.virtual,
   })),
  })),
  guide: def.guide
   ? {
      title: def.guide.title(t),
      intro: def.guide.intro?.(t, mention),
      advert: {
       text: def.guide.advert.text(t),
       buttonLabel: def.guide.advert.buttonLabel(t),
       emote: def.guide.advert.emote,
      },
      sections: def.guide.sections.map((s) => ({
       id: s.id,
       label: s.label(t),
       description: s.description?.(t),
       emote: s.emote,
       showIf: s.showIf,
       gate: s.gate
        ? {
           flag: s.gate.flag,
           question: s.gate.question(t),
           yes: s.gate.yes?.(t),
           no: s.gate.no?.(t),
          }
        : undefined,
       steps: s.steps.map((st) => ({
        column: st.column,
        action: st.action,
        label: st.label(t),
        description: st.description?.(t) ?? fieldDescription(def, t, st.column),
        required: st.required,
        showIf: st.showIf,
       })),
      })),
     }
   : undefined,
 };
};
