import {
 ButtonBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIComponentInContainer,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { Colors } from '../../../Types/index.js';
import { codeId, subLine } from '../../../Util/fmt.js';
import languageFunctions from '../../../Util/languageFunctions.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';

import type { ConfessionsTranslator } from './container.js';

export enum ConfessionLogKind {
 Posted = 'posted',
 Rejected = 'rejected',
 Banned = 'banned',
 Unbanned = 'unbanned',
 Revealed = 'revealed',
 Deleted = 'deleted',
 Reported = 'reported',
 Failed = 'failed',
}

export interface ConfessionLogEvent {
 kind: ConfessionLogKind;
 number: number | null;
 parentNumber?: number | null;
 author: string | null;
 actor: string | null;
 content?: string | null;
 media?: string | null;
 reason?: string | null;
 link?: string | null;
 until?: Date | null;
}

const textBudget = 3800;
const noteReserve = 120;

const accents: Record<ConfessionLogKind, Colors> = {
 [ConfessionLogKind.Posted]: Colors.Success,
 [ConfessionLogKind.Rejected]: Colors.Danger,
 [ConfessionLogKind.Banned]: Colors.Danger,
 [ConfessionLogKind.Unbanned]: Colors.Success,
 [ConfessionLogKind.Revealed]: Colors.Warning,
 [ConfessionLogKind.Deleted]: Colors.Danger,
 [ConfessionLogKind.Reported]: Colors.Warning,
 [ConfessionLogKind.Failed]: Colors.Danger,
};

const icons: Record<ConfessionLogKind, EmoteName> = {
 [ConfessionLogKind.Posted]: EmoteName.LogMessage,
 [ConfessionLogKind.Rejected]: EmoteName.LogMessageDelete,
 [ConfessionLogKind.Banned]: EmoteName.LogBanAdd,
 [ConfessionLogKind.Unbanned]: EmoteName.LogBanRemove,
 [ConfessionLogKind.Revealed]: EmoteName.Unlock,
 [ConfessionLogKind.Deleted]: EmoteName.LogMessageDelete,
 [ConfessionLogKind.Reported]: EmoteName.Warning,
 [ConfessionLogKind.Failed]: EmoteName.Cross,
};

const titles: Record<ConfessionLogKind, (t: ConfessionsTranslator, subject: string) => string> = {
 [ConfessionLogKind.Posted]: (t, subject) => t.log.posted({ subject }),
 [ConfessionLogKind.Rejected]: (t, subject) => t.log.rejected({ subject }),
 [ConfessionLogKind.Banned]: (t, subject) => t.log.banned({ subject }),
 [ConfessionLogKind.Unbanned]: (t, subject) => t.log.unbanned({ subject }),
 [ConfessionLogKind.Revealed]: (t, subject) => t.log.revealed({ subject }),
 [ConfessionLogKind.Deleted]: (t, subject) => t.log.deleted({ subject }),
 [ConfessionLogKind.Reported]: (t, subject) => t.log.reported({ subject }),
 [ConfessionLogKind.Failed]: (t, subject) => t.log.failed({ subject }),
};

export const subjectOf = (
 t: ConfessionsTranslator,
 event: Pick<ConfessionLogEvent, 'number' | 'parentNumber'>,
): string => {
 if (event.parentNumber !== undefined) {
  return event.parentNumber === null
   ? t.log.replyPlain()
   : t.log.replySubject({ number: String(event.parentNumber) });
 }

 return event.number === null
  ? t.log.confessionPlain()
  : t.log.confessionSubject({ number: String(event.number) });
};

export const authorSubject = (
 t: ConfessionsTranslator,
 author: string | null,
 user: Parameters<ReturnType<typeof languageFunctions>['getUser']>[0],
): string => {
 if (!author) return `**${t.log.anonymous()}**`;
 if (user) return languageFunctions(t.base).getUser(user);

 return `**${t.base.t.User()} <@${author}> / ${codeId(author)}**`;
};

const separator = (): APIComponentInContainer =>
 new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small).toJSON();

const footerLine = (t: ConfessionsTranslator, event: ConfessionLogEvent): string => {
 const parts = [constants.formatters.getTime(Date.now())];
 if (event.actor) parts.push(t.log.by({ user: `<@${event.actor}>` }));
 if (event.reason) parts.push(`${t.base.t.Reason()}: ${event.reason}`);
 if (event.kind === ConfessionLogKind.Banned) {
  parts.push(
   event.until
    ? t.log.until({ time: constants.formatters.getTime(event.until.getTime()) })
    : t.log.permanent(),
  );
 }

 return `-# ${parts.join(' · ')}`;
};

const bodyLines = (t: ConfessionsTranslator, event: ConfessionLogEvent, room: number): string[] => {
 const media = event.media ? [subLine(t.log.image(), event.media)] : [];
 const content = event.content ?? '';
 if (!content) return media;
 if (content.length <= room) return [content, ...media];

 return [
  `${content.slice(0, Math.max(0, room - 1))}…`,
  `-# ${t.log.truncated({ total: String(content.length) })}`,
  ...media,
 ];
};

export const logContainer = (
 t: ConfessionsTranslator,
 event: ConfessionLogEvent,
 emotes: EmoteSet,
 subject: string,
): APIMessageTopLevelComponent => {
 const heading = new TextDisplayBuilder().setContent(
  `### ${textEmote(emotes.get(icons[event.kind]))} ${titles[event.kind](t, subjectOf(t, event))}\n${subject}`,
 );
 const header = event.link
  ? new SectionBuilder()
     .addTextDisplayComponents(heading)
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Link)
       .setURL(event.link)
       .setLabel(t.base.t.JumpToMessage()),
     )
  : heading;

 const footer = footerLine(t, event);
 const fixed = (heading.data.content ?? '').length + footer.length + (event.media?.length ?? 0);
 const body = bodyLines(t, event, textBudget - fixed - noteReserve);

 return {
  type: ComponentType.Container,
  accent_color: accents[event.kind],
  components: [
   header.toJSON(),
   separator(),
   ...(body.length
    ? [new TextDisplayBuilder().setContent(body.join('\n')).toJSON(), separator()]
    : []),
   new TextDisplayBuilder().setContent(footer).toJSON(),
  ],
 };
};
