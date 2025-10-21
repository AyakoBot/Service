import * as Discord from 'discord.js';

export default async <
 T extends Discord.ChatInputCommandInteraction | Discord.StringSelectMenuInteraction,
>(
 cmd: T,
 args: T extends Discord.StringSelectMenuInteraction ? string[] : undefined,
) => {
 if (!cmd.inCachedGuild()) return;

 const language = await cmd.client.util.getLanguage(cmd.guildId);
 const lan = language.slashCommands.selfroles;

 const category =
  args?.[0] ?? (cmd as Discord.ChatInputCommandInteraction).options.getString('category', true);
 if (Number.isNaN(+category)) {
  cmd.client.util.errorCmd(cmd, lan.selectCategory, language);
  return;
 }

 const allSettings = await cmd.client.util.DataBase.selfroles.findMany({
  where: { guildid: cmd.guildId },
 });
 const settings = allSettings.find((s) => Number(s.uniquetimestamp) === Number(category));

 if (!settings || !allSettings.length) {
  cmd.client.util.errorCmd(cmd, lan.notEnabled, language);
  return;
 }

 const roles = settings.roles
  .map((r) => cmd.guild.roles.cache.get(r))
  .filter((r): r is RRole => !!r);

 const payload: Discord.BaseMessageOptions = {
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.StringSelect,
      customId: `self-roles/category`,
      placeholder: settings.onlyone ? lan.selectOne : lan.selectMany,
      options: allSettings.map((s) => ({
       default: Number(s.uniquetimestamp) === Number(category),
       label: s.name,
       value: String(s.uniquetimestamp),
      })),
      maxValues: 1,
      minValues: 1,
     },
    ],
   },
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.StringSelect,
      customId: `self-roles/role_${category}`,
      placeholder: settings.onlyone ? lan.selectOne : lan.selectMany,
      options: roles
       .filter((r) =>
        settings.onlyone
         ? (cmd.member.roles.cache.hasAny(...roles.map((r2) => r2.id)) &&
            cmd.member.roles.cache.has(r.id)) ||
           !cmd.member.roles.cache.hasAny(...roles.map((r2) => r2.id))
         : true,
       )
       .map((r) => ({
        label: r.name,
        value: r.id,
        emoji: cmd.member.roles.cache.has(r.id)
         ? cmd.client.util.emotes.minusBG
         : cmd.client.util.emotes.plusBG,
        description: cmd.member.roles.cache.has(r.id) ? lan.removeRole : undefined,
       })),
      maxValues: settings.onlyone ? 1 : roles.length,
      minValues: 1,
     },
    ],
   },
  ],
 };

 if (cmd instanceof Discord.ChatInputCommandInteraction) cmd.client.util.replyCmd(cmd, payload);
 else cmd.update(payload);
};
