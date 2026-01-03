import { MessageType } from '@discordjs/core';

export type UndeletableMessageType =
 | MessageType.Call
 | MessageType.ChannelIconChange
 | MessageType.ChannelNameChange
 | MessageType.RecipientAdd
 | MessageType.RecipientRemove
 | MessageType.ThreadStarterMessage;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const UndeletableMessageTypes: UndeletableMessageType[] = [
 MessageType.Call,
 MessageType.ChannelIconChange,
 MessageType.ChannelNameChange,
 MessageType.RecipientAdd,
 MessageType.RecipientRemove,
 MessageType.ThreadStarterMessage,
];
