import type { APIInteraction } from 'discord-api-types/v10';

import { commandMentions } from '../../../Util/commandMention.js';
import { HelpScope } from '../Classes/HelpTypes.js';
import { resolveCommand } from './match.js';
import type { ViewContext } from './render.js';
import type HelpPlugin from '../Plugin.js';

const emptyMention = (name: string): string => `\`/${name}\``;

export const contextFor = async function (
 this: HelpPlugin,
 cmd: APIInteraction,
 sessionId: string,
 scope: HelpScope,
 path: string | null,
 page: number,
): Promise<ViewContext> {
 const data = await this.help.read(cmd);
 const t = await this.t(cmd.guild_id ?? null);
 const api = await this.getInteractionAPI(cmd);
 const emotes = this.client.emojis.for(api);
 const mention = await commandMentions.call(api).catch(() => emptyMention);
 const target = path ? resolveCommand(data.surface, path).target : null;

 return { data, emotes, mention, page, plugin: this, scope, sessionId, t, target };
};

export const fleetContext = async function (
 this: HelpPlugin,
 cmd: APIInteraction,
): Promise<ViewContext> {
 return contextFor.call(this, cmd, '', HelpScope.Commands, null, 1);
};
