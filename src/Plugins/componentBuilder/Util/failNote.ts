import type { APIMessageComponentInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../../Util/ephemeralNote.js';
import type ComponentBuilderPlugin from '../Plugin.js';

import { applyErrorText } from './applyErrorText.js';
import type { BuilderErrorCode } from './componentTree.js';

export const failNote = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 error: BuilderErrorCode,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 ephemeralNote.call(this, cmd, applyErrorText(t, error));
};
