import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export const manifest = [
 { kind: 'channel_create', base: 'log-channel', badge: 'plus' },
 { kind: 'channel_update', base: 'log-channel', badge: 'pencil' },
 { kind: 'channel_delete', base: 'log-channel', badge: 'cross' },
 { kind: 'channel_status_update', base: 'log-channel', badge: 'spark' },
 { kind: 'message_pin', base: 'log-pin', badge: 'plus' },
 { kind: 'message_unpin', base: 'log-pin', badge: 'cross' },
 { kind: 'thread_create', base: 'log-thread', badge: 'plus' },
 { kind: 'thread_update', base: 'log-thread', badge: 'pencil' },
 { kind: 'thread_delete', base: 'log-thread', badge: 'cross' },
 { kind: 'thread_member_join', base: 'log-thread', badge: 'in' },
 { kind: 'thread_member_leave', base: 'log-thread', badge: 'out' },
 { kind: 'message_delete', base: 'log-message', badge: 'cross' },
 { kind: 'message_delete_bulk', base: 'log-messages', badge: 'cross' },
 { kind: 'message_update', base: 'log-message', badge: 'pencil' },
 { kind: 'reaction_add', base: 'log-reaction', badge: 'plus' },
 { kind: 'reaction_remove', base: 'log-reaction', badge: 'cross' },
 { kind: 'reaction_remove_all', base: 'log-reactions', badge: 'cross' },
 { kind: 'reaction_remove_emoji', base: 'log-reaction-emoji', badge: 'cross' },
 { kind: 'typing_start', base: 'log-typing', badge: null },
 { kind: 'poll_create', base: 'log-poll', badge: 'plus' },
 { kind: 'poll_end', base: 'log-poll', badge: 'cross' },
 { kind: 'poll_vote_add', base: 'log-poll-vote', badge: 'plus' },
 { kind: 'poll_vote_remove', base: 'log-poll-vote', badge: 'cross' },
 { kind: 'member_join', base: 'log-member', badge: 'in' },
 { kind: 'member_leave', base: 'log-member', badge: 'out' },
 { kind: 'member_update', base: 'log-member', badge: 'pencil' },
 { kind: 'member_prune', base: 'log-members', badge: 'cross' },
 { kind: 'ban_add', base: 'log-ban', badge: 'cross' },
 { kind: 'ban_remove', base: 'log-ban', badge: 'plus' },
 { kind: 'role_create', base: 'log-role', badge: 'plus' },
 { kind: 'role_update', base: 'log-role', badge: 'pencil' },
 { kind: 'role_delete', base: 'log-role', badge: 'cross' },
 { kind: 'emoji_create', base: 'log-emoji', badge: 'plus' },
 { kind: 'emoji_update', base: 'log-emoji', badge: 'pencil' },
 { kind: 'emoji_delete', base: 'log-emoji', badge: 'cross' },
 { kind: 'sticker_create', base: 'log-sticker', badge: 'plus' },
 { kind: 'sticker_update', base: 'log-sticker', badge: 'pencil' },
 { kind: 'sticker_delete', base: 'log-sticker', badge: 'cross' },
 { kind: 'soundboard_sound_create', base: 'log-soundboard', badge: 'plus' },
 { kind: 'soundboard_sound_update', base: 'log-soundboard', badge: 'pencil' },
 { kind: 'soundboard_sound_delete', base: 'log-soundboard', badge: 'cross' },
 { kind: 'webhook_create', base: 'log-webhook', badge: 'plus' },
 { kind: 'webhook_update', base: 'log-webhook', badge: 'pencil' },
 { kind: 'webhook_delete', base: 'log-webhook', badge: 'cross' },
 { kind: 'invite_create', base: 'log-invite', badge: 'plus' },
 { kind: 'invite_delete', base: 'log-invite', badge: 'cross' },
 { kind: 'voice_join', base: 'log-voice', badge: 'in' },
 { kind: 'voice_leave', base: 'log-voice', badge: 'out' },
 { kind: 'voice_switch', base: 'log-voice', badge: 'swap' },
 { kind: 'voice_state_update', base: 'log-voice', badge: 'pencil' },
 { kind: 'voice_move', base: 'log-members', badge: 'swap' },
 { kind: 'voice_disconnect', base: 'log-voice', badge: 'cross' },
 { kind: 'voice_effect_send', base: 'log-voice', badge: 'spark' },
 { kind: 'stage_create', base: 'log-stage', badge: 'plus' },
 { kind: 'stage_update', base: 'log-stage', badge: 'pencil' },
 { kind: 'stage_delete', base: 'log-stage', badge: 'cross' },
 { kind: 'scheduled_event_create', base: 'log-event', badge: 'plus' },
 { kind: 'scheduled_event_update', base: 'log-event', badge: 'pencil' },
 { kind: 'scheduled_event_delete', base: 'log-event', badge: 'cross' },
 { kind: 'scheduled_event_user_add', base: 'log-event', badge: 'in' },
 { kind: 'scheduled_event_user_remove', base: 'log-event', badge: 'out' },
 { kind: 'automod_rule_create', base: 'log-automod', badge: 'plus' },
 { kind: 'automod_rule_update', base: 'log-automod', badge: 'pencil' },
 { kind: 'automod_rule_delete', base: 'log-automod', badge: 'cross' },
 { kind: 'automod_action', base: 'log-automod', badge: 'spark' },
 { kind: 'command_permissions_update', base: 'log-command', badge: 'pencil' },
 { kind: 'user_update', base: 'log-user', badge: 'pencil' },
 { kind: 'guild_update', base: 'log-server', badge: 'pencil' },
 { kind: 'onboarding_update', base: 'log-onboarding', badge: 'pencil' },
 { kind: 'server_guide_update', base: 'log-server-guide', badge: 'pencil' },
 { kind: 'integration_create', base: 'log-integration', badge: 'plus' },
 { kind: 'integration_update', base: 'log-integration', badge: 'pencil' },
 { kind: 'integration_delete', base: 'log-integration', badge: 'cross' },
];

const inner = (svg) =>
 svg
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

const scopeIds = (markup, prefix) =>
 markup
  .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
  .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);

const compose = ({ kind, base, badge }) => {
 const name = `log-${kind.replaceAll('_', '-')}`;
 const baseMarkup = scopeIds(inner(readFileSync(join(root, 'svgs', `${base}.svg`), 'utf8')), name);

 if (!badge) {
  return { name, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n ${baseMarkup}\n</svg>\n` };
 }

 const badgeMarkup = scopeIds(
  inner(readFileSync(join(root, 'svgs', 'badges', `${badge}.svg`), 'utf8')),
  `${name}-b`,
 );

 const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
 <mask id="${name}-cut">
  <rect width="24" height="24" fill="#FFFFFF"/>
  <circle cx="18" cy="18" r="6.4" fill="#000000"/>
 </mask>
 <g mask="url(#${name}-cut)">
  <g transform="translate(-1.45 -2.01) scale(0.929)">
   ${baseMarkup.split('\n').join('\n  ')}
  </g>
 </g>
 <g transform="translate(12 12) scale(0.5)">
  ${badgeMarkup.split('\n').join('\n  ')}
 </g>
</svg>
`;
 return { name, svg };
};

const pairs = new Set(manifest.map((m) => `${m.base}+${m.badge}`));
if (pairs.size !== manifest.length) throw new Error('duplicate (base, badge) pair in manifest');
if (manifest.length !== 73) throw new Error(`manifest holds ${manifest.length} rows, expected 73`);

for (const row of manifest) {
 const { name, svg } = compose(row);
 writeFileSync(join(root, 'svgs', `${name}.svg`), svg);
}
console.log(`composed ${manifest.length} icons`);
