import { compareTwoStrings } from 'string-similarity';
import type {
 APIApplicationCommandAutocompleteInteraction,
 APIApplicationCommandInteractionDataStringOption,
 APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';

import { findFocusedString } from '../../../../Util/interactionOptions.js';
import { RespondMode } from '../../../../Util/respondMode.js';
import { HelpCommand, HelpOption } from '../../Classes/Commands.js';
import { HelpScope, type HelpSurface } from '../../Classes/HelpTypes.js';
import { contextFor } from '../../Util/context.js';
import { MatchKind, resolveCommand, type MatchResult } from '../../Util/match.js';
import type { Translator } from '../../Util/render.js';
import { respondPanel } from '../../Util/render.js';
import commandDetail from '../../Views/commandDetail.js';
import commandList from '../../Views/commandList.js';
import overview from '../../Views/overview.js';
import type HelpPlugin from '../../Plugin.js';

const choiceLimit = 25;
const labelLimit = 100;

const stringOption = (cmd: APIChatInputApplicationCommandInteraction, name: string): string => {
 const option = cmd.data.options?.find(
  (entry) => entry.name === name && entry.type === ApplicationCommandOptionType.String,
 );

 return option ? (option as APIApplicationCommandInteractionDataStringOption).value : '';
};

const booleanOption = (cmd: APIChatInputApplicationCommandInteraction, name: string): boolean => {
 const option = cmd.data.options?.find(
  (entry) => entry.name === name && entry.type === ApplicationCommandOptionType.Boolean,
 );

 return option && 'value' in option ? Boolean(option.value) : false;
};

const ranked = (leaves: string[], query: string): string[] => {
 const lowered = query.toLowerCase();
 if (!lowered) return leaves.slice(0, choiceLimit);

 return leaves
  .map((leaf) => ({ leaf, score: compareTwoStrings(leaf.toLowerCase(), lowered) }))
  .filter((entry) => entry.score > 0.2 || entry.leaf.toLowerCase().includes(lowered))
  .sort((left, right) => right.score - left.score)
  .slice(0, choiceLimit)
  .map((entry) => entry.leaf);
};

const mismatchFor = (
 t: Translator,
 surface: HelpSurface,
 requested: string,
 match: MatchResult,
): string | null => {
 if (match.kind !== MatchKind.Fuzzy || !match.closest) return null;
 if (surface.contextMenus.some((entry) => entry.name === match.closest)) {
  return t.panel.contextMenu({ name: match.closest });
 }

 return t.panel.notFound({ query: requested, closest: match.closest });
};

export const autocomplete = async function (
 this: HelpPlugin,
 cmd: APIApplicationCommandAutocompleteInteraction,
) {
 if (cmd.data.name !== HelpCommand.Help) return;

 const api = await this.getInteractionAPI(cmd);
 const query = findFocusedString(cmd.data.options);
 const data = await this.help.read(cmd);
 const choices = ranked(data.surface.leaves, query).map((leaf) => ({
  name: leaf.slice(0, labelLimit),
  value: leaf,
 }));

 await api.interactions.createAutocompleteResponse(
  cmd.id,
  cmd.token,
  { choices },
  { origin: this.name, reason: 'Help command autocomplete' },
 );
};

export default async function (
 this: HelpPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 const data = await this.help.read(cmd);
 const requested = stringOption(cmd, HelpOption.Command).trim();
 const showAll = booleanOption(cmd, HelpOption.All);

 const sessionId = this.sessions.create({
  scope: HelpScope.Commands,
  path: requested || null,
  page: 1,
  paged: showAll,
  hide: true,
 });

 if (requested) {
  const match = resolveCommand(data.surface, requested);
  const ctx = await contextFor.call(
   this,
   cmd,
   sessionId,
   HelpScope.Commands,
   match.target?.fullName ?? requested,
   1,
  );

  const mismatch = mismatchFor(ctx.t, data.surface, requested, match);
  const view = commandDetail(ctx, mismatch);

  await respondPanel.call(this, cmd, [view.container], true, RespondMode.Reply);
  return;
 }

 const ctx = await contextFor.call(this, cmd, sessionId, HelpScope.Commands, null, 1);
 const view = showAll ? commandList(ctx) : overview(ctx);

 await respondPanel.call(this, cmd, [view.container], true, RespondMode.Reply);
}
