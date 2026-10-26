import type { RMessage } from '@ayako/utility';
import {
 ButtonBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
 ThumbnailBuilder,
 type ContainerBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageReferenceType,
 SeparatorSpacingSize,
 StickerFormatType,
 type GatewayMessageDeleteDispatchData,
} from 'discord-api-types/v10';

import constants from '../Classes/Constants.js';

import { splitBesideThumbnail } from './splitBesideThumbnail.js';

interface ContextBase {
 authorName: string;
 rawAuthor?: boolean;
 forwardedFromLabel?: string;
 forwardUnavailableLabel?: string;
 attachmentLabel?: string;
}

type ContextButton =
 | (ContextBase & { button: ButtonBuilder; thumbnail?: never })
 | (ContextBase & { button?: never; thumbnail: string })
 | (ContextBase & { button?: never; thumbnail?: never });

export const contextMarkerButton = (customId: string) =>
 new ButtonBuilder()
  .setStyle(ButtonStyle.Secondary)
  .setDisabled(true)
  .setCustomId(customId)
  .setLabel(String.fromCharCode(0x200b));

const addSeparator = function (this: ContainerBuilder) {
 this.addSeparatorComponents(
  new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
 );
};

const getAuthorNameComponent = function (authorName: string, raw: boolean = false) {
 return new TextDisplayBuilder().setContent(raw ? authorName : `-# ${authorName}`);
};

const attachmentLines = (
 attachments: { filename: string; url: string }[],
 label: string | undefined,
) => attachments.map((a) => `-# ${label ? `${label}: ` : ''}[${a.filename}](${a.url})`).join('\n');

const thumbnailHeader = (contextButton: ContextButton) =>
 contextButton.rawAuthor ? contextButton.authorName : `**${contextButton.authorName}**`;

export const cloneMessageIntoContainer = function (
 this: ContainerBuilder,
 msg: RMessage | GatewayMessageDeleteDispatchData | null,
 contextButton?: ContextButton,
) {
 const content = msg && 'content' in msg ? msg.content : '';
 const stamp =
  msg && 'content' in msg
   ? `-# ${constants.formatters.getTime(new Date(msg.timestamp).getTime())}`
   : null;
 const [beside, below] = contextButton?.thumbnail
  ? splitBesideThumbnail(thumbnailHeader(contextButton), content)
  : ['', content];
 const stampBeside = !!contextButton?.thumbnail && !beside && !!stamp;

 switch (true) {
  case !!(contextButton?.authorName && contextButton?.button): {
   this.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      getAuthorNameComponent(contextButton.authorName, contextButton.rawAuthor),
     )
     .setButtonAccessory(contextButton.button),
   );

   addSeparator.call(this);
   break;
  }

  case !!(contextButton?.authorName && contextButton?.thumbnail): {
   const section = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(thumbnailHeader(contextButton)))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(contextButton.thumbnail));

   const side = beside || (stampBeside ? stamp : null);
   if (side) section.addTextDisplayComponents(new TextDisplayBuilder().setContent(side));

   this.addSectionComponents(section);
   break;
  }

  case !!contextButton?.authorName: {
   this.addTextDisplayComponents(
    getAuthorNameComponent(contextButton.authorName, contextButton.rawAuthor),
   );

   addSeparator.call(this);
   break;
  }

  default:
   break;
 }

 if (!msg || !('content' in msg)) return;

 if (below) this.addTextDisplayComponents(new TextDisplayBuilder().setContent(below));

 const isForward = msg.message_reference?.type === MessageReferenceType.Forward;
 if (isForward) {
  const snapshot = msg.message_snapshots?.[0];
  const fromLabel = contextButton?.forwardedFromLabel;
  if (fromLabel) {
   this.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${fromLabel}`));
  }

  if (snapshot?.content) {
   this.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     snapshot.content
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n'),
    ),
   );
  }

  const snapshotAttachments = snapshot?.attachments ?? [];
  const snapshotMedia = snapshotAttachments.filter((a) => a.width && a.height);
  if (snapshotMedia.length) {
   this.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
     snapshotMedia.map((a) => {
      const item = new MediaGalleryItemBuilder().setURL(a.url);
      if (a.description) item.setDescription(a.description);
      return item;
     }),
    ),
   );
  }

  const snapshotFiles = snapshotAttachments.filter((a) => !a.width || !a.height);
  if (snapshotFiles.length) {
   this.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     attachmentLines(snapshotFiles, contextButton?.attachmentLabel),
    ),
   );
  }

  if (!snapshot && contextButton?.forwardUnavailableLabel) {
   this.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${contextButton.forwardUnavailableLabel}`),
   );
  }
 }

 const mediaAttachments = msg.attachments.filter((a) => a.width && a.height);
 if (mediaAttachments.length) {
  this.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    mediaAttachments.map((a) => {
     const item = new MediaGalleryItemBuilder().setURL(a.url);
     if (a.description) item.setDescription(a.description);
     return item;
    }),
   ),
  );
 }

 const nonMediaAttachments = msg.attachments.filter((a) => !a.width || !a.height);
 if (nonMediaAttachments.length) {
  this.addTextDisplayComponents(
   new TextDisplayBuilder().setContent(
    attachmentLines(nonMediaAttachments, contextButton?.attachmentLabel),
   ),
  );
 }

 if (msg.sticker_items?.length) {
  this.addMediaGalleryComponents(
   new MediaGalleryBuilder().addItems(
    msg.sticker_items.map((i) =>
     new MediaGalleryItemBuilder().setURL(
      `https://media.discordapp.net/stickers/${i.id}.${StickerFormatType[i.format_type].replace('A', '')}`,
     ),
    ),
   ),
  );
 }

 if (stampBeside || !stamp) return;

 addSeparator.call(this);
 this.addTextDisplayComponents(new TextDisplayBuilder().setContent(stamp));
};
