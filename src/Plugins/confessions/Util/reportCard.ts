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

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { Colors } from '../../../Types/index.js';
import { subLine } from '../../../Util/fmt.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';

import type { ConfessionsTranslator } from './container.js';

export interface ReportView {
 subject: string;
 content: string | null;
 media: string | null;
 reporter: string;
 reason: string;
 link: string | null;
}

const textBudget = 3800;
const reserve = 60;

export const clip = (text: string, room: number): string =>
 text.length <= room ? text : `${text.slice(0, Math.max(0, room - 1))}…`;

const separator = (): APIComponentInContainer =>
 new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small).toJSON();

const text = (content: string): APIComponentInContainer =>
 new TextDisplayBuilder().setContent(content).toJSON();

export const reportCard = (
 t: ConfessionsTranslator,
 view: ReportView,
 emotes: EmoteSet,
): APIMessageTopLevelComponent => {
 const heading = new TextDisplayBuilder().setContent(
  `### ${textEmote(emotes.get(EmoteName.Warning))} ${t.report.heading({ subject: view.subject })}`,
 );
 const header = view.link
  ? new SectionBuilder()
     .addTextDisplayComponents(heading)
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Link)
       .setURL(view.link)
       .setLabel(t.base.t.JumpToMessage()),
     )
  : heading;
 const footer = `-# ${t.report.by({ user: `<@${view.reporter}>` })} · ${t.base.t.Reason()}: ${view.reason}`;
 const media = view.media ? subLine(t.log.image(), view.media) : '';
 const room = textBudget - (heading.data.content ?? '').length - footer.length - media.length - reserve;
 const body = [clip(view.content ?? '', room), media].filter(Boolean).join('\n');

 return {
  type: ComponentType.Container,
  accent_color: Colors.Warning,
  components: [
   header.toJSON(),
   separator(),
   ...(body ? [text(body), separator()] : []),
   text(footer),
  ],
 };
};
