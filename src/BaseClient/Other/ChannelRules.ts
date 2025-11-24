import type { levelingruleschannels } from '@prisma/client';

export declare enum ActivityFlags {
 'HasLeastAttachments' = 1,
 'HasMostAttachments' = 2,
 'HasLeastCharacters' = 4,
 'HasMostCharacters' = 8,
 'HasLeastWords' = 16,
 'HasMostWords' = 32,
 'MentionsLeastUsers' = 64,
 'MentionsMostUsers' = 128,
 'MentionsLeastChannels' = 256,
 'MentionsMostChannels' = 512,
 'MentionsLeastRoles' = 1024,
 'MentionsMostRoles' = 2048,
 'HasLeastLinks' = 4096,
 'HasMostLinks' = 8192,
 'HasLeastEmotes' = 16384,
 'HasMostEmotes' = 32768,
 'HasLeastMentions' = 65536,
 'HasMostMentions' = 131072,
}

export default class ChannelRules {
 bitfield = 0n;

 constructor(db: levelingruleschannels) {
  const keys = Object.keys(db) as (keyof levelingruleschannels)[];

  keys.forEach((key) => {
   if (!db[key]) return;

   switch (key) {
    case 'hasleastattachments':
     this.bitfield |= BigInt(ActivityFlags.HasLeastAttachments);
     break;
    case 'hasmostattachments':
     this.bitfield |= BigInt(ActivityFlags.HasMostAttachments);
     break;
    case 'hasleastcharacters':
     this.bitfield |= BigInt(ActivityFlags.HasLeastCharacters);
     break;
    case 'hasmostcharacters':
     this.bitfield |= BigInt(ActivityFlags.HasMostCharacters);
     break;
    case 'hasleastwords':
     this.bitfield |= BigInt(ActivityFlags.HasLeastWords);
     break;
    case 'hasmostwords':
     this.bitfield |= BigInt(ActivityFlags.HasMostWords);
     break;
    case 'mentionsleastusers':
     this.bitfield |= BigInt(ActivityFlags.MentionsLeastUsers);
     break;
    case 'mentionsmostusers':
     this.bitfield |= BigInt(ActivityFlags.MentionsMostUsers);
     break;
    case 'mentionsleastchannels':
     this.bitfield |= BigInt(ActivityFlags.MentionsLeastChannels);
     break;
    case 'mentionsmostchannels':
     this.bitfield |= BigInt(ActivityFlags.MentionsMostChannels);
     break;
    case 'mentionsleastroles':
     this.bitfield |= BigInt(ActivityFlags.MentionsLeastRoles);
     break;
    case 'mentionsmostroles':
     this.bitfield |= BigInt(ActivityFlags.MentionsMostRoles);
     break;
    case 'hasleastlinks':
     this.bitfield |= BigInt(ActivityFlags.HasLeastLinks);
     break;
    case 'hasmostlinks':
     this.bitfield |= BigInt(ActivityFlags.HasMostLinks);
     break;
    case 'hasleastemotes':
     this.bitfield |= BigInt(ActivityFlags.HasLeastEmotes);
     break;
    case 'hasmostemotes':
     this.bitfield |= BigInt(ActivityFlags.HasMostEmotes);
     break;
    case 'hasleastmentions':
     this.bitfield |= BigInt(ActivityFlags.HasLeastMentions);
     break;
    case 'hasmostmentions':
     this.bitfield |= BigInt(ActivityFlags.HasMostMentions);
     break;
   }
  });
 }

 has = (bit: bigint): boolean => (this.bitfield & bit) === bit;
}
