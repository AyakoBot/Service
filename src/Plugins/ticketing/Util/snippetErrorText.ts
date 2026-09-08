import { SnippetErrors } from '../Classes/Enums.js';
import type TicketPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

export interface SnippetErrorVars {
 name: string;
 trigger: string;
}

const texts: Record<SnippetErrors, (t: Translator, vars: SnippetErrorVars) => string> = {
 [SnippetErrors.noTicket]: (t) => t.tag.errors.noTicket(),
 [SnippetErrors.notFound]: (t) => t.tag.errors.notFound(),
 [SnippetErrors.emptySnippet]: (t) => t.tag.errors.emptySnippet(),
 [SnippetErrors.nameRequired]: (t) => t.tag.errors.nameRequired(),
 [SnippetErrors.dmFailed]: (t) => t.errors.couldntSendDm(),
 [SnippetErrors.nameExists]: (t, vars) => t.tag.errors.nameExists({ name: vars.name }),
 [SnippetErrors.triggerExists]: (t, vars) =>
  t.tag.errors.triggerExists({ trigger: vars.trigger }),
 [SnippetErrors.triggerPrefixConflict]: (t, vars) =>
  t.tag.errors.triggerPrefixConflict({ trigger: vars.trigger }),
};

export const snippetErrorText = (t: Translator, error: string, vars: SnippetErrorVars) =>
 texts[error as SnippetErrors]?.(t, vars) ?? t.base.errors.unknownError();
