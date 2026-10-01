import type Client from '../../../Classes/Client.js';
import type { ButtonAction } from '../../../Util/buttonActions.js';
import type { SettingsOption } from '../../settings/SettingsSchema.js';
import type ComponentBuilderPlugin from '../Plugin.js';

type System = Client['plugins'][number];

export interface BoundAction {
 system: System;
 action: ButtonAction;
}

export default class ButtonBindings {
 plugin: ComponentBuilderPlugin;
 client: Client;

 constructor(plugin: ComponentBuilderPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 systems = (guildId: string): System[] =>
  this.client.plugins.filter(
   (system) => system.isEnabled() && !!system.buttonActions?.length && system.isLiveFor(guildId),
  );

 system = (guildId: string, settingName: string): System | null =>
  this.systems(guildId).find((system) => system.settingName === settingName) ?? null;

 action = (route: string): BoundAction | null => {
  const system = this.client.plugins.find((candidate) =>
   candidate.buttonActions?.some((action) => action.route === route),
  );
  const action = system?.buttonActions?.find((candidate) => candidate.route === route);

  return system && action ? { system, action } : null;
 };

 claims = (customId: string): boolean => {
  const [route, ...args] = customId.split('_');
  const bound = this.action(route);
  if (!bound) return false;

  return bound.action.choices ? args.length === 1 && !!args[0] : !args.length;
 };

 systemName = (customId: string): string | null =>
  (this.claims(customId) ? (this.action(customId.split('_')[0])?.system.name ?? null) : null);

 customId = (bound: BoundAction, choice?: string): string =>
  bound.system.getRoute(bound.action.route, ...(choice ? [choice] : []));

 choices = async (guildId: string, bound: BoundAction): Promise<SettingsOption[]> => {
  const options =
   (await bound.action.choices?.({ client: this.client, plugin: bound.system, guildId })) ?? [];

  return options.filter((option) => option.value && !option.value.includes('_'));
 };
}
