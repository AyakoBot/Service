import * as CT from '../../../../Typings/Typings.js';

import antiSpam from './settings/anti-spam.js';
import antiVirus from './settings/anti-virus.js';
import basic from './settings/basic.js';
import buttonRoles from './settings/button-roles.js';
import denylistRules from './settings/denylist-rules.js';
import expiry from './settings/expiry.js';
import invites from './settings/invites.js';
import leveling from './settings/leveling.js';
import linkedRolesDeco from './settings/linked-roles-deco.js';
import multiChannels from './settings/multi-channels.js';
import multiRoles from './settings/multi-roles.js';
import newlines from './settings/newlines.js';
import reactionRoles from './settings/reaction-roles.js';
import roleRewards from './settings/role-rewards.js';
import separators from './settings/separators.js';
import voteRewards from './settings/vote-rewards.js';

const self = (t: CT.Language) => ({
 ...t.JSON.slashCommands.settings,
 authorType: (type: string) => t.stp(t.JSON.slashCommands.settings.authorType, { type, t }),
 reactionEditor: {
  ...t.JSON.slashCommands.settings.reactionEditor,
  desc: (thread: RThread) => t.stp(t.JSON.slashCommands.settings.reactionEditor.desc, { thread }),
 },
 log: {
  ...t.JSON.slashCommands.settings.log,
  desc: (n: string, setting: string) =>
   t.stp(t.JSON.slashCommands.settings.log.desc, { n, setting }),
  created: (setting: string) => t.stp(t.JSON.slashCommands.settings.log.created, { setting }),
  deleted: (setting: string) => t.stp(t.JSON.slashCommands.settings.log.deleted, { setting }),
 },
 categories: {
  ...t.JSON.slashCommands.settings.categories,
  'anti-spam': antiSpam(t),
  'anti-virus': antiVirus(t),
  basic: basic(t),
  'denylist-rules': denylistRules(t),
  'button-roles': buttonRoles(t),
  expiry: expiry(t),
  invites: invites(t),
  leveling: leveling(t),
  'multi-channels': multiChannels(t),
  'multi-roles': multiRoles(t),
  newlines: newlines(t),
  'reaction-roles': reactionRoles(t),
  'role-rewards': roleRewards(t),
  separators: separators(t),
  'vote-rewards': voteRewards(t),
  'linked-roles-deco': linkedRolesDeco(t),
 },
});

export default self;
