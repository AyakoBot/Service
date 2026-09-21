import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import { RespondMode } from '../../../../Util/respondMode.js';
import { fleetContext } from '../../Util/context.js';
import { respondPanel } from '../../Util/render.js';
import fleet from '../../Views/fleet.js';
import type HelpPlugin from '../../Plugin.js';

export default async function (
 this: HelpPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 const ctx = await fleetContext.call(this, cmd);

 await respondPanel.call(this, cmd, [fleet(ctx)], true, RespondMode.Reply);
}
