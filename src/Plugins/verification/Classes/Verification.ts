import { RequestHandlerError } from '@ayako/api';
import type { VerificationSetting } from '@ayako/database';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 TextDisplayBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import { CaptchaGenerator } from 'captcha-canvas';
import {
 ButtonStyle,
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIMessageTopLevelComponent,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../Types/index.js';
import ephemeralNote from '../../../Util/ephemeralNote.js';
import { findModalValue } from '../../../Util/findModalValue.js';
import interpolate from '../../../Util/interpolate.js';
import { memberCountVars } from '../../../Util/memberCounts.js';
import { serverVars } from '../../../Util/placeholderVars.js';
import { resolveSavedContent } from '../../../Util/savedRef.js';
import type VerificationPlugin from '../Plugin.js';
import hasVerifyButton from '../Util/hasVerifyButton.js';

import { origin, VerificationRoute } from './Routes.js';

type Translator = Awaited<ReturnType<VerificationPlugin['t']>>;

const captchaTtlSeconds = 300;
const captchaLength = 4;
const codeInputId = 'code';
const captchaFileName = 'captcha.png';

const captchaKey = (guildId: string, userId: string, captchaId: string) =>
 `verification:captcha:${guildId}:${userId}:${captchaId}`;

export default class Verification {
 plugin: VerificationPlugin;
 settings: VerificationSetting;

 constructor(plugin: VerificationPlugin, settings: VerificationSetting) {
  this.plugin = plugin;
  this.settings = settings;
 }

 get client() {
  return this.plugin.client;
 }

 get guildId() {
  return this.settings.guild;
 }

 static async fetch(
  plugin: VerificationPlugin,
  guildId: string,
  activeOnly = true,
 ): Promise<Verification | null> {
  const settings = await plugin.client.db.client.verificationSetting.findFirst({
   where: activeOnly ? { guild: guildId, active: true } : { guild: guildId },
  });
  return settings ? new Verification(plugin, settings) : null;
 }

 async startCaptcha(cmd: APIMessageComponentInteraction) {
  if (!cmd.member) return;
  const t = await this.plugin.t(this.guildId);

  if (this.settings.verifiedRole && cmd.member.roles.includes(this.settings.verifiedRole)) {
   ephemeralNote.call(this.plugin, cmd, t.alreadyVerified());
   await this.removeRoles(cmd.member.user.id, cmd.member.roles, t);
   return;
  }

  this.logStart(cmd.member.user.id, t);

  const captcha = new CaptchaGenerator({ height: 200, width: 600 });
  captcha.setCaptcha({ characters: captchaLength, size: 50 });
  captcha.setTrace({ size: 2, opacity: 3 });
  const image = captcha.generateSync();

  await this.client.cache.cacheDb.set(
   captchaKey(this.guildId, cmd.member.user.id, cmd.id),
   captcha.text,
   'EX',
   captchaTtlSeconds,
  );

  const guild = await this.client.cache.guilds.get(this.guildId);

  const container = new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `### ${t.title()}\n${t.welcome({ guild: guild?.name ?? '' })}`,
    ),
   )
   .addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
     new MediaGalleryItemBuilder().setURL(`attachment://${captchaFileName}`),
    ),
   )
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${t.hint()}**\n${t.hintText()}`),
   )
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Success)
      .setCustomId(this.plugin.getRoute(VerificationRoute.EnterCode, cmd.id))
      .setLabel(t.enterCode()),
    ),
   );

  await new MessagePayload(this.client, { origin, reason: 'Verification captcha' })
   .setFlags(MessageFlags.Ephemeral | MessageFlags.IsComponentsV2)
   .setComponents([container.toJSON()])
   .setFiles([{ name: captchaFileName, data: image, contentType: 'image/png' }])
   .reply(cmd);
 }

 async openModal(cmd: APIMessageComponentInteraction) {
  if (!cmd.member) return;
  const t = await this.plugin.t(this.guildId);

  const [, captchaId] = cmd.data.custom_id.split('_');
  const solution = await this.client.cache.cacheDb.get(
   captchaKey(this.guildId, cmd.member.user.id, captchaId),
  );
  if (!solution) {
   ephemeralNote.call(this.plugin, cmd, t.expired());
   return;
  }

  await this.client.getBaseAPI().interactions.createModal(
   cmd.id,
   cmd.token,
   {
    custom_id: this.plugin.getRoute(VerificationRoute.Submit, captchaId),
    title: t.verify(),
    components: [
     new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
       new TextInputBuilder()
        .setCustomId(codeInputId)
        .setLabel(t.enterCode())
        .setStyle(TextInputStyle.Short)
        .setMinLength(captchaLength)
        .setMaxLength(captchaLength)
        .setRequired(true),
      )
      .toJSON(),
    ],
   },
   { origin, reason: 'Verification code modal' },
  );
 }

 async submit(cmd: APIModalSubmitInteraction) {
  if (!cmd.member) return;
  const t = await this.plugin.t(this.guildId);

  const [, captchaId] = cmd.data.custom_id.split('_');
  const key = captchaKey(this.guildId, cmd.member.user.id, captchaId);
  const solution = await this.client.cache.cacheDb.get(key);
  await this.client.cache.cacheDb.del(key);

  if (!solution) {
   await this.updateNote(cmd, t.expired());
   return;
  }

  const value = findModalValue(cmd.data.components, codeInputId) ?? '';
  if (value.toLowerCase() !== solution.toLowerCase()) {
   await this.updateNote(cmd, t.wrongInput());
   return;
  }

  await this.plugin.kicks.disarm(this.guildId, cmd.member.user.id);
  await this.updateNote(cmd, t.finished());
  await this.removeRoles(cmd.member.user.id, cmd.member.roles, t);
  await this.addRoles(cmd.member.user.id, cmd.member.roles, t);
 }

 async postPanel(cmd: APIMessageComponentInteraction) {
  const t = await this.plugin.t(this.guildId);
  if (!this.settings.channel) {
   ephemeralNote.call(this.plugin, cmd, t.errors.noChannel());
   return;
  }

  const api = await this.plugin.getAPI(this.guildId);
  const message = await api.channels.createMessage(
   this.settings.channel,
   (await this.panelPayload(t)).getAPIPayload(),
   { origin, reason: 'Verification panel' },
  );
  if (message instanceof RequestHandlerError) {
   ephemeralNote.call(this.plugin, cmd, t.errors.panelFailed());
   return;
  }

  await this.client.db.client.verificationSetting.update({
   where: { id: this.settings.id },
   data: { panelMessage: message.id },
  });

  ephemeralNote.call(this.plugin, cmd, t.panelPosted());
 }

 private async panelPayload(t: Translator) {
  const payload = new MessagePayload(this.client, { origin, reason: 'Verification panel' });
  const saved = await resolveSavedContent(this.client, this.guildId, {
   embed: this.settings.panelEmbed,
   components: this.settings.panelComponents,
  });

  if (saved?.components) {
   const components = interpolate(saved.components, await this.panelVars(saved.components));

   return payload
    .setFlags(MessageFlags.IsComponentsV2)
    .setComponents(hasVerifyButton(components) ? components : [...components, this.verifyRow(t)]);
  }

  if (saved?.embed) {
   return payload
    .setEmbeds([interpolate(saved.embed, await this.panelVars(saved.embed))])
    .setComponents([this.verifyRow(t)]);
  }

  return payload.setFlags(MessageFlags.IsComponentsV2).setComponents([this.defaultPanel(t)]);
 }

 private async panelVars(template: unknown) {
  return {
   ...(await serverVars.call(this.plugin, this.guildId)),
   ...(await memberCountVars.call(this.plugin, this.guildId, template)),
  };
 }

 private verifyButton(t: Translator) {
  return new ButtonBuilder()
   .setStyle(ButtonStyle.Primary)
   .setCustomId(this.plugin.getRoute(VerificationRoute.Verify))
   .setLabel(t.verify());
 }

 private verifyRow(t: Translator): APIMessageTopLevelComponent {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(this.verifyButton(t)).toJSON();
 }

 private defaultPanel(t: Translator): APIMessageTopLevelComponent {
  return new ContainerBuilder()
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${t.title()}\n${t.panelText()}`),
   )
   .addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(this.verifyButton(t)),
   )
   .toJSON();
 }

 private logStart(userId: string, t: Translator) {
  if (!this.settings.logChannel) return;

  const container = new ContainerBuilder()
   .setAccentColor(Colors.Loading)
   .addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${t.log.started()}\n${t.log.start({ user: userId })}`),
   );

  void new MessagePayload(this.client, { origin, reason: 'Verification start log' })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents([container.toJSON()])
   .addSendTo({ channel: this.settings.logChannel, guildId: this.guildId })
   .send();
 }

 private async removeRoles(userId: string, roles: string[], t: Translator) {
  const { pendingRole } = this.settings;
  if (!pendingRole || !roles.includes(pendingRole)) return;

  const api = await this.plugin.getAPI(this.guildId);
  const res = await api.guilds.removeRoleFromMember(this.guildId, userId, pendingRole, {
   origin,
   reason: t.log.finished(),
  });
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'remove pending role');
 }

 private async addRoles(userId: string, roles: string[], t: Translator) {
  const { verifiedRole } = this.settings;
  if (!verifiedRole || roles.includes(verifiedRole)) return;

  const api = await this.plugin.getAPI(this.guildId);
  const res = await api.guilds.addRoleToMember(this.guildId, userId, verifiedRole, {
   origin,
   reason: t.log.finished(),
  });
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'add verified role');
 }

 private async updateNote(cmd: APIModalSubmitInteraction, content: string) {
  const res = await this.client.getBaseAPI().interactions.updateMessage(
   cmd.id,
   cmd.token,
   {
    components: [new TextDisplayBuilder().setContent(content).toJSON()],
    attachments: [],
   },
   { origin, reason: 'Verification result' },
  );
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'verification result');
 }
}
