import * as Discord from 'discord.js';
import { isValid } from './tick.js';

export default async (cmd: Discord.ButtonInteraction, _args: [], accept = true) => {
 if (!cmd.inCachedGuild()) return;

 const valid = await isValid(cmd);
 if (!valid) return;
 const { language, lan, settings } = valid;

 if (
  settings.approverroleid.length > 0
   ? !settings.approverroleid.some((r) => cmd.member.roles.cache.has(r))
   : !cmd.member.permissions.has(PermissionFlagsBits.ManageGuild)
 ) {
  cmd.client.util.errorCmd(cmd, language.permissions.error.you, language);
  return;
 }

 cmd.showModal({
  title: language.t.Reason,
  custom_id: `suggestion/${accept ? 'accept' : 'reject'}_${cmd.message.id}`,
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.TextInput,
      style: Discord.TextInputStyle.Paragraph,
      placeholder: `(${language.t.optional})`,
      custom_id: 'paragraph',
      label: language.t.Reason,
      required: false,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.TextInput,
      style: Discord.TextInputStyle.Short,
      placeholder: `(${language.t.optional})`,
      custom_id: 'short',
      label: lan.tldr,
      required: false,
     },
    ],
   },
  ],
 });
};
