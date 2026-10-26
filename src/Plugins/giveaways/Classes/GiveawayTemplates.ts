import type { GiveawayTemplate } from '@ayako/database';
import type { APIApplicationCommandAutocompleteInteraction } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { findFocusedString } from '../../../Util/interactionOptions.js';
import { arm, disarm, isArmed, stripMarkerPrefix } from '../../../Util/schedule.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { nextRunAfter } from '../Util/recurrence.js';

import { GiveawayErrors } from './DBGiveaway.js';

const recurPrefix = 'giveaways:recur:';

const recurKey = (guildId: string, id: string) => `${recurPrefix}${guildId}:${id}`;
const dueKey = (id: string) => `giveaways:due:${id}`;

export default class GiveawayTemplates {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 byName = async (guildId: string, name: string): Promise<GiveawayTemplate> => {
  const row = await this.client.db.client.giveawayTemplate.findFirst({
   where: { guild: guildId, name },
  });
  if (!row) throw new Error(GiveawayErrors.templateNotFound);
  return row;
 };

 byId = async (guildId: string, id: string): Promise<GiveawayTemplate> => {
  const row = await this.client.db.client.giveawayTemplate.findFirst({
   where: { guild: guildId, id },
  });
  if (!row) throw new Error(GiveawayErrors.templateNotFound);
  return row;
 };

 autocomplete = async (cmd: APIApplicationCommandAutocompleteInteraction) => {
  if (!cmd.guild_id) return;

  const query = findFocusedString(cmd.data.options).toLowerCase();
  const rows = await this.client.db.client.giveawayTemplate.findMany({
   where: { guild: cmd.guild_id, name: { not: null } },
   orderBy: { name: 'asc' },
  });

  const choices = rows
   .flatMap((row) => (row.name ? [row.name] : []))
   .filter((name) => !query || name.toLowerCase().includes(query))
   .slice(0, 25)
   .map((name) => ({ name: name.slice(0, 100), value: name }));

  const api = await this.plugin.api(cmd.guild_id);
  await api.interactions.createAutocompleteResponse(
   cmd.id,
   cmd.token,
   { choices },
   { origin, reason: 'Giveaway template autocomplete' },
  );
 };

 claimDue = async (id: string): Promise<boolean> =>
  (await this.client.cache.cacheDb.del(dueKey(id))) > 0;

 markDue = async (id: string) => {
  await this.client.cache.cacheDb.set(dueKey(id), '1');
 };

 rearm = async (guildId: string, id: string) => {
  const template = await this.client.db.client.giveawayTemplate.findFirst({
   where: { guild: guildId, id },
  });

  if (!template?.repeatSeconds) {
   await disarm.call(this.client, recurKey(guildId, id));
   return;
  }

  const nextRunAt =
   template.nextRunAt ?? new Date(Date.now() + Number(template.repeatSeconds) * 1000);
  if (!template.nextRunAt) {
   await this.client.db.client.giveawayTemplate.updateMany({
    where: { guild: guildId, id, nextRunAt: null },
    data: { nextRunAt },
   });
  }

  await arm.call(
   this.client,
   recurKey(guildId, id),
   '1',
   Math.max(1, (nextRunAt.getTime() - Date.now()) / 1000),
  );
 };

 onScheduleExpired = async (rawKey: string) => {
  if (!this.plugin.isEnabled()) return;

  const key = stripMarkerPrefix(rawKey);
  if (!key.startsWith(recurPrefix)) return;

  const [guildId, id] = key.slice(recurPrefix.length).split(':');
  if (!guildId || !id) return;

  await this.fire(guildId, id).catch((e: Error) => this.plugin.nonFatalError(e, 'recurringRun'));
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const rows = await this.client.db.client.giveawayTemplate.findMany({
   where: { repeatSeconds: { not: null }, nextRunAt: { not: null } },
  });

  for (const template of rows) {
   if (!this.plugin.isLiveFor(template.guild) || !template.nextRunAt) continue;

   if (template.nextRunAt.getTime() <= Date.now()) {
    await this.fire(template.guild, template.id).catch((e: Error) =>
     this.plugin.nonFatalError(e, 'reconcile recurring'),
    );
   } else if (!(await isArmed.call(this.client, recurKey(template.guild, template.id)))) {
    await this.rearm(template.guild, template.id);
   }
  }
 };

 private fire = async (guildId: string, id: string) => {
  if (!this.plugin.isLiveFor(guildId)) return;

  const template = await this.client.db.client.giveawayTemplate.findFirst({
   where: { guild: guildId, id },
  });
  if (!template?.repeatSeconds || !template.nextRunAt) return;

  const booked = template.nextRunAt;
  const next = nextRunAfter(booked.getTime(), Number(template.repeatSeconds) * 1000, Date.now());
  const { count } = await this.client.db.client.giveawayTemplate.updateMany({
   where: { guild: guildId, id, nextRunAt: booked },
   data: { nextRunAt: new Date(next) },
  });
  if (!count) return;

  await this.rearm(guildId, id);

  if (template.personalPrizes) {
   await this.markDue(id);
   await this.plugin.logs.due(template);
   return;
  }

  await this.run(template).catch(async (error: Error) => {
   await this.plugin.logs.runFailed(template, await this.plugin.errorText(guildId, error));
  });
 };

 private run = async (template: GiveawayTemplate) => {
  if (!template.channel) throw new Error(GiveawayErrors.templateNoChannel);

  const api = await this.plugin.api(template.guild);
  await this.plugin.launcher.startTemplate(
   template,
   template.channel,
   api.botId,
   template.name ?? '',
   [],
  );
 };
}
