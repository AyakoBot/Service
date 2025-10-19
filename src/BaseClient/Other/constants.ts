import settingsEditorTypes from './constants/settingsEditorTypes.js';
import events from './constants/events.js';
import standard from './constants/standard.js';
import interactions from './constants/interactions.js';
import gifs from './constants/gifs.js';
import customembeds from './constants/customEmbeds.js';
import tutorials from './constants/tutorials.js';

export default {
 path: {
  allowlist: `/app/Ayako/packages/CDN/antivirus/allowlisted.txt`,
  badLinks: `/app/Ayako/packages/CDN/antivirus/badLinks.txt`,
 },
 events,
 discordMsgUrls: [
  'https://discord.com/channels/[Guild ID]/[Channel ID]/[Message ID]',
  'https://ptb.discord.com/channels/[Guild ID]/[Channel ID]/[Message ID]',
  'https://canary.discord.com/channels/[Guild ID]/[Channel ID]/[Message ID]',
 ],
 standard,
 customembeds,
 commands: {
  help: {
   'Stick Message':
    'Stick a Message to a Channel. The sticked Message will be re-posted with a Delay of 1 Minute after another Message is sent\nUn-Stick the Message by deleting it.',
  },
  interactions,
  gifs,
  settings: {
   basicSettings: ['vote', 'leveling', 'nitro', 'appeals'],
   types: settingsEditorTypes,
  },
 },
 tutorials,
};
