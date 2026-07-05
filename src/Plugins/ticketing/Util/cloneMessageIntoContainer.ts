import type { RMessage } from '@ayako/utility';
import {
 ButtonBuilder,
 FileBuilder,
 MediaGalleryBuilder,
 MediaGalleryItemBuilder,
 SectionBuilder,
 SeparatorBuilder,
 TextDisplayBuilder,
 type ContainerBuilder,
} from '@discordjs/builders';
import {
 ButtonStyle,
 MessageReferenceType,
 SeparatorSpacingSize,
 StickerFormatType,
 type GatewayMessageDeleteDispatchData,
} from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';

interface ContextBase {
 authorName: string;
 rawAuthor?: boolean;
 forwardedFromLabel?: string;
 forwardUnavailableLabel?: string;
}

type ContextButton =
 | (ContextBase & { button: ButtonBuilder; context?: never })
 | (ContextBase & { button?: never; context: string })
 | (ContextBase & { button?: never; context?: never });

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

export const cloneMessageIntoContainer = function (
 this: ContainerBuilder,
 msg: RMessage | GatewayMessageDeleteDispatchData | null,
 contextButton?: ContextButton,
) {
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

  case !!(contextButton?.authorName && contextButton?.context): {
   this.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      getAuthorNameComponent(contextButton.authorName, contextButton.rawAuthor),
     )
     .setButtonAccessory(contextMarkerButton(contextButton.context)),
   );

   addSeparator.call(this);
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

 if (msg.content) {
  this.addTextDisplayComponents(new TextDisplayBuilder().setContent(msg.content));
 }

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
  snapshotFiles.forEach((a) => this.addFileComponents(new FileBuilder().setURL(a.url)));

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
  nonMediaAttachments.forEach((a) => this.addFileComponents(new FileBuilder().setURL(a.url)));
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

 addSeparator.call(this);
 this.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
   `-# ${constants.formatters.getTime(new Date(msg.timestamp).getTime())}`,
  ),
 );
};
