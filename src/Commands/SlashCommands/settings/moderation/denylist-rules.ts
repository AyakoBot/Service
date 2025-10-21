import * as Discord from 'discord.js';
import * as CT from '../../../../Typings/Typings.js';
import client from '../../../../BaseClient/Client.js';
import SH from '../../../../BaseClient/UtilModules/settingsHelpers.js';

const name = CT.SettingNames.DenylistRules;

export default async (cmd: Discord.ChatInputCommandInteraction) => {
 if (!cmd.inCachedGuild()) return;

 const language = await client.util.getLanguage(cmd.guild.id);
 const lan = language.slashCommands.settings.categories[name];

 const id = cmd.options.get('id', false)?.value as string;
 if (id) {
  showId(cmd, id, language, lan);
  return;
 }
 showAll(cmd, language, lan, 0);
};

export const showId: NonNullable<CT.SettingsFile<typeof name>['showId']> = async (
 cmd,
 id,
 language,
 lan,
) => {
 const { embedParsers } = client.util.settingsHelpers;
 const automodRule = cmd.guild?.autoModerationRules.cache.get(id);

 if (!automodRule) {
  client.util.errorCmd(cmd, language.errors.automodRuleNotFound, language);
  return;
 }

 if (cmd.isButton()) {
  cmd.update({
   embeds: getEmbeds(embedParsers, automodRule, language, lan),
   components: getComponents(automodRule, language, lan),
  });
  return;
 }

 cmd.reply({
  embeds: getEmbeds(embedParsers, automodRule, language, lan),
  components: getComponents(automodRule, language, lan),
  ephemeral: true,
 });
};

export const showAll: NonNullable<CT.SettingsFile<typeof name>['showAll']> = async (
 cmd,
 language,
 lan,
 page,
) => {
 const { multiRowHelpers } = client.util.settingsHelpers;

 const automodRules = cmd.guild?.autoModerationRules.cache.map((o) => o);

 const fields = automodRules?.map((r) => ({
  name: `${language.t.name}: \`${r.name}\` - ${language.events.logs.automodRule.actions}: ${
   r.actions.length
    ? r.actions
       .map((a) =>
        client.util.util.makeInlineCode(language.events.logs.automodRule.actionsType[a.type]),
       )
       .join(', ')
    : language.t.None
  }`,
  value: `${
   r.enabled
    ? client.util.constants.standard.getEmote(client.util.emotes.enabled)
    : client.util.constants.standard.getEmote(client.util.emotes.disabled)
  } - ID: ${client.util.util.makeInlineCode(r.id)}`,
 }));

 const embeds = multiRowHelpers.embeds(fields, language, lan, page);
 embeds[0].description = lan.desc(
  String(
   automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.Keyword)
    .length ?? 0,
  ),
  String(
   automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.MentionSpam)
    .length ?? 0,
  ),
  String(
   automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.Spam)
    .length ?? 0,
  ),
  String(
   automodRules?.filter(
    (r) => r.triggerType === RAutomodTriggerType.KeywordPreset,
   ).length ?? 0,
  ),
  String(
   automodRules?.filter((r) => r.triggerType === (6 as RAutomodTriggerType))
    .length ?? 0,
  ),
 );

 const components = getAllComponents(language, automodRules);
 multiRowHelpers.noFields(embeds, language);

 if (cmd.isButton()) {
  cmd.update({
   embeds,
   components,
  });
  return;
 }

 cmd.reply({
  embeds,
  components,
  ephemeral: true,
 });
};

export const getEmbeds = (
 embedParsers: typeof client.util.settingsHelpers.embedParsers,
 rule: RAutomod,
 language: CT.Language,
 lan: CT.Language['slashCommands']['settings']['categories'][typeof name],
): Discord.APIEmbed[] => [
 {
  footer: { text: `${language.t.name}: ${rule.name}` },
  description: client.util.constants.tutorials[name as keyof typeof client.util.constants.tutorials]
   ?.length
   ? `${language.slashCommands.settings.tutorial}\n${client.util.constants.tutorials[
      name as keyof typeof client.util.constants.tutorials
     ].map((t) => `[${t.name}](${t.link})`)}`
   : undefined,
  author: embedParsers.author(language, lan),
  fields:
   rule.triggerType !== (2 as never)
    ? [
       {
        name: language.events.logs.automodRule.enabled,
        value: embedParsers.boolean(rule.enabled, language),
        inline: false,
       },
       {
        name: '\u200b',
        value: client.util.util.makeUnderlined(client.util.util.makeBold(language.t.Triggers)),
       },
       ...([RAutomodTriggerType.Keyword, 6].includes(rule.triggerType)
        ? [
           {
            name: language.events.logs.automodRule.keywordFilter,
            value: rule.triggerMetadata.keywordFilter.length
             ? client.util.util.makeCodeBlock(rule.triggerMetadata.keywordFilter.join(', '))
             : language.t.None,
           },
           {
            name: language.events.logs.automodRule.regexPatterns,
            value: rule.triggerMetadata.regexPatterns.length
             ? client.util.util.makeCodeBlock(rule.triggerMetadata.regexPatterns.join(', '))
             : language.t.None,
           },
          ]
        : []),
       ...(rule.triggerType === RAutomodTriggerType.KeywordPreset
        ? [
           {
            name: language.events.logs.automodRule.presets[1],
            value: embedParsers.boolean(rule.triggerMetadata.presets?.includes(1), language),
            inline: true,
           },
           {
            name: language.events.logs.automodRule.presets[2],
            value: embedParsers.boolean(rule.triggerMetadata.presets?.includes(2), language),
            inline: true,
           },
           {
            name: language.events.logs.automodRule.presets[3],
            value: embedParsers.boolean(rule.triggerMetadata.presets?.includes(3), language),
            inline: true,
           },
          ]
        : []),
       ...([
        RAutomodTriggerType.Keyword,
        RAutomodTriggerType.KeywordPreset,
        6,
       ].includes(rule.triggerType)
        ? [
           {
            name: language.events.logs.automodRule.allowList,
            value: rule.triggerMetadata.allowList.length
             ? client.util.util.makeCodeBlock(rule.triggerMetadata.allowList.join(', '))
             : language.t.None,
           },
          ]
        : []),
       ...(rule.triggerType === RAutomodTriggerType.MentionSpam
        ? [
           {
            name: language.events.logs.automodRule.mentionTotalLimit,
            value: embedParsers.number(Number(rule.triggerMetadata.mentionTotalLimit), language),
           },
           {
            name: language.events.logs.automodRule.mentionRaidProtectionEnabled,
            value: embedParsers.boolean(
             rule.triggerMetadata.mentionRaidProtectionEnabled,
             language,
            ),
           },
          ]
        : []),
       {
        name: '\u200b',
        value: client.util.util.makeUnderlined(
         client.util.util.makeBold(language.events.logs.automodRule.actions),
        ),
       },
       {
        name:
         language.events.logs.automodRule.actionsType[
          rule.eventType === RAutomodEventType.MessageSend
           ? Discord.AutoModerationActionType.BlockMessage
           : 4
         ],
        value: embedParsers.boolean(
         !!rule.actions.find(
          (r) =>
           r.type ===
           (rule.eventType === RAutomodEventType.MessageSend
            ? Discord.AutoModerationActionType.BlockMessage
            : 4),
         ),
         language,
        ),
       },
       ...(rule.eventType === RAutomodEventType.MessageSend &&
       getActionMetadata(rule, 'BlockMessage')
        ? [
           {
            name: language.events.logs.automodRule.warnMessage,
            value: client.util.util.makeCodeBlock(
             rule.actions.find(
              (r) =>
               r.metadata.customMessage && r.type === Discord.AutoModerationActionType.BlockMessage,
             )?.metadata.customMessage || language.events.logs.automodRule.defaultMessage,
            ),
           },
          ]
        : []),
       {
        name:
         language.events.logs.automodRule.actionsType[
          Discord.AutoModerationActionType.SendAlertMessage
         ],
        value: getActionMetadata(rule, 'SendAlertMessage')?.channelId
         ? `${embedParsers.boolean(true, language)} - ${
            language.events.logs.automodRule.alertChannel
           }: <#${getActionMetadata(rule, 'SendAlertMessage')?.channelId}>`
         : embedParsers.boolean(false, language),
       },
       ...([
        RAutomodTriggerType.Keyword,
        RAutomodTriggerType.MentionSpam,
       ].includes(rule.triggerType)
        ? [
           {
            name:
             language.events.logs.automodRule.actionsType[Discord.AutoModerationActionType.Timeout],
            value: rule.actions.find((r) => r.type === Discord.AutoModerationActionType.Timeout)
             ? `${embedParsers.boolean(true, language)} - ${client.util.util.makeInlineCode(
                getActionMetadata(rule, 'Timeout')?.durationSeconds
                 ? client.util.moment(
                    Number(getActionMetadata(rule, 'Timeout')?.durationSeconds) * 1000,
                    language,
                   )
                 : client.util.moment(60000, language),
               )}`
             : embedParsers.boolean(false, language),
           },
          ]
        : []),
       {
        name: '\u200b',
        value: client.util.util.makeUnderlined(client.util.util.makeBold(language.t.Overrides)),
       },
       {
        name: language.events.logs.automodRule.exemptRoles,
        value: embedParsers.roles(
         rule.exemptRoles.map((o) => o.id).filter((o): o is string => !!o),
         language,
        ),
       },
       ...(rule.eventType === RAutomodEventType.MessageSend
        ? [
           {
            name: language.events.logs.automodRule.exemptChannels,
            value: embedParsers.channels(
             rule.exemptChannels.map((o) => o?.id).filter((o): o is string => !!o),
             language,
            ),
           },
          ]
        : []),
      ]
    : [
       {
        name: language.t.Deprecated,
        value: language.errors.deprecatedByDiscord,
       },
      ],
 },
];

const getActionMetadata = (
 rule: RAutomod,
 type: keyof typeof Discord.AutoModerationActionType,
) => rule.actions.find((r) => r.type === Discord.AutoModerationActionType[type])?.metadata;

export const getComponents = (
 rule: RAutomod,
 language: CT.Language,
 lan: CT.Language['slashCommands']['settings']['categories'][CT.SettingNames.DenylistRules],
): Discord.APIActionRowComponent<Discord.APIButtonComponent>[] =>
 [
  {
   type: ComponentType.ActionRow,
   components: [
    {
     type: ComponentType.Button,
     style: ButtonStyle.Danger,
     custom_id: `settings/autoModRule/display`,
     emoji: client.util.emotes.back,
    },
    {
     type: ComponentType.Button,
     label: language.events.logs.automodRule.enabled,
     style: SH.getStyle(rule.enabled),
     custom_id: `settings/autoModRule/boolean_active_${rule.id}`,
     emoji: SH.getEmoji(rule.enabled, CT.GlobalDescType.Active),
    },
    {
     type: ComponentType.Button,
     label: language.slashCommands.settings.delete,
     style: ButtonStyle.Danger,
     custom_id: `settings/autoModRule/delete_${rule.id}`,
     emoji: client.util.emotes.minusBG,
    },
   ],
  },
  ...(rule.triggerType !== RAutomodTriggerType.Spam
   ? [
      {
       type: ComponentType.ActionRow,
       components: [
        ...([RAutomodTriggerType.Keyword, 6].includes(rule.triggerType)
         ? [
            {
             type: ComponentType.Button,
             label: language.events.logs.automodRule.keywordFilter,
             style: rule.triggerMetadata.keywordFilter
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/strings_keywordFilter_${rule.id}`,
            },
            {
             type: ComponentType.Button,
             label: language.events.logs.automodRule.regexPatterns,
             style: rule.triggerMetadata.keywordFilter
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/strings_regex_${rule.id}`,
            },
           ]
         : []),
        ...(rule.triggerType === RAutomodTriggerType.KeywordPreset
         ? [
            {
             type: ComponentType.Button,
             label:
              language.events.logs.automodRule.presets[
               RAutomodKeywordPresetType.Profanity
              ],
             style: rule.triggerMetadata.presets.includes(
              RAutomodKeywordPresetType.Profanity,
             )
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/boolean_profanity_${rule.id}`,
             disabled:
              rule.triggerMetadata.presets.length === 1 &&
              rule.triggerMetadata.presets.includes(
               RAutomodKeywordPresetType.Profanity,
              ),
            },
            {
             type: ComponentType.Button,
             label:
              language.events.logs.automodRule.presets[
               RAutomodKeywordPresetType.SexualContent
              ],
             style: rule.triggerMetadata.presets.includes(
              RAutomodKeywordPresetType.SexualContent,
             )
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/boolean_sexualContent_${rule.id}`,
             disabled:
              rule.triggerMetadata.presets.length === 1 &&
              rule.triggerMetadata.presets.includes(
               RAutomodKeywordPresetType.SexualContent,
              ),
            },
            {
             type: ComponentType.Button,
             label:
              language.events.logs.automodRule.presets[
               RAutomodKeywordPresetType.Slurs
              ],
             style: rule.triggerMetadata.presets.includes(
              RAutomodKeywordPresetType.Slurs,
             )
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/boolean_slurs_${rule.id}`,
             disabled:
              rule.triggerMetadata.presets.length === 1 &&
              rule.triggerMetadata.presets.includes(
               RAutomodKeywordPresetType.Slurs,
              ),
            },
           ]
         : []),
        ...([
         RAutomodTriggerType.Keyword,
         RAutomodTriggerType.KeywordPreset,
         6,
        ].includes(rule.triggerType)
         ? [
            {
             type: ComponentType.Button,
             label: language.events.logs.automodRule.allowList,
             style: rule.triggerMetadata.allowList
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/strings_allowList_${rule.id}`,
            },
           ]
         : []),
        ...(rule.triggerType === RAutomodTriggerType.MentionSpam
         ? [
            {
             type: ComponentType.Button,
             label: language.events.logs.automodRule.mentionTotalLimit,
             style: ButtonStyle.Secondary,
             custom_id: `settings/autoModRule/number_mentionTotalLimit_${rule.id}`,
            },
            {
             type: ComponentType.Button,
             label: language.events.logs.automodRule.mentionRaidProtectionEnabled,
             style: rule.triggerMetadata.mentionRaidProtectionEnabled
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
             custom_id: `settings/autoModRule/boolean_mentionRaidProtectionEnabled_${rule.id}`,
            },
           ]
         : []),
       ] as Discord.APIButtonComponentWithCustomId[],
      },
     ]
   : []),
  {
   type: ComponentType.ActionRow,
   components: [
    {
     type: ComponentType.Button,
     label:
      rule.eventType === RAutomodEventType.MessageSend
       ? language.events.logs.automodRule.actionsType[Discord.AutoModerationActionType.BlockMessage]
       : language.events.logs.automodRule.actionsType[4],
     style: ButtonStyle.Secondary,
     custom_id: `settings/autoModRule/boolean_${
      rule.eventType === RAutomodEventType.MessageSend
       ? 'blockMessage'
       : 'blockInteraction'
     }_${rule.id}`,
     emoji: rule.actions.find(
      (r) =>
       r.type ===
       (rule.eventType === RAutomodEventType.MessageSend
        ? Discord.AutoModerationActionType.BlockMessage
        : 4),
     )
      ? client.util.emotes.enabled
      : client.util.emotes.disabled,
     disabled:
      rule.eventType !== RAutomodEventType.MessageSend ||
      (rule.actions.length === 1 &&
       !!rule.actions.find(
        (r) =>
         r.type ===
         (rule.eventType === RAutomodEventType.MessageSend
          ? Discord.AutoModerationActionType.BlockMessage
          : 4),
       )),
    },
    ...(rule.eventType === RAutomodEventType.MessageSend &&
    getActionMetadata(rule, 'BlockMessage')
     ? [
        {
         type: ComponentType.Button,
         label: lan.fields.customMessage.name,
         style: getActionMetadata(rule, 'BlockMessage')?.customMessage
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
         custom_id: `settings/autoModRule/string_customMessage_${rule.id}`,
        },
       ]
     : []),
    ...(getActionMetadata(rule, 'SendAlertMessage')?.channelId
     ? [
        {
         type: ComponentType.Button,
         label:
          language.events.logs.automodRule.actionsType[
           Discord.AutoModerationActionType.SendAlertMessage
          ],
         style: ButtonStyle.Secondary,
         custom_id: `settings/autoModRule/boolean_sendAlertMessage_${rule.id}`,
         emoji: getActionMetadata(rule, 'SendAlertMessage')?.channelId
          ? client.util.emotes.enabled
          : undefined,
         disabled:
          rule.actions.length === 1 && !!getActionMetadata(rule, 'SendAlertMessage')?.channelId,
        },
       ]
     : []),
    {
     type: ComponentType.Button,
     label: getActionMetadata(rule, 'SendAlertMessage')?.channelId
      ? language.events.logs.automodRule.alertChannel
      : language.events.logs.automodRule.actionsType[
         Discord.AutoModerationActionType.SendAlertMessage
        ],
     style: ButtonStyle.Secondary,
     custom_id: `settings/autoModRule/channel_${rule.id}`,
     emoji: getActionMetadata(rule, 'SendAlertMessage')?.channelId
      ? client.util.emotes.channelTypes[0]
      : client.util.emotes.disabled,
    },
   ] as Discord.APIButtonComponentWithCustomId[],
  },
  ...([
   RAutomodTriggerType.Keyword,
   RAutomodTriggerType.MentionSpam,
  ].includes(rule.triggerType)
   ? [
      {
       type: ComponentType.ActionRow,
       components: [
        ...(getActionMetadata(rule, 'Timeout')
         ? [
            {
             type: ComponentType.Button,
             label:
              language.events.logs.automodRule.actionsType[
               Discord.AutoModerationActionType.Timeout
              ],
             style: ButtonStyle.Secondary,
             custom_id: `settings/autoModRule/boolean_timeout_${rule.id}`,
             emoji: getActionMetadata(rule, 'Timeout')
              ? client.util.emotes.enabled
              : client.util.emotes.disabled,
             disabled: rule.actions.length === 1 && !!getActionMetadata(rule, 'Timeout'),
            },
           ]
         : []),
        {
         type: ComponentType.Button,
         label: getActionMetadata(rule, 'Timeout')
          ? language.events.logs.automodRule.timeoutDuration
          : language.events.logs.automodRule.actionsType[Discord.AutoModerationActionType.Timeout],
         style: ButtonStyle.Secondary,
         custom_id: `settings/autoModRule/timeoutDuration_${rule.id}`,
         emoji: getActionMetadata(rule, 'Timeout') ? undefined : client.util.emotes.disabled,
        },
       ] as Discord.APIButtonComponentWithCustomId[],
      },
     ]
   : []),
  {
   type: ComponentType.ActionRow,
   components: [
    {
     type: ComponentType.Button,
     label: language.events.logs.automodRule.exemptRoles,
     style: rule.exemptRoles.size ? ButtonStyle.Secondary : ButtonStyle.Primary,
     custom_id: `settings/${CT.AutoModEditorType.Roles}_${rule.id}`,
     emoji: client.util.emotes.Role,
    },
    ...(rule.eventType === RAutomodEventType.MessageSend
     ? [
        {
         type: ComponentType.Button,
         label: language.events.logs.automodRule.exemptChannels,
         style: rule.exemptChannels.size
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
         custom_id: `settings/${CT.AutoModEditorType.Channels}_${rule.id}`,
         emoji: client.util.emotes.channelTypes[0],
        },
       ]
     : []),
   ] as Discord.APIButtonComponentWithCustomId[],
  },
 ] as Discord.APIActionRowComponent<Discord.APIButtonComponent>[];

const getAllComponents = (
 language: CT.Language,
 automodRules: RAutomod[] | undefined,
): Discord.APIActionRowComponent<Discord.APIComponentInMessageActionRow>[] => {
 const lan = language.slashCommands.settings.categories[CT.SettingNames.DenylistRules];

 const createKeywordRule = client.util.settingsHelpers.buttonParsers.create(
  language,
  CT.SettingNames.DenylistRules,
 );
 createKeywordRule.custom_id = 'settings/autoModRule/create_keyword';
 createKeywordRule.label = lan.keyword;
 const createMentionSpamRule = client.util.settingsHelpers.buttonParsers.create(
  language,
  CT.SettingNames.DenylistRules,
 );
 createMentionSpamRule.custom_id = 'settings/autoModRule/create_mention';
 createMentionSpamRule.label = lan.mention;
 const createSpamRule = client.util.settingsHelpers.buttonParsers.create(
  language,
  CT.SettingNames.DenylistRules,
 );
 createSpamRule.custom_id = 'settings/autoModRule/create_spam';
 createSpamRule.label = lan.spam;
 const createPresetRule = client.util.settingsHelpers.buttonParsers.create(
  language,
  CT.SettingNames.DenylistRules,
 );
 createPresetRule.custom_id = 'settings/autoModRule/create_preset';
 createPresetRule.label = lan.preset;
 const createMemberRule = client.util.settingsHelpers.buttonParsers.create(
  language,
  CT.SettingNames.DenylistRules,
 );
 createMemberRule.custom_id = 'settings/autoModRule/create_member';
 createMemberRule.label = lan.member;

 if (
  automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.Keyword)
   .length === 6
 ) {
  createKeywordRule.disabled = true;
 }

 if (
  automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.MentionSpam)
   .length === 1
 ) {
  createMentionSpamRule.disabled = true;
 }

 if (
  automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.KeywordPreset)
   .length === 1
 ) {
  createPresetRule.disabled = true;
 }

 if (
  automodRules?.filter((r) => r.triggerType === RAutomodTriggerType.Spam)
   .length === 1
 ) {
  createSpamRule.disabled = true;
 }

 if (automodRules?.filter((r) => r.triggerType === (6 as never)).length === 1) {
  createMemberRule.disabled = true;
 }

 return [
  {
   type: ComponentType.ActionRow,
   components: [
    createKeywordRule,
    createMentionSpamRule,
    createPresetRule,
    createSpamRule,
    createMemberRule,
   ],
  },
 ];
};
