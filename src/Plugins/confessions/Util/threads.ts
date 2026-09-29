import { ChannelType } from 'discord-api-types/v10';

export enum PostMode {
 ForumPost = 'forumPost',
 Message = 'message',
 ThreadedMessage = 'threadedMessage',
}

export const postModeFor = (type: ChannelType | undefined, autoThread: boolean): PostMode => {
 if (type === ChannelType.GuildForum) return PostMode.ForumPost;

 return autoThread ? PostMode.ThreadedMessage : PostMode.Message;
};

export interface RemovalTargets {
 thread: string | null;
 message: boolean;
}

export const removalTargets = (channel: string | null, thread: string | null): RemovalTargets => ({
 thread,
 message: channel !== thread,
});

export interface ReplyTarget {
 channel: string;
 replyTo: string | null;
}

export const replyTarget = (parent: {
 channel: string;
 message: string;
 thread: string | null;
}): ReplyTarget =>
 parent.thread
  ? { channel: parent.thread, replyTo: null }
  : { channel: parent.channel, replyTo: parent.message };
