import * as CT from '../../../../Typings/Typings.js';
import badges from './info/badges.js';
import bot from './info/bot.js';
import channel from './info/channel.js';
import emojis from './info/emojis.js';
import invite from './info/invite.js';
import role from './info/role.js';
import server from './info/server.js';
import stickers from './info/stickers.js';
import user from './info/user.js';

export default (t: CT.Language) => ({
 ...t.JSON.slashCommands.info,
 invite: invite(t),
 emojis: emojis(t),
 role: role(t),
 badges: badges(t),
 bot: bot(t),
 user: user(t),
 server: server(t),
 channel: channel(t),
 stickers: stickers(t),
});
