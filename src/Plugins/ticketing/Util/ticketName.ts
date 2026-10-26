import { TicketType } from '@ayako/database';

import type TicketPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

export const defaultNameTemplate = '[{{state}}] {{user}} {{userid}}';
export const nameTemplateMax = 100;

export enum NameVar {
 State = 'state',
 User = 'user',
 Display = 'display',
 UserId = 'userid',
 Staff = 'staff',
 StaffId = 'staffid',
 System = 'system',
 Tier = 'tier',
 Priority = 'priority',
 Id = 'id',
 Date = 'date',
}

export type NameValues = Partial<Record<NameVar, string>>;

const nameVarList = Object.values(NameVar);
const channelKinds = [TicketType.Channel, TicketType.dmToChannel];

export const usedNameVars = (template: string): NameVar[] =>
 nameVarList.filter((key) => template.includes(`{{${key}}}`));

const fill = (template: string, values: NameValues): string =>
 template
  .replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key as NameVar] ?? match)
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, nameTemplateMax);

export const renderName = (template: string | null, values: NameValues): string =>
 fill(template?.trim() || defaultNameTemplate, values) || fill(defaultNameTemplate, values);

export const isChannelKind = (type: TicketType): boolean => channelKinds.includes(type);

export const convertTemplate = (template: string, toChannel: boolean): string =>
 toChannel ? template.replace(/ /g, '-') : template.replace(/-/g, ' ');

const comparable = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export const sameName = (current: string, next: string): boolean =>
 comparable(current) === comparable(next);

const descriptions: Record<NameVar, (t: Translator) => string> = {
 [NameVar.State]: (t) => t.settings.nameVars.state(),
 [NameVar.User]: (t) => t.settings.nameVars.user(),
 [NameVar.Display]: (t) => t.settings.nameVars.display(),
 [NameVar.UserId]: (t) => t.settings.nameVars.userid(),
 [NameVar.Staff]: (t) => t.settings.nameVars.staff(),
 [NameVar.StaffId]: (t) => t.settings.nameVars.staffid(),
 [NameVar.System]: (t) => t.settings.nameVars.system(),
 [NameVar.Tier]: (t) => t.settings.nameVars.tier(),
 [NameVar.Priority]: (t) => t.settings.nameVars.priority(),
 [NameVar.Id]: (t) => t.settings.nameVars.id(),
 [NameVar.Date]: (t) => t.settings.nameVars.date(),
};

export const nameHelpText = (t: Translator): string =>
 [
  `### ${t.settings.nameVars.title()}`,
  ...nameVarList.map((key) => `- \`{{${key}}}\` ${descriptions[key](t)}`),
  '',
  `${t.settings.nameVars.default()} \`${defaultNameTemplate}\``,
  `-# ${t.settings.nameVars.channelNote()}`,
  `-# ${t.settings.nameVars.limitNote()}`,
 ].join('\n');
