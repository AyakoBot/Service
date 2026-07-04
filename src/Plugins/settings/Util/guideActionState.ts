import type Plugin from '../../../Classes/abstracts/Plugin.js';
import type SettingsPlugin from '../Plugin.js';
import type { SettingsGuide } from '../SettingsSchema.js';

import type { GuideActionState } from './buildGuidePage.js';

export default async function guideActionState(
 this: SettingsPlugin,
 args: {
  guide: SettingsGuide;
  row: Record<string, unknown>;
  plugin: Plugin;
  guildId: string;
 },
): Promise<GuideActionState> {
 const actions = args.guide.sections
  .flatMap((section) => section.steps)
  .flatMap((step) => (step.action ? [step.action] : []));

 const entries = await Promise.all(
  actions.map(async (action): Promise<readonly [string, boolean]> => {
   try {
    const done = await action.doneIf(args.row, {
     client: this.client,
     plugin: args.plugin,
     guildId: args.guildId,
    });
    return [action.customId, Boolean(done)];
   } catch {
    return [action.customId, false];
   }
  }),
 );

 return Object.fromEntries(entries);
}
